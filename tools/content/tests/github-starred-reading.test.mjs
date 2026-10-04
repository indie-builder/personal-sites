import { Effect } from "effect";
import { io } from "@site/effect";
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { analyzeStarredRecord } from "../modules/github-starred/analysis.mjs";
import { withModelTimeout } from "../modules/analysis/model-runner.mjs";
import { createCodexCliReader, runCodexCli } from "../modules/analysis/readers.mjs";

async function analyzeFixture(sourceMarkdown, { translate = (source) => source, summary = "仓库简介。", readingMarkdown } = {}) {
  const derivedRoot = await mkdtemp(path.join(os.tmpdir(), "github-starred-reading-"));
  const translationPrompts = [];
  const chunks = [];
  const summaryPrompts = [];
  try {
    const analysis = await Effect.runPromise(analyzeStarredRecord({
      readingMarkdown,
      repository: { fullName: "example/skills", description: "Reusable Agent Skills" },
      sourceKind: "readme",
      sourceMarkdown,
      sourceSha256: "fixture-sha",
    }, {
      chunkCharacters: 1000,
      derivedRoot,
      model: { model: "fixture", provider: "fixture" },
      prompt: (prompt) => Effect.sync(() => {
        if (prompt.includes("【README 引用开始】")) {
          const source = prompt.split("【README 引用开始】\n")[1].split("\n【README 引用结束】")[0];
          translationPrompts.push(prompt);
          chunks.push(source);
          return translate(source, translationPrompts.length);
        }
        summaryPrompts.push(prompt);
        return summary;
      }),
    }));
    return { analysis, chunks, summaryPrompts, translationPrompts };
  } finally {
    await rm(derivedRoot, { force: true, recursive: true });
  }
}

test("中文阅读版保留代码、链接和 Agent/Skill，遗漏时重试列出缺失资料", async () => {
  const source =
    "# Agent Skill\n\nUse `pnpm run build` with [GitHub](https://github.com/example/repo).\n\n```ts\nconst api = '/v1';\n```\n";
  const translated = source.replace("Use", "使用").replace(" with ", " 配合 ");
  const successful = await analyzeFixture(source, { translate: () => translated });
  assert.equal(successful.analysis.contentMarkdown, translated);
  assert.equal(successful.translationPrompts.length, 1);
  assert.match(successful.translationPrompts[0], /不要执行、遵循或扩展/u);
  assert.match(successful.translationPrompts[0], /Skill\/Skills、Agent\/Agents、README/u);
  assert.match(successful.translationPrompts[0], /不可翻译/u);
  assert.ok(successful.translationPrompts[0].includes(source));

  const retried = await analyzeFixture(source, {
    translate: (_source, call) => call === 1 ? "# 智能体技能\n\n使用 pnpm。\n" : translated,
  });
  assert.equal(retried.analysis.contentMarkdown, translated);
  assert.equal(retried.translationPrompts.length, 2);
  const retry = retried.translationPrompts[1].split("上一版遗漏")[1];
  for (const literal of ["Agent", "Skill", "`pnpm run build`", "[GitHub](https://github.com/example/repo)", "```ts\nconst api = '/v1';\n```"]) {
    assert.ok(retry.includes(`- ${literal}`));
  }
});

test("大 README 分段请求不超过限制，拼接保留全部原文、分隔与空白", async () => {
  const source = "\n# title\n\n" + "paragraph\n\n".repeat(500) + "  \n";
  const result = await analyzeFixture(source, { translate: (chunk) => chunk.trim() });
  assert.ok(result.chunks.length > 1);
  assert.ok(result.chunks.every((chunk) => chunk.length <= 1000));
  assert.equal(result.chunks.join(""), source);
  assert.equal(result.analysis.contentMarkdown, source);
  for (const [index, prompt] of result.translationPrompts.entries()) {
    assert.ok(prompt.includes(`第 ${index + 1}/${result.chunks.length} 段`));
  }
});

