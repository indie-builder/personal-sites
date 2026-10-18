import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { Effect } from "effect";
import type { AskState } from "../src/lib/ask";
import {
  CHECK, cliVersion, createTools, decodeCli, fixtureState, HAS_TOKEN, INJECT, OWN_DETAIL, RESTORE, smoke, waitFor, type SmokeTools,
} from "../scripts/simulator-smoke";

const temp = await mkdtemp(path.join(os.tmpdir(), "simulator-smoke-test-"));
const argsFile = path.join(temp, "args.json");
afterEach(() => rm(argsFile, { force: true }));

function processOf(stdout: string, code: number, stderr = "") {
  return {
    stdout: new Blob([stdout]).stream(), stderr: new Blob([stderr]).stream(),
    exited: Promise.resolve(code), exitCode: code as number | null, signalCode: null as string | null,
    kill() {},
  };
}

/** 用真实页面对象的字段形态执行模拟器内函数，不复制实现。 */
type FakePage = {
  route: string; controller: { state: AskState } | undefined; cancel?: () => void;
  data: { messages: unknown[]; citation?: boolean; title?: string };
  followLatest: boolean; windowEnd: number;
  __smokeOriginal?: unknown; __smokeToken?: string; __smokeFollowLatest?: boolean; __smokeWindowEnd?: number;
  renderState(state: AskState): void;
};
function fakePage(overrides: Partial<FakePage> = {}) {
  const originalState: AskState = { draft: "真实草稿", scope: "profile", streaming: false, error: "", messages: [{ id: "real", role: "question", text: "真实问题", sources: [], status: "complete", scope: "profile" }] };
  const original = { state: originalState };
  const page: FakePage = {
    route: "pages/ask/index", controller: original, data: { messages: [{ id: "real" }] },
    followLatest: true, windowEnd: 7,
    renderState(state) { this.data.messages = state.messages; },
    ...overrides,
  };
  return { page, original, originalState };
}
const evalSource = (page: FakePage | FakePage[], source: string, args: unknown[] = []) =>
  runInNewContext(`(${source})(...args)`, { getCurrentPages: () => Array.isArray(page) ? page : [page], args });

describe("wechatide responses", () => {
  test("accepts only ok:true JSON without pending tasks", () => {
    expect(decodeCli('{"ok":true,"result":{"success":true}}')).toMatchObject({ ok: true });
    expect(() => decodeCli("not json")).toThrow("非 JSON");
    expect(() => decodeCli('{"ok":false,"errorType":"MCP_TOOL_ERROR","message":"no such element"}')).toThrow("no such element");
    expect(() => decodeCli('{"ok":true,"result":{"taskId":"task-1"}}')).toThrow("待人工授权");
  });

  test("reads the installed skill version from help", () => {
    expect(cliVersion("Skills 目录：/tmp/wechatide-skill  v0.3.9\n")).toBe("0.3.9");
    expect(() => cliVersion("no version")).toThrow("无法");
  });

  test("fails fast on non-JSON and non-zero exit", async () => {
    const nonJson = createTools({ argsFile, spawn: () => processOf("<html>", 0) });
    expect(await Effect.runPromise(Effect.flip(nonJson.call("check_wechatide_status")))).toMatchObject({ message: expect.stringContaining("非 JSON") });
    const failed = createTools({ argsFile, spawn: () => processOf("", 7, "boom") });
    expect(await Effect.runPromise(Effect.flip(failed.call("check_wechatide_status")))).toMatchObject({ message: expect.stringContaining("退出码 7") });
  });

  test("passes source and selector as single arguments and args through a file", async () => {
    const commands: string[][] = [];
    const tools = createTools({ argsFile, spawn: (command) => { commands.push(command); return processOf('{"ok":true,"result":{"success":true,"result":{"result":true}}}', 0); } });
    const source = `function (x) { return "it's $HOME \`quoted\`"; }`;
    expect(await Effect.runPromise(tools.evaluate(source, [fixtureState]))).toBe(true);
    await Effect.runPromise(tools.action("tap", ".ask-ref"));
    expect(commands[0]).toEqual(["wechatide", "-c", "Codex", "automation_evaluate", "--project", path.resolve(import.meta.dir, ".."), "--fn-source", source, "--args-file", argsFile]);
    expect(commands[1]?.at(-1)).toBe(".ask-ref");
    expect(JSON.parse(await readFile(argsFile, "utf8"))).toEqual([fixtureState]);
  });

  test("kills a subprocess that exceeds its timeout", async () => {
    let killed = false;
    let finish = () => {};
    const tools = createTools({ argsFile, spawn: () => ({
      stdout: new Blob([""]).stream(), stderr: new Blob([""]).stream(),
      exited: new Promise<number>((resolve) => { finish = () => resolve(143); }),
      exitCode: null, signalCode: null, kill() { killed = true; finish(); },
    }) });
    expect(await Effect.runPromise(Effect.flip(tools.call("check_wechatide_status", [], 20)))).toMatchObject({ message: expect.stringContaining("超时") });
    expect(killed).toBe(true);
  });
});

