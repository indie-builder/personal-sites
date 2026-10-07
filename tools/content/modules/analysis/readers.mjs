import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Deferred, Effect } from "effect";
import { attempt, io, OperationError } from "@site/effect";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";

import { withModelTimeout, runPiPrompt } from "./model-runner.mjs";
import { resolvePiModelConfig, configureBigModelRuntime } from "../../lib/pi-runtime.mjs";
import { resolveAnalysisEngine } from "./runtime.mjs";
import { acquireSubprocess } from "../../lib/subprocess.mjs";

function createBigModelReader({
  config = {},
  env = process.env,
  repoRoot,
  timeoutMilliseconds = config.analysis?.request_timeout_ms ?? 240000,
}) {
  return Effect.gen(function* () {
    const modelConfig = resolvePiModelConfig({ config, env });
    if (!env.BIGMODEL_API_KEY) return yield* Effect.fail(new Error("缺少 BIGMODEL_API_KEY，无法调用智谱 GLM。"));
    const runtime = yield* io("pi.runtime", () => ModelRuntime.create({ allowModelNetwork: false }));
    yield* configureBigModelRuntime(runtime, modelConfig.model, env);
    const model = runtime.getModel(modelConfig.provider, modelConfig.model);
    if (!model) return yield* Effect.fail(new Error(`Pi 未找到模型：${modelConfig.provider}/${modelConfig.model}`));
    return {
      modelConfig,
      prompt: (prompt, { images = [] } = {}) =>
        runPiPrompt({
          cwd: repoRoot,
          images,
          label: "智谱 GLM",
          model,
          prompt,
          runtime,
          timeoutMilliseconds: timeoutMilliseconds ?? undefined,
        }),
    };
  });
}

export function createAnalysisReader({ engine, config = {}, repoRoot, env = process.env, timeoutMilliseconds }) {
  return attempt("analysis.engine", () => resolveAnalysisEngine(engine)).pipe(
    Effect.flatMap((engine) => {
      switch (engine) {
        case "codex-cli":
          return createCodexCliReader({ config, repoRoot });
        case "zcode":
          return createZcodeCliReader({ config, env, repoRoot });
        case "pi":
          return createBigModelReader({ config, env, repoRoot, timeoutMilliseconds });
      }
    }),
  );
}

export function runCodexCli(command, args, { cwd, input, maxBuffer = 8 * 1024 * 1024, timeoutMilliseconds } = {}) {
  const request = Effect.scoped(Effect.gen(function* () {
    const { child, closed } = yield* acquireSubprocess(command, args, { cwd, stdio: ["pipe", "pipe", "pipe"] }, "analysis.process");
    const output = { value: "" };
    const errors = { value: "" };
    const collectFailure = Effect.callback((resume) => {
      let completed = false;
      const finish = (result) => {
        if (completed) return;
        completed = true;
        resume(result);
      };
      const collect = (target) => (chunk) => {
        if (completed) return;
        target.value += chunk.toString();
        if (Buffer.byteLength(target.value, "utf8") > maxBuffer)
          finish(Effect.fail(new Error("Codex CLI 输出超过安全缓冲上限。")));
      };
      child.stdout.on("data", collect(output));
      child.stderr.on("data", collect(errors));
      child.stdin.on("error", (error) => finish(Effect.fail(new OperationError("analysis.stdin", error))));
      child.stdin.end(input);
      return Effect.sync(() => { completed = true; });
    });
    return yield* Effect.raceFirst(collectFailure, Deferred.await(closed)).pipe(
      Effect.flatMap(({ code }) => code === 0
        ? Effect.succeed({ stderr: errors.value, stdout: output.value })
        : Effect.fail(new Error(
          `Codex CLI 退出码 ${code ?? "未知"}：${errors.value.trim() || output.value.trim() || "未返回错误详情"}`,
        ))),
    );
  }));

  return Number.isInteger(timeoutMilliseconds)
    ? request.pipe(
        Effect.timeoutOrElse({
          duration: timeoutMilliseconds,
          orElse: () => Effect.fail(new Error(`Codex CLI 请求超时（${Math.round(timeoutMilliseconds / 1000)} 秒）。`)),
        }),
      )
    : request;
}

