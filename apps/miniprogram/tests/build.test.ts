import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import { Deferred, Effect, Fiber } from "effect";
import { io } from "@site/effect";
import { stagingDirectory } from "../scripts/build";
import { compilerProcess } from "../scripts/check-templates";
import { createAppService } from "../scripts/e2e/app-service";
import { packageFiles, root, routes, verifyPackage } from "../scripts/e2e/package";

// Reuse the repository lint tool's installed parser instead of matching JavaScript text.
const { parseSync } = createRequire(import.meta.resolve("@shadcn/lint"))("oxc-parser");

const source = path.join(root, "src");
const build = readFileSync(path.join(root, "scripts/build.ts"), "utf8");

describe("public miniprogram build contract", () => {
  test("declares seven complete native routes and four tab destinations", () => {
    const app = JSON.parse(readFileSync(path.join(source, "app.json"), "utf8"));
    expect([...app.pages].sort()).toEqual([...routes].sort());
    expect(app.tabBar.list.map((tab: { pagePath: string }) => tab.pagePath)).toEqual([
      "pages/home/index", "pages/ask/index", "pages/portfolio/index", "pages/about/index",
    ]);
    for (const route of app.pages) {
      expect(route).toMatch(/^pages\/[a-z-]+\/index$/);
      for (const extension of ["ts", "json", "wxml", "wxss"]) {
        expect(existsSync(path.join(source, `${route}.${extension}`))).toBe(true);
      }
    }
    const project = JSON.parse(readFileSync(path.join(root, "project.config.json"), "utf8"));
    expect(project.miniprogramRoot).toBe("dist/");
    expect(project.setting.urlCheck).toBe(true);
    // The build targets WeChat directly; its ES5 lowering breaks native BigInt exponentiation.
    expect(project.setting.es6).toBe(false);
    expect(project.setting.enhance).toBe(false);
    expect(project.setting.minified).toBe(false);
  });

  test("copies only declared native resources and the approved public avatar", () => {
    verifyPackage();
    for (const route of routes) {
      for (const extension of ["json", "wxml", "wxss"]) {
        const name = `${route}.${extension}`;
        expect(readFileSync(path.join(root, "dist", name))).toEqual(readFileSync(path.join(source, name)));
      }
    }
    for (const name of ["app.json", "app.wxss", "theme.json", "sitemap.json",
      ...["home", "ask", "portfolio", "about"].flatMap((name) => ["muted", "light", "dark"].map((tone) => `assets/navigation/${name}-${tone}.png`))]) {
      expect(readFileSync(path.join(root, "dist", name))).toEqual(readFileSync(path.join(source, name)));
    }
    expect(readFileSync(path.join(root, "dist/assets/avatar.png"))).toEqual(readFileSync(path.join(root, "../../ios/ChenYuanSite/Assets.xcassets/profile_avatar.imageset/profile_avatar.png")));
    expect(build).not.toMatch(/process\.env\.(?!NODE_ENV)|Bun\.env/);
  });

  test("interruption removes staging files and kills and reaps the compiler", async () => {
    await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
      const ready = yield* Deferred.make<{ directory: string; child: Bun.Subprocess<"ignore", "pipe", "pipe"> }>();
      const worker = yield* Effect.gen(function* () {
        const directory = yield* stagingDirectory;
        const child = yield* compilerProcess([process.execPath, "-e", 'console.log("ready"); setInterval(() => {}, 1000)']);
        yield* io("test.compiler.ready", () => child.stdout.getReader().read());
        yield* Deferred.succeed(ready, { directory, child });
        yield* Effect.never;
      }).pipe(Effect.scoped, Effect.forkScoped);
      const { directory, child } = yield* Deferred.await(ready);
      expect(existsSync(directory)).toBe(true);
      expect(child.exitCode).toBeNull();
      yield* Fiber.interrupt(worker);
      expect(existsSync(directory)).toBe(false);
      expect(child.signalCode).toBe("SIGKILL");
      expect(yield* io("test.compiler.reaped", () => child.exited)).not.toBe(0);
    })));
  });

  test("externalizes the shared runtime and bootstraps codecs before Effect", () => {
    expect(build).toContain('["../../lib/runtime", "../lib/runtime"]');
    expect(build).toContain('require("../encoding.js");');
    expect(build).toContain('require("./encoding.js");');
    for (const route of routes) {
      const script = readFileSync(path.join(source, `${route}.ts`), "utf8");
      expect(script).not.toMatch(/from\s+["'](?:effect(?:\/[^"']*)?|@site\/effect(?:\/[^"']*)?)["']/);
    }
  });

  test("all emitted JavaScript lowers optional/nullish syntax, logical assignments, and class fields", () => {
    for (const name of packageFiles(path.join(root, "dist")).filter((name) => name.endsWith(".js"))) {
      const code = readFileSync(path.join(root, "dist", name), "utf8");
      const parsed = parseSync(name, code);
      expect(parsed.errors, name).toEqual([]);
      const pending = [parsed.program];
      const unsupported: string[] = [];
      for (const node of pending) {
        if (!node || typeof node !== "object") continue;
        if (["ChainExpression", "PropertyDefinition", "PrivateIdentifier", "StaticBlock"].includes(node.type)) unsupported.push(node.type);
        if (["??", "??=", "&&=", "||="].includes(node.operator)) unsupported.push(node.operator);
        for (const value of Object.values(node)) {
          if (value && typeof value === "object") pending.push(...(Array.isArray(value) ? value : [value]));
        }
      }
      expect(unsupported, name).toEqual([]);
    }
  });

  test("emitted package has no unapproved files, secret material, or size overflow (run build first)", () => {
    expect(() => verifyPackage()).not.toThrow();
  });

  test("tab switches cache instances, unload detail stacks, and run lifecycle callbacks once per transition", () => {
    const harness = createAppService();
    const calls: string[] = [];
    for (const name of ["home", "ask", "detail", "collection"]) {
      harness.definitions.set(`pages/${name}/index`, {
        data: { draft: "" },
        onLoad() { calls.push(`${name}:load`); },
        onReady() { calls.push(`${name}:ready`); },
        onShow() { calls.push(`${name}:show`); },
        onHide() { calls.push(`${name}:hide`); },
        onUnload() { calls.push(`${name}:unload`); },
      });
    }
    try {
      const home = harness.wx.switchTab({ url: "/pages/home/index" });
      home.setData({ draft: "保留草稿" });
      harness.wx.navigateTo({ url: "/pages/detail/index" });
      harness.wx.navigateTo({ url: "/pages/collection/index" });
      const ask = harness.wx.switchTab({ url: "/pages/ask/index" });
      expect(harness.stack).toEqual([ask]);
      expect(harness.wx.switchTab({ url: "/pages/home/index" })).toBe(home);
      expect(home.data.draft).toBe("保留草稿");
      expect(harness.stack).toEqual([home]);
      expect(harness.wx.switchTab({ url: "/pages/ask/index" })).toBe(ask);
      expect(calls).toEqual([
        "home:load", "home:show", "home:ready", "home:hide",
        "detail:load", "detail:show", "detail:ready", "detail:hide",
        "collection:load", "collection:show", "collection:ready", "collection:hide",
        "collection:unload", "detail:unload", "ask:load", "ask:show", "ask:ready",
        "ask:hide", "home:show", "home:hide", "ask:show",
      ]);
    } finally {
      harness.close();
    }
    for (const name of ["home", "ask", "detail", "collection"]) {
      expect(calls.filter((call) => call === `${name}:unload`)).toHaveLength(1);
    }
    expect(harness.stack).toHaveLength(0);
  });

  test("built shared runtime initializes once without injected browser APIs (run build first)", () => {
    const harness = createAppService();
    try {
      for (const name of ["fetch", "URL", "TextEncoder", "TextDecoder", "AbortController"]) {
        expect(vm.runInContext(`typeof ${name}`, harness.context)).toBe("undefined");
      }
      // Math.pow only accepts numbers; fail if any transformed Effect path passes it a bigint.
      vm.runInContext(`
        const numberPow = Math.pow;
        Math.pow = (base, exponent) => {
          if (typeof base === "bigint" || typeof exponent === "bigint") throw new Error("BigInt lowered to Math.pow");
          return numberPow(base, exponent);
        };
      `, harness.context);
      const first = harness.load("lib/runtime.js");
      const value = first.Schema.decodeUnknownSync(first.Schema.BigIntFromString)("9223372036854775807");
      expect(value).toBe(9223372036854775807n);
      expect(first.Schema.encodeSync(first.Schema.BigIntFromString)(value)).toBe("9223372036854775807");
      const decimal = first.Schema.decodeUnknownSync(first.Schema.BigDecimalFromString)("12345678901234567890.123456789");
      expect(first.Schema.encodeSync(first.Schema.BigDecimalFromString)(decimal)).toBe("12345678901234567890.123456789");
      expect(harness.load("lib/runtime.js")).toBe(first);
      expect(harness.loads.get("lib/runtime.js")).toBe(1);
      for (const name of ["fetch", "URL", "AbortController"]) {
        expect(vm.runInContext(`typeof ${name}`, harness.context)).toBe("undefined");
      }
      expect(vm.runInContext('new TextDecoder().decode(new TextEncoder().encode("公开资料 👋"))', harness.context)).toBe("公开资料 👋");
      expect(harness.requests).toHaveLength(0);
    } finally {
      harness.close();
    }
  });
});