describe("suite preconditions", () => {
  test("accepts one idle ask page", () => {
    expect(evalSource(fakePage().page, CHECK)).toBe("");
  });

  test("rejects extra pages, streaming, pending cancel and leftover backups", () => {
    const detail = fakePage({ route: "pages/detail/index" }).page;
    expect(evalSource([fakePage().page, detail], CHECK)).toContain("只保留");
    expect(evalSource(fakePage({ controller: { state: { ...fixtureState, streaming: true } } }).page, CHECK)).toContain("正在生成");
    expect(evalSource(fakePage({ cancel: () => {} }).page, CHECK)).toContain("正在生成");
    expect(evalSource(fakePage({ __smokeOriginal: {} }).page, CHECK)).toContain("未清理");
  });
});

describe("inject and restore", () => {
  test("injects once, then rejects a second injection without touching the backup", () => {
    const { page, original } = fakePage();
    expect(evalSource(page, INJECT, [fixtureState, "run-1"])).toBe(true);
    expect(page.__smokeOriginal).toBe(original);
    expect(page.__smokeToken).toBe("run-1");
    expect(page.__smokeFollowLatest).toBe(true);
    expect(page.__smokeWindowEnd).toBe(7);
    expect(page.followLatest).toBe(true);
    expect(page.windowEnd).toBe(0);
    expect(page.data.messages).toHaveLength(2);
    expect(() => evalSource(page, INJECT, [{ ...fixtureState, draft: "覆盖" }, "run-2"])).toThrow("拒绝重复注入");
    expect(page.__smokeOriginal).toBe(original);
    expect(page.__smokeToken).toBe("run-1");
  });

  test("refuses historical reading without changing its controller or position", () => {
    const { page, original } = fakePage({ followLatest: false });
    expect(evalSource(page, CHECK)).toContain("历史消息");
    expect(() => evalSource(page, INJECT, [fixtureState, "run-1"])).toThrow("历史消息");
    expect(page.controller).toBe(original);
    expect(page.followLatest).toBe(false);
    expect(page.windowEnd).toBe(7);
    expect(page.__smokeOriginal).toBeUndefined();
  });

  test("rejects injection while a real answer streams", () => {
    const { page } = fakePage({ controller: { state: { ...fixtureState, streaming: true } } });
    const controller = page.controller;
    expect(() => evalSource(page, INJECT, [fixtureState, "run-1"])).toThrow("正在");
    expect(page.controller).toBe(controller);
    expect(page.__smokeOriginal).toBeUndefined();
  });

  test("restores the original controller and reading window for the same run only", () => {
    const { page, original, originalState } = fakePage();
    evalSource(page, INJECT, [fixtureState, "run-1"]);
    expect(evalSource(page, RESTORE, ["other-run"])).toBe(false);
    expect(page.controller).not.toBe(original);
    expect(evalSource(page, RESTORE, ["run-1"])).toBe(true);
    expect(page.controller).toBe(original);
    expect(page.followLatest).toBe(true);
    expect(page.windowEnd).toBe(7);
    expect(page.__smokeOriginal).toBeUndefined();
    expect(page.__smokeToken).toBeUndefined();
    expect(page.data.messages).toEqual(originalState.messages);
    expect(evalSource(page, RESTORE, ["run-1"])).toBe(false);
  });
});

function fakeTools(overrides: Partial<SmokeTools> = {}): SmokeTools & { calls: string[]; cleanup: string[] } {
  const calls: string[] = [];
  const cleanup: string[] = [];
  const base: SmokeTools = {
    root: "/tmp/project", screenshotPath: "/tmp/project/.turbo/smoke.jpg",
    version: Effect.succeed("0.3.9"),
    call: (tool) => {
      calls.push(tool);
      return Effect.succeed(tool === "check_wechatide_status"
        ? { ok: true, result: { success: true, loginExpired: false, loginUser: "account", tokenRequired: false } }
        : { ok: true, result: { success: true } });
    },
    evaluate: (source) => {
      calls.push(source);
      if (source === RESTORE) cleanup.push("restore");
      if (source === HAS_TOKEN) cleanup.push("has-token");
      if (source === OWN_DETAIL) cleanup.push("own-detail");
      return Effect.succeed(source === CHECK ? "" : true);
    },
    action: (_action, selector) => { calls.push(selector); return Effect.succeed(selector === ".detail-title" ? "【冒烟】合成资料" : 1); },
    navigate: (action) => { calls.push(action); return Effect.void; },
    screenshot: () => { calls.push("screenshot"); return Effect.void; },
  };
  return Object.assign(base, overrides, { calls, cleanup });
}

const runSmoke = async (tools: SmokeTools) => {
  const logs: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => { logs.push(args.join(" ")); };
  try {
    const exit = await Effect.runPromiseExit(smoke(tools));
    return { exit, logs };
  } finally { console.log = original; }
};

