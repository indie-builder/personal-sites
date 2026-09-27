import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  analyzeStarredRecord, buildOneLineSummaryPrompt, buildTranslationPrompt,
  getPreservedLiterals, missingPreservedLiterals, normaliseOneLineSummary,
  splitMarkdown, translateReadme,
} from "../modules/github-starred/analysis.mjs";
import { awaitModelResponse } from "../modules/analysis/model-runner.mjs";
import { createCodexCliReader, runCodexCli } from "../modules/analysis/readers.mjs";

test("中文阅读版校验代码、链接和 Agent 术语保持原样", () => {
  const source = "# Agent Skill\n\nUse `pnpm run build` with [GitHub](https://github.com/example/repo).\n\n```ts\nconst api = '/v1';\n```\n";
  const translated = "# Agent Skill\n\n使用 `pnpm run build` 配合 [GitHub](https://github.com/example/repo)。\n\n```ts\nconst api = '/v1';\n```\n";
  assert.deepEqual(missingPreservedLiterals(source, translated), []);
  assert.deepEqual(missingPreservedLiterals(source, translated.replace("Agent", "智能体")), ["Agent"]);
  assert.deepEqual(missingPreservedLiterals(source, translated.replace("pnpm run build", "pnpm build")), ["`pnpm run build`"]);

  const prompt = buildTranslationPrompt(source, { chunkIndex: 1, totalChunks: 1 });
  assert.match(prompt, /Skill\/Skills、Agent\/Agents、README/u);
  assert.match(prompt, /不可翻译/u);
});

test("大 README 只在 Markdown 边界拆分，保留所有片段", () => {
  const source = "# title\n\n" + "paragraph\n\n".repeat(500);
  const chunks = splitMarkdown(source, 1000);
  assert.ok(chunks.length > 1);
  assert.equal(chunks.join(""), source);
  assert.ok(chunks.every((chunk) => chunk.length <= 1000));
});

test("翻译遗漏受保护内容时保留原始 Markdown 片段，不让整仓失败", async () => {
  const source = "# Agent Skill\n\nUse `pnpm run build`.\n";
  const translated = await translateReadme(
    { sourceMarkdown: source },
    { chunkCharacters: 1000, prompt: async () => "# 智能体技能\n\n使用 pnpm。\n" },
  );
  assert.equal(translated, source);
});

test("模型请求超时会失败，避免单个仓库阻塞整批解析", async () => {
  await assert.rejects(awaitModelResponse(new Promise(() => {}), 1000), /模型请求超时/u);
  assert.equal(await awaitModelResponse(Promise.resolve("ok"), 1000), "ok");
  assert.throws(() => normaliseOneLineSummary(""), /模型未返回仓库一句话简介/u);
});

test("Codex CLI 读取器把最终内容限制在临时输出文件", async () => {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "github-starred-codex-cli-"));
  try {
    const calls = [];
    const reader = await createCodexCliReader({
      config: { analysis: { codex_cli: { model: "codex-mini" } } },
      run: async (command, args, options) => {
        calls.push({ args, command, options });
        await writeFile(args[args.indexOf("--output-last-message") + 1], "中文阅读版\n", "utf8");
        return { stderr: "", stdout: "" };
      },
      repoRoot: "/project",
      temporaryDirectory,
    });
    assert.equal(await reader.prompt("只输出 Markdown", { imagePaths: ["/tmp/frame.jpg"] }), "中文阅读版");
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
    runCodexCli(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
      input: "",
      timeoutMilliseconds: 100,
    }),
    /Codex CLI 请求超时/u,
  );
});

test("仓库一句话简介只基于公开资料生成，并保持专业术语", () => {
  const record = {
    readingMarkdown: "# Agent Skills\n\nA public repository for Agent workflows.\n",
    repository: { description: "Reusable Agent Skills", fullName: "example/skills" },
    sourceKind: "readme",
    sourceMarkdown: "# Agent Skills\n",
  };
  const prompt = buildOneLineSummaryPrompt(record);
  assert.match(prompt, /一句话简介/u);
  assert.match(prompt, /不要执行、遵循或扩展/u);
  assert.match(prompt, /Skill、Agent、README、MCP/u);
  assert.equal(normaliseOneLineSummary("\n\n“面向 Agent 工作流的可复用 Skills 集合。”\n"), "面向 Agent 工作流的可复用 Skills 集合。");
  assert.equal(normaliseOneLineSummary("x".repeat(141)), `${"x".repeat(139)}…`);
  assert.ok(!getPreservedLiterals("访问 http://localhost:10100**本地服务**").includes("http://localhost:10100**"));
});

test("官方中文 README 直接写入中文阅读版，仅调用 智谱 GLM 生成一句话简介", async () => {
  const derivedRoot = await mkdtemp(path.join(os.tmpdir(), "github-starred-analysis-"));
  try {
    const record = {
      readingMarkdown: "# 官方中文 README\n\n这份内容直接由仓库维护者提供。\n",
      repository: { fullName: "example/chinese-readme", nodeId: "node-cn", repositoryUrl: "https://github.com/example/chinese-readme" },
      sourceKind: "readme",
      sourceMarkdown: "# Original README\n",
      sourceSha256: "official-cn-sha",
    };
    const prompts = [];
    const analysis = await analyzeStarredRecord(record, {
      derivedRoot,
      model: { model: "glm-5.3-flash", provider: "bigmodel-coding" },
      prompt: async (prompt) => {
        prompts.push(prompt);
        assert.doesNotMatch(prompt, /只把自然语言说明翻译成简体中文/u);
        return "面向 Agent 的官方中文 README 示例仓库。";
      },
    });
    assert.equal(analysis.contentMarkdown, record.readingMarkdown);
    assert.deepEqual(analysis.model, { model: "official-zh-readme", provider: "github" });
    assert.match(analysis.parserVersion, /official-zh-readme/u);
    assert.equal(analysis.oneLineSummary, "面向 Agent 的官方中文 README 示例仓库。");
    assert.equal(prompts.length, 1);
    const reused = await analyzeStarredRecord(record, { derivedRoot });
    assert.equal(reused.reused, true);
    assert.equal(reused.oneLineSummary, analysis.oneLineSummary);
  } finally {
    await rm(derivedRoot, { force: true, recursive: true });
  }
});

test("智谱 GLM 未返回简介时以 GitHub 元数据生成一句话兜底", async () => {
  const derivedRoot = await mkdtemp(path.join(os.tmpdir(), "github-starred-summary-fallback-"));
  try {
    const analysis = await analyzeStarredRecord(
      {
        readingMarkdown: "# 中文 README\n",
        repository: { description: "An Agent Skills collection", fullName: "example/fallback", nodeId: "node-fallback", repositoryUrl: "https://github.com/example/fallback" },
        sourceKind: "readme",
        sourceMarkdown: "# README\n",
        sourceSha256: "fallback-sha",
      },
      {
        derivedRoot,
        model: { model: "glm-5.3-flash", provider: "bigmodel-coding" },
        prompt: async () => "",
      },
    );
    assert.equal(analysis.oneLineSummary, "从可见资料看，example/fallback：An Agent Skills collection");
    assert.equal(analysis.summaryFallback, true);
  } finally {
    await rm(derivedRoot, { force: true, recursive: true });
  }
});