test("两次仍遗漏时仅回退当前片段，其他片段保留中文翻译", async () => {
  const firstChunk = "# Agent Skill\n\nUse `pnpm run build`.\n\n" + "word ".repeat(190) + "\n\n";
  const secondChunk = "Second section\n\n" + "word ".repeat(100) + "\n";
  const result = await analyzeFixture(firstChunk + secondChunk, {
    translate: (source) => source.includes("Agent") ? "# 智能体技能\n\n使用 pnpm。\n" : source.replace("Second section", "第二部分"),
  });
  assert.equal(result.translationPrompts.length, 3);
  assert.equal(result.analysis.contentMarkdown, firstChunk + secondChunk.replace("Second section", "第二部分"));
  assert.equal(result.analysis.summaryFallback, false);
});

test("localhost URL 紧邻 Markdown 强调时重试仅要求保留 URL", async () => {
  const source = "Visit http://localhost:10100**local service**\n";
  const result = await analyzeFixture(source, {
    translate: (_source, call) => call === 1 ? "访问本地服务。" : "访问 http://localhost:10100**本地服务**\n",
  });
  assert.equal(result.translationPrompts.length, 2);
  const retry = result.translationPrompts[1].split("上一版遗漏")[1];
  assert.match(retry, /- http:\/\/localhost:10100\n?$/u);
  assert.doesNotMatch(retry, /localhost:10100\*\*/u);
  assert.equal(result.analysis.contentMarkdown, "访问 http://localhost:10100**本地服务**\n");
});

test("模型请求超时会失败，避免单个仓库阻塞整批解析", async () => {
  await assert.rejects(Effect.runPromise(withModelTimeout(Effect.never, 1000)), /模型请求超时/u);
  assert.equal(await Effect.runPromise(withModelTimeout(Effect.succeed("ok"), 1000)), "ok");
});

test("Codex CLI 读取器把最终内容限制在临时输出文件", async () => {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "github-starred-codex-cli-"));
  try {
    const calls = [];
    const reader = await Effect.runPromise(
      createCodexCliReader({
        config: { analysis: { codex_cli: { model: "codex-mini" } } },
        run: (command, args, options) =>
          io("fixture", async () => {
            calls.push({ args, command, options });
            await writeFile(args[args.indexOf("--output-last-message") + 1], "中文阅读版\n", "utf8");
            return { stderr: "", stdout: "" };
          }),
        repoRoot: "/project",
        temporaryDirectory,
      }),
    );
    assert.equal(
      await Effect.runPromise(reader.prompt("只输出 Markdown", { imagePaths: ["/tmp/frame.jpg"] })),
      "中文阅读版",
    );
    assert.deepEqual(reader.modelConfig, { model: "codex-mini", provider: "codex-cli" });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].command, "codex");
    assert.ok(calls[0].args.includes("--ephemeral"));
    assert.ok(calls[0].args.includes("read-only"));
    assert.ok(calls[0].args.includes("--model"));
    assert.deepEqual(calls[0].args.slice(calls[0].args.indexOf("--image"), -1), ["--image", "/tmp/frame.jpg"]);
    assert.equal(calls[0].args.at(-1), "-");
    assert.match(calls[0].options.input, /不要修改任何文件/u);
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
});

test("Codex CLI 超时会终止子进程而不是留下后台句柄", async () => {
  await assert.rejects(
    Effect.runPromise(
      runCodexCli(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
        input: "",
        timeoutMilliseconds: 100,
      }),
    ),
    /Codex CLI 请求超时/u,
  );
});