describe("smoke flow", () => {
  test("passes and logs after restoring the real controller", async () => {
    const tools = fakeTools();
    const { exit, logs } = await runSmoke(tools);
    expect(exit._tag).toBe("Success");
    expect(tools.cleanup.slice(-3)).toEqual(["has-token", "own-detail", "restore"]);
    expect(tools.calls).toContain("navigateBack");
    expect(logs.some((line) => line.includes("模拟器冒烟通过"))).toBe(true);
  });

  test("does not clean up or navigate when login fails early", async () => {
    const tools = fakeTools({
      call: () => Effect.succeed({ ok: true, result: { success: true, loginExpired: true, loginUser: "account" } }),
    });
    const { exit, logs } = await runSmoke(tools);
    expect(exit._tag).toBe("Failure");
    expect(tools.calls).not.toContain("navigateBack");
    expect(tools.cleanup).toEqual([]);
    expect(logs.some((line) => line.includes("通过"))).toBe(false);
  });

  test("refuses a not-applicable page before injecting", async () => {
    const tools = fakeTools({ evaluate: (source) => Effect.succeed(source === CHECK ? "请先在模拟器中手动打开问一问页面" : true) });
    const { exit } = await runSmoke(tools);
    expect(exit._tag).toBe("Failure");
    expect(tools.calls).not.toContain(INJECT);
    expect(tools.cleanup).toEqual([]);
  });

  test("stops on the first CLI error instead of retrying", async () => {
    const sources: string[] = [];
    const tools = fakeTools({
      evaluate: (source) => {
        sources.push(source);
        return source === CHECK ? Effect.succeed("") : Effect.fail(new Error("wechatide 退出码 1"));
      },
    });
    const { exit } = await runSmoke(tools);
    expect(exit._tag).toBe("Failure");
    expect(sources).toEqual([CHECK, INJECT, HAS_TOKEN]);
  });

  test("waitFor propagates a CLI error immediately", async () => {
    let calls = 0;
    const tools = fakeTools({ evaluate: () => { calls++; return Effect.fail(new Error("CLI 失败")); } });
    const error = await Effect.runPromise(Effect.flip(waitFor(tools, CHECK, 5_000, "未就绪")));
    expect(error.message).toBe("CLI 失败");
    expect(calls).toBe(1);
  });

  test("fails when restore reports false, with no pass log", async () => {
    const tools = fakeTools();
    tools.evaluate = (source) => {
      tools.calls.push(source);
      if (source === RESTORE) { tools.cleanup.push("restore"); return Effect.succeed(false); }
      if (source === HAS_TOKEN) tools.cleanup.push("has-token");
      if (source === OWN_DETAIL) tools.cleanup.push("own-detail");
      return Effect.succeed(source === CHECK ? "" : true);
    };
    const { exit, logs } = await runSmoke(tools);
    expect(exit._tag).toBe("Failure");
    expect(logs.some((line) => line.includes("通过"))).toBe(false);
  });

  test("fails when restore throws, keeping the original failure", async () => {
    const tools = fakeTools({
      action: (_action, selector) => Effect.succeed(selector === ".detail-title" ? "错误标题" : 1),
    });
    const original = tools.evaluate;
    tools.evaluate = (source) => {
      if (source === RESTORE) { tools.cleanup.push("restore"); return Effect.fail(new Error("恢复失败")); }
      return original(source);
    };
    const { exit, logs } = await runSmoke(tools);
    expect(exit._tag).toBe("Failure");
    expect(logs.some((line) => line.includes("通过"))).toBe(false);
  });

  test("does not navigate back over a page that is not this run's citation", async () => {
    let ownership = 0;
    const tools = fakeTools({
      action: (_action, selector) => Effect.succeed(selector === ".detail-title" ? "错误标题" : 1),
    });
    tools.evaluate = (source) => {
      tools.calls.push(source);
      if (source === CHECK) return Effect.succeed("");
      // 等待时确认是本次引用页；标题失败后清理再查，页面已不是本次的引用页。
      if (source === OWN_DETAIL) return Effect.succeed(++ownership === 1);
      if (source === HAS_TOKEN) return Effect.succeed(true);
      return Effect.succeed(true);
    };
    const { exit } = await runSmoke(tools);
    expect(exit._tag).toBe("Failure");
    expect(tools.calls).not.toContain("navigateBack");
    expect(tools.calls).toContain(RESTORE);
  });

  test("restores when cancellation happens during injection with an unknown result", async () => {
    const tools = fakeTools();
    let injected = false;
    tools.evaluate = (source) => {
      tools.calls.push(source);
      if (source === CHECK) return Effect.succeed("");
      if (source === INJECT) { injected = true; return Effect.fail(new Error("调用被取消")); }
      if (source === HAS_TOKEN) { tools.cleanup.push("has-token"); return Effect.succeed(injected); }
      if (source === OWN_DETAIL) { tools.cleanup.push("own-detail"); return Effect.succeed(false); }
      if (source === RESTORE) { tools.cleanup.push("restore"); return Effect.succeed(true); }
      return Effect.succeed(true);
    };
    const { exit } = await runSmoke(tools);
    expect(exit._tag).toBe("Failure");
    expect(tools.cleanup.slice(-3)).toEqual(["has-token", "own-detail", "restore"]);
    expect(tools.calls).not.toContain("navigateBack");
  });
});
