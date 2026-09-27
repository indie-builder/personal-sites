import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { ModelRuntime } from "@earendil-works/pi-coding-agent";

import { awaitModelResponse as awaitModelResponseWithTimeout, runPiPrompt } from "./model-runner.mjs";
import { resolvePiModelConfig } from "../../lib/pi-runtime.mjs";
import { configureBigModelRuntime } from "../../lib/bigmodel.mjs";

export async function createBigModelReader({ config = {}, env = process.env, repoRoot }) {
  const modelConfig = resolvePiModelConfig({ config, env });
  if (!env.BIGMODEL_API_KEY) throw new Error("缺少 BIGMODEL_API_KEY，无法调用智谱 GLM。");
  const requestTimeoutMilliseconds = config.analysis?.request_timeout_ms ?? 240000;
  const runtime = await ModelRuntime.create({ allowModelNetwork: false });
  await configureBigModelRuntime(runtime, modelConfig.model, env);
  const model = runtime.getModel(modelConfig.provider, modelConfig.model);
  if (!model) throw new Error(`Pi 未找到模型：${modelConfig.provider}/${modelConfig.model}`);

  return {
    modelConfig,
    async prompt(prompt) {
      return runPiPrompt({
        cwd: repoRoot,
        label: "智谱 GLM",
        model,
        prompt,
        runtime,
        timeoutMilliseconds: requestTimeoutMilliseconds,
      });
    },
  };
}

export function runCodexCli(command, args, { cwd, input, maxBuffer = 8 * 1024 * 1024, timeoutMilliseconds } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["pipe", "pipe", "pipe"] });
    const timeoutId = Number.isInteger(timeoutMilliseconds)
      ? setTimeout(() => {
          child.kill("SIGTERM");
          reject(new Error(`Codex CLI 请求超时（${Math.round(timeoutMilliseconds / 1000)} 秒）。`));
        }, timeoutMilliseconds)
      : null;
    let stdout = "";
    let stderr = "";
    const collect = (target) => (chunk) => {
      target.value += chunk.toString();
      if (Buffer.byteLength(target.value, "utf8") > maxBuffer) {
        child.kill("SIGTERM");
        reject(new Error("Codex CLI 输出超过安全缓冲上限。"));
      }
    };
    const output = { value: "" };
    const errors = { value: "" };
    child.stdout.on("data", collect(output));
    child.stderr.on("data", collect(errors));
    child.once("error", (error) => {
      if (timeoutId) clearTimeout(timeoutId);
      reject(error);
    });
    child.once("close", (code) => {
      if (timeoutId) clearTimeout(timeoutId);
      stdout = output.value;
      stderr = errors.value;
      if (code === 0) resolve({ stderr, stdout });
      else reject(new Error(`Codex CLI 退出码 ${code ?? "未知"}：${stderr.trim() || stdout.trim() || "未返回错误详情"}`));
    });
    child.stdin.end(input);
  });
}

/**
 * Codex CLI reader. It deliberately mirrors the Pi reader's prompt
 * contract so all translation validation and local persistence stay shared.
 * It is only constructed when the caller explicitly selects `codex-cli`.
 */
function resolveZcodeCliCommand(env = process.env) {
  if (env.ZCODE_CLI) return env.ZCODE_CLI;
  if (env.CLAUDE_CLI) return env.CLAUDE_CLI;
  return "claude";
}

/**
 * ZCode CLI reader。经由用户配置了 ZCode/智谱模型端点的 Claude Code CLI
 * （`claude -p`）无头执行提示词并取回 stdout 应答文本。
 */
export function createZcodeCliReader({ config = {}, env = process.env, repoRoot, run = runCodexCli, timeoutMilliseconds } = {}) {
  const requestTimeoutMilliseconds = timeoutMilliseconds ?? config.analysis?.request_timeout_ms ?? 240000;
  const command = resolveZcodeCliCommand(env);
  return {
    modelConfig: { model: config.analysis?.zcode?.model ?? env.ANTHROPIC_MODEL ?? "zcode-configured", provider: "zcode" },
    async prompt(prompt, { imagePaths = [] } = {}) {
      const text = imagePaths.length > 0
        ? `${prompt}\n\n请先逐一读取以下本地图片再作答，结论必须用到图片内容：${imagePaths.join(" ")}`
        : prompt;
      const { stdout } = await awaitModelResponseWithTimeout(
        run(command, ["-p", text], { cwd: repoRoot, input: "" }),
        requestTimeoutMilliseconds,
        { label: "ZCode" },
      );
      return stdout.trim();
    },
  };
}

export async function createCodexCliReader({ config = {}, repoRoot, run = runCodexCli, temporaryDirectory = os.tmpdir() }) {
  if (!repoRoot) throw new Error("Codex CLI 读取器需要项目根目录。");
  const cliConfig = config.analysis?.codex_cli ?? {};
  const executable = cliConfig.executable ?? "codex";
  const model = typeof cliConfig.model === "string" && cliConfig.model.trim() ? cliConfig.model.trim() : null;
  const reasoningEffort = typeof cliConfig.reasoning_effort === "string" && cliConfig.reasoning_effort.trim()
    ? cliConfig.reasoning_effort.trim()
    : null;
  const requestTimeoutMilliseconds = cliConfig.request_timeout_ms ?? config.analysis?.request_timeout_ms ?? 240000;

  return {
    modelConfig: { model: model ?? "default", provider: "codex-cli" },
    async prompt(prompt, { imagePaths = [] } = {}) {
      const directory = await mkdtemp(path.join(temporaryDirectory, "analysis-codex-"));
      const outputPath = path.join(directory, "response.md");
      const args = ["exec", "--ephemeral", "-s", "read-only", "-C", repoRoot, "--output-last-message", outputPath];
      if (model) args.push("--model", model);
      if (reasoningEffort) args.push("--config", `model_reasoning_effort=${JSON.stringify(reasoningEffort)}`);
      if (imagePaths.length > 0) args.push("--image", ...imagePaths);
      args.push("-");
      const input = `${prompt}\n\n你正在作为受限的文本转换器运行。只输出请求中要求的最终 Markdown 或一句话简介；不要调用工具、不要解释过程、不要修改任何文件。`;
      try {
        await awaitModelResponseWithTimeout(
          run(executable, args, {
            cwd: repoRoot,
            input,
            maxBuffer: 8 * 1024 * 1024,
            timeoutMilliseconds: Math.max(1000, requestTimeoutMilliseconds - 1000),
          }),
          requestTimeoutMilliseconds,
          { label: "Codex CLI" },
        );
        return (await readFile(outputPath, "utf8")).trim();
      } finally {
        await rm(directory, { force: true, recursive: true });
      }
    },
  };
}