function createZcodeCliReader({
  config = {},
  env = process.env,
  repoRoot,
  run = runCodexCli,
  timeoutMilliseconds,
} = {}) {
  const requestTimeoutMilliseconds = timeoutMilliseconds ?? config.analysis?.request_timeout_ms ?? 240000;
  const command = env.ZCODE_CLI || env.CLAUDE_CLI || "claude";
  return Effect.succeed({
    modelConfig: {
      model: config.analysis?.zcode?.model ?? env.ANTHROPIC_MODEL ?? "zcode-configured",
      provider: "zcode",
    },
    prompt(prompt, { imagePaths = [] } = {}) {
      const text =
        imagePaths.length > 0
          ? `${prompt}\n\n请先逐一读取以下本地图片再作答，结论必须用到图片内容：${imagePaths.join(" ")}`
          : prompt;
      return withModelTimeout(run(command, ["-p", text], { cwd: repoRoot, input: "" }), requestTimeoutMilliseconds, {
        label: "ZCode",
      }).pipe(Effect.map(({ stdout }) => stdout.trim()));
    },
  });
}

export function createCodexCliReader({ config = {}, repoRoot, run = runCodexCli, temporaryDirectory = os.tmpdir() }) {
  return Effect.gen(function* () {
    if (!repoRoot) return yield* Effect.fail(new Error("Codex CLI 读取器需要项目根目录。"));
    const cliConfig = config.analysis?.codex_cli ?? {};
    const executable = cliConfig.executable ?? "codex";
    const model = typeof cliConfig.model === "string" && cliConfig.model.trim() ? cliConfig.model.trim() : null;
    const reasoningEffort =
      typeof cliConfig.reasoning_effort === "string" && cliConfig.reasoning_effort.trim()
        ? cliConfig.reasoning_effort.trim()
        : null;
    const requestTimeoutMilliseconds = cliConfig.request_timeout_ms ?? config.analysis?.request_timeout_ms ?? 240000;
    return {
      modelConfig: { model: model ?? "default", provider: "codex-cli" },
      prompt(prompt, { imagePaths = [] } = {}) {
        return Effect.scoped(
          Effect.gen(function* () {
            const directory = yield* Effect.acquireRelease(
              io("analysis.temp", () => mkdtemp(path.join(temporaryDirectory, "analysis-codex-"))),
              (directory) =>
                io("analysis.cleanup", () => rm(directory, { force: true, recursive: true })).pipe(Effect.orDie),
            );
            const outputPath = path.join(directory, "response.md");
            const args = [
              "exec",
              "--ephemeral",
              "-s",
              "read-only",
              "-C",
              repoRoot,
              "--output-last-message",
              outputPath,
            ];
            if (model) args.push("--model", model);
            if (reasoningEffort) args.push("--config", `model_reasoning_effort=${JSON.stringify(reasoningEffort)}`);
            if (imagePaths.length > 0) args.push("--image", ...imagePaths);
            args.push("-");
            const input = `${prompt}\n\n你正在作为受限的文本转换器运行。只输出请求中要求的最终 Markdown 或一句话简介；不要调用工具、不要解释过程、不要修改任何文件。`;
            yield* withModelTimeout(
              run(executable, args, {
                cwd: repoRoot,
                input,
                maxBuffer: 8 * 1024 * 1024,
                timeoutMilliseconds: Math.max(1000, requestTimeoutMilliseconds - 1000),
              }),
              requestTimeoutMilliseconds,
              { label: "Codex CLI" },
            );
            return (yield* io("analysis.output", () => readFile(outputPath, "utf8"))).trim();
          }),
        );
      },
    };
  });
}
