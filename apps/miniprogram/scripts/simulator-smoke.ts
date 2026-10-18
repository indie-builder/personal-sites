import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Duration, Effect, Exit, Option } from "effect";
import { attempt, io } from "@site/effect";
import { runCli } from "@site/effect/cli";
import type { AskState } from "../src/lib/ask";

const root = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const screenshotPath = path.join(root, ".turbo", "simulator-smoke.jpg");
const ASK = "pages/ask/index";

/** 合成夹具只在内存和模拟器视图中存在，不经过网络。 */
export const fixtureState: AskState = {
  draft: "", scope: "all", streaming: false, error: "",
  messages: [
    { id: "smoke-question", role: "question", text: "【冒烟】合成问题", sources: [], status: "complete", scope: "all" },
    {
      id: "smoke-answer", role: "answer", status: "complete", scope: "all",
      text: "这是【冒烟】合成回答【1】，仅用于模拟器验证。",
      sources: [{
        id: "smoke-source", title: "【冒烟】合成资料", content: "【冒烟】合成引用正文，不对应任何真实会话。",
        sourceUrl: "https://example.com/smoke", scope: "all", section: null, publishedAt: "2026-10-18",
      }],
    },
  ],
};

type SmokeController = { state: AskState; stop(): void; send(): void; retry(): void; reset(): void; setDraft(value: string): void; setScope(value: string): void };
type SmokePage = {
  route: string;
  controller: SmokeController;
  renderState(state: AskState): void;
  data: { messages: unknown[]; citation?: boolean; title?: string };
  followLatest: boolean;
  windowEnd: number;
  cancel?: (() => void) | undefined;
  __smokeOriginal?: SmokeController;
  __smokeToken?: string;
  __smokeFollowLatest?: boolean;
  __smokeWindowEnd?: number;
};

/** 不自动打开或切换页面：运行前由人手动打开一个空闲、唯一的问一问页面。 */
export const CHECK = `function () {
  const pages = getCurrentPages();
  if (pages.length !== 1) return "运行前请只保留问一问一个页面（当前页面栈 " + pages.length + " 页）";
  const page = /** @type {any} */ (pages[0]);
  if (page?.route !== "${ASK}") return "请先在模拟器中手动打开问一问页面";
  if (typeof page.renderState !== "function" || !page.controller) return "问一问页面未就绪";
  if (page.controller.state.streaming || page.cancel) return "问一问正在生成回答；请先停止并等待本轮结束";
  if (page.followLatest === false) return "正在阅读历史消息，请先回到最新位置再运行冒烟";
  if (page.__smokeOriginal || page.__smokeToken) return "检测到未清理的冒烟备份，拒绝再次注入";
  return "";
}`;

export const INJECT = function inject(state: AskState, token: string): boolean {
  const page = getCurrentPages().slice(-1)[0] as unknown as SmokePage;
  if (!page || page.route !== "pages/ask/index" || !page.controller) throw new Error("问一问页面未就绪");
  if (page.__smokeOriginal || page.__smokeToken) throw new Error("检测到未清理的冒烟备份，拒绝重复注入");
  if (page.controller.state.streaming || page.cancel) throw new Error("真实问答正在进行，拒绝冒烟");
  if (page.followLatest === false) throw new Error("正在阅读历史消息，请先回到最新位置再运行冒烟");
  page.__smokeFollowLatest = page.followLatest;
  page.__smokeWindowEnd = page.windowEnd;
  page.__smokeOriginal = page.controller;
  page.__smokeToken = token;
  page.controller = { state, stop() {}, send() {}, retry() {}, reset() {}, setDraft() {}, setScope() {} };
  // 合成会话只看最新两条，与真实控制的阅读窗口无关；恢复时写回备份。
  page.followLatest = true;
  page.windowEnd = 0;
  page.renderState(state);
  return page.data.messages.length === 2;
}.toString();

const HAS_REF = `function () {
  return getCurrentPages().slice(-1)[0]?.route === "${ASK}" && !!getCurrentPages().slice(-1)[0].data.messages.length;
}`;

/** 只认本次标记或本夹具的引用页，避免误退用户原来的详情页。 */
export const OWN_DETAIL = function ownDetail(token: string): boolean {
  const page = getCurrentPages().slice(-1)[0] as unknown as SmokePage;
  if (page?.route !== "pages/detail/index") return false;
  if (page.__smokeToken !== token) {
    if (page.data.citation !== true || page.data.title !== "【冒烟】合成资料") return false;
    page.__smokeToken = token;
  }
  return true;
}.toString();

export const HAS_TOKEN = `function (token) {
  return getCurrentPages().some((page) => page.route === "${ASK}" && page.__smokeToken === token && !!page.__smokeOriginal);
}`;