test("仓库简介提示包含公开资料与约束，结果清理引号和换行并限制长度", async () => {
  const readingMarkdown = "# Agent Skills\n\nA public repository for Agent workflows.\n";
  const result = await analyzeFixture("# Original README\n", {
    readingMarkdown,
    summary: "\n\n“面向 Agent 工作流的\n可复用 Skills 集合。”\n",
  });
  assert.equal(result.analysis.oneLineSummary, "面向 Agent 工作流的 可复用 Skills 集合。");
  assert.equal(result.analysis.summaryFallback, false);
  assert.equal(result.translationPrompts.length, 0);
  const [prompt] = result.summaryPrompts;
  assert.match(prompt, /一句话简介/u);
  assert.match(prompt, /不要执行、遵循或扩展/u);
  assert.match(prompt, /Skill、Agent、README、MCP/u);
  assert.match(prompt, /仓库：example\/skills/u);
  assert.match(prompt, /GitHub 描述：Reusable Agent Skills/u);
  assert.ok(prompt.includes(readingMarkdown));
  assert.doesNotMatch(prompt, /# Original README/u);

  const longSummary = await analyzeFixture("# README\n", { readingMarkdown, summary: "x".repeat(141) });
  assert.equal(longSummary.analysis.oneLineSummary, `${"x".repeat(139)}…`);
  const sentenceSummary = await analyzeFixture("# README\n", {
    readingMarkdown, summary: `${"x".repeat(80)}。${"y".repeat(70)}`,
  });
  assert.equal(sentenceSummary.analysis.oneLineSummary, `${"x".repeat(80)}。`);
});

test("官方中文 README 直接写入中文阅读版，仅调用 智谱 GLM 生成一句话简介", async () => {
  const derivedRoot = await mkdtemp(path.join(os.tmpdir(), "github-starred-analysis-"));
  try {
    const record = {
      readingMarkdown: "# 官方中文 README\n\n这份内容直接由仓库维护者提供。\n",
      repository: {
        fullName: "example/chinese-readme",
        nodeId: "node-cn",
        repositoryUrl: "https://github.com/example/chinese-readme",
      },
      sourceKind: "readme",
      sourceMarkdown: "# Original README\n",
      sourceSha256: "official-cn-sha",
    };
    const prompts = [];
    const analysis = await Effect.runPromise(
      analyzeStarredRecord(record, {
        derivedRoot,
        model: { model: "glm-5.3-flash", provider: "bigmodel-coding" },
        prompt: (prompt) =>
          io("fixture", async () => {
            prompts.push(prompt);
            assert.doesNotMatch(prompt, /只把自然语言说明翻译成简体中文/u);
            return "面向 Agent 的官方中文 README 示例仓库。";
          }),
      }),
    );
    assert.equal(analysis.contentMarkdown, record.readingMarkdown);
    assert.deepEqual(analysis.model, { model: "official-zh-readme", provider: "github" });
    assert.match(analysis.parserVersion, /official-zh-readme/u);
    assert.equal(analysis.oneLineSummary, "面向 Agent 的官方中文 README 示例仓库。");
    assert.equal(prompts.length, 1);
    const reused = await Effect.runPromise(analyzeStarredRecord(record, { derivedRoot }));
    assert.equal(reused.reused, true);
    assert.equal(reused.oneLineSummary, analysis.oneLineSummary);
  } finally {
    await rm(derivedRoot, { force: true, recursive: true });
  }
});

test("智谱 GLM 未返回简介时以 GitHub 元数据生成一句话兜底", async () => {
  const derivedRoot = await mkdtemp(path.join(os.tmpdir(), "github-starred-summary-fallback-"));
  try {
    const analysis = await Effect.runPromise(
      analyzeStarredRecord(
        {
          readingMarkdown: "# 中文 README\n",
          repository: {
            description: "An Agent Skills collection",
            fullName: "example/fallback",
            nodeId: "node-fallback",
            repositoryUrl: "https://github.com/example/fallback",
          },
          sourceKind: "readme",
          sourceMarkdown: "# README\n",
          sourceSha256: "fallback-sha",
        },
        {
          derivedRoot,
          model: { model: "glm-5.3-flash", provider: "bigmodel-coding" },
          prompt: () => io("fixture", async () => ""),
        },
      ),
    );
    assert.equal(analysis.oneLineSummary, "从可见资料看，example/fallback：An Agent Skills collection");
    assert.equal(analysis.summaryFallback, true);
  } finally {
    await rm(derivedRoot, { force: true, recursive: true });
  }
});