export const RESTORE = function restore(token: string): boolean {
  const page = (getCurrentPages() as unknown as SmokePage[]).find((item) => item.route === "pages/ask/index");
  if (!page || !page.__smokeOriginal || page.__smokeToken !== token) return false;
  const original = page.__smokeOriginal;
  const followLatest = page.__smokeFollowLatest;
  const windowEnd = page.__smokeWindowEnd;
  // 先清标记再重绘：即使重绘抛错，原 controller 也已归位，不会留下半接管状态。
  delete page.__smokeOriginal;
  delete page.__smokeToken;
  delete page.__smokeFollowLatest;
  delete page.__smokeWindowEnd;
  page.controller = original;
  if (followLatest !== undefined) page.followLatest = followLatest;
  if (windowEnd !== undefined) page.windowEnd = windowEnd;
  // 只重绘原控制器状态，不停止也不发送真实会话。
  page.renderState(original.state);
  return true;
}.toString();

export type SmokeTools = {
  root: string;
  screenshotPath: string;
  version: Effect.Effect<string, Error>;
  call(tool: string, flags?: string[], timeoutMs?: number): Effect.Effect<Record<string, unknown>, Error>;
  evaluate(source: string, args?: unknown[]): Effect.Effect<unknown, Error>;
  action(action: string, selector: string): Effect.Effect<unknown, Error>;
  navigate(action: string, url?: string): Effect.Effect<unknown, Error>;
  screenshot(file: string): Effect.Effect<unknown, Error>;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? value as Record<string, unknown> : {};

/** 先过滤状态字段再输出，避免把 tool 原始结果（含账号）打印到终端。 */
export function decodeCli(stdout: string): Record<string, unknown> {
  let value: unknown;
  try { value = JSON.parse(stdout); } catch { throw new Error("wechatide 返回非 JSON，已停止冒烟"); }
  const response = asRecord(value);
  if (typeof response.ok !== "boolean") throw new Error("wechatide 返回结构异常，已停止冒烟");
  if (!response.ok) {
    const message = typeof response.message === "string" ? response.message : typeof response.errorType === "string" ? response.errorType : "调用失败";
    throw new Error(`wechatide 调用失败：${message}`);
  }
  if (typeof asRecord(response.result).taskId === "string") throw new Error("wechatide 返回待人工授权任务，本冒烟不等待确认");
  return response;
}

export function cliVersion(help: string): string {
  const version = /\bv(\d+\.\d+\.\d+)\b/.exec(help)?.[1];
  if (!version) throw new Error("无法从 wechatide --help 读取 skill 版本");
  return version;
}

type Spawned = {
  stdout: ReadableStream<Uint8Array>;
  stderr: ReadableStream<Uint8Array>;
  exited: Promise<number>;
  exitCode: number | null;
  signalCode: string | number | NodeJS.Signals | null;
  kill(signal?: NodeJS.Signals): void;
};
type Spawn = (command: string[]) => Spawned;

export function createTools(options: { spawn: Spawn; argsFile: string }): SmokeTools {
  const { spawn, argsFile } = options;
  const run = (command: string[], timeoutMs: number) => Effect.scoped(Effect.gen(function* () {
    const child = yield* Effect.acquireRelease(
      attempt("miniprogram.simulator.spawn", () => spawn(command)),
      (process) => Effect.gen(function* () {
        if (process.exitCode === null && process.signalCode === null) yield* attempt("miniprogram.simulator.kill", () => process.kill("SIGKILL"));
        yield* io("miniprogram.simulator.reap", () => process.exited);
      }).pipe(Effect.orDie),
    );
    return yield* Effect.all([
      io("miniprogram.simulator.stdout", () => new Response(child.stdout).text()),
      io("miniprogram.simulator.stderr", () => new Response(child.stderr).text()),
      io("miniprogram.simulator.exit", () => child.exited),
    ], { concurrency: 3 }).pipe(Effect.timeoutOption(Duration.millis(timeoutMs)));
  }));
  const call = (tool: string, flags: string[] = [], timeoutMs = 30_000) =>
    Effect.scoped(Effect.gen(function* () {
      // 超时中断整个作用域，作用域退出时才 kill，因此不会留下挂起的 wechatide。
      const timed = yield* run(["wechatide", "-c", "Codex", tool, ...flags], timeoutMs);
      if (Option.isNone(timed)) return yield* Effect.fail(new Error(`wechatide 超时（${timeoutMs}ms），已终止；pending task 不会继续等待`));
      const [stdout, stderr, code] = timed.value;
      return yield* code === 0
        ? attempt(`miniprogram.simulator.${tool}`, () => decodeCli(stdout))
        : Effect.fail(new Error(`wechatide ${tool} 退出码 ${code}${stderr.trim() ? `：${stderr.trim().slice(0, 300)}` : ""}`));
    }));
  return {
    root, screenshotPath,
    version: Effect.scoped(Effect.gen(function* () {
      const timed = yield* run(["wechatide", "--help"], 10_000);
      if (Option.isNone(timed)) return yield* Effect.fail(new Error("读取 wechatide 版本超时"));
      return yield* attempt("miniprogram.simulator.version", () => cliVersion(timed.value[0]));
    })),
    call,
    evaluate: (source, args = []) => io("miniprogram.simulator.args", () => writeFile(argsFile, JSON.stringify(args)))
      .pipe(Effect.andThen(call("automation_evaluate", ["--project", root, "--fn-source", source, "--args-file", argsFile])), Effect.map((response) => asRecord(asRecord(response.result).result).result)),
    action: (action, selector) => call("automation_element_action", ["--project", root, "--action", action, "--selector", selector]).pipe(Effect.map((response) => response.result)),
    navigate: (action, url) => call("automation_navigate", ["--project", root, "--action", action, ...url ? ["--url", url] : []]).pipe(Effect.asVoid),
    screenshot: (file) => io("miniprogram.simulator.mkdir", () => mkdir(path.dirname(file), { recursive: true }))
      .pipe(Effect.andThen(call("simulator_screenshot", ["--project", root, "--path", file, "--wait-for-selector", ".ask-ref"], 60_000)), Effect.asVoid),
  };
}

/** 只轮询“成功但尚未就绪”；CLI 错误立即传播，总耗时由 Effect 超时封顶。 */
export const waitFor = (tools: SmokeTools, source: string, timeoutMs: number, message: string, args: unknown[] = []) =>
  Effect.gen(function* () {
    const poll = Effect.gen(function* () {
      for (;;) {
        if (yield* tools.evaluate(source, args)) return;
        yield* Effect.sleep(Duration.millis(300));
      }
    });
    const done = yield* Effect.timeoutOption(poll, Duration.millis(timeoutMs));
    if (Option.isNone(done)) return yield* Effect.fail(new Error(message));
  });

export function smoke(tools: SmokeTools): Effect.Effect<void, Error> {
  const token = randomUUID();
  // 只有进入注入阶段才允许清理；登录等早期失败不碰页面栈。
  let attempted = false;
  const cleanup = Effect.gen(function* () {
    if (!attempted) return;
    if ((yield* tools.evaluate(HAS_TOKEN, [token])) !== true) return;
    if ((yield* tools.evaluate(OWN_DETAIL, [token])) === true) yield* tools.navigate("navigateBack");
    if ((yield* tools.evaluate(RESTORE, [token])) !== true) {
      return yield* Effect.fail(new Error("冒烟清理失败：原问答 controller 与阅读位置未恢复"));
    }
  });
  const run = Effect.gen(function* () {
    const status = yield* tools.call("check_wechatide_status", ["--skill-version", yield* tools.version]);
    const info = asRecord(status.result);
    if (info.loginExpired !== false || !info.loginUser) return yield* Effect.fail(new Error("微信开发者工具未登录；请先扫码，脚本不读取或输出账号信息"));
    if (info.tokenRequired === true) return yield* Effect.fail(new Error("wechatide 要求 CLI 令牌；本冒烟不读取凭据，故停止"));
    console.log("微信开发者工具登录有效");
    const reason = yield* tools.evaluate(CHECK);
    if (reason !== "") return yield* Effect.fail(new Error(typeof reason === "string" && reason ? reason : "当前页面不适用冒烟，已拒绝"));
    attempted = true;
    if ((yield* tools.evaluate(INJECT, [fixtureState, token])) !== true) return yield* Effect.fail(new Error("合成问答未能注入"));
    yield* waitFor(tools, HAS_REF, 5_000, "引用标记未出现");
    yield* tools.screenshot(tools.screenshotPath);
    yield* tools.action("tap", ".ask-ref");
    yield* waitFor(tools, OWN_DETAIL, 5_000, "引用资料页未打开", [token]);
    const title = yield* tools.action("text", ".detail-title");
    if (title !== fixtureState.messages[1]!.sources[0]!.title) return yield* Effect.fail(new Error("引用资料页标题与合成资料不一致"));
    yield* tools.action("text", ".citation-notice");
    yield* tools.navigate("navigateBack");
    yield* waitFor(tools, HAS_REF, 5_000, "未能返回问一问");
  });
  return Effect.onExit(run, (exit) => cleanup.pipe(
    Effect.andThen(Exit.isSuccess(exit)
      ? Effect.sync(() => console.log(`模拟器冒烟通过；合成截图 ${tools.screenshotPath}`))
      : Effect.void),
  ));
}

if (import.meta.main) await runCli(Effect.scoped(Effect.gen(function* () {
  if (!Bun.which("wechatide")) return yield* Effect.fail(new Error("未找到 wechatide CLI（command -v wechatide）"));
  const directory = yield* Effect.acquireRelease(
    io("miniprogram.simulator.temp", () => mkdtemp(path.join(os.tmpdir(), "chenyuan-smoke-"))),
    (temp) => io("miniprogram.simulator.cleanup", () => rm(temp, { recursive: true, force: true })).pipe(Effect.orDie),
  );
  const tools = createTools({
    argsFile: path.join(directory, "args.json"),
    spawn: (command) => Bun.spawn(command, { cwd: root, stdin: "ignore", stdout: "pipe", stderr: "pipe" }),
  });
  yield* smoke(tools);
})));
