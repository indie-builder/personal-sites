import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createAppService, root, routes, verifyPackage } from "../scripts/e2e";

const source = path.join(root, "src");
const build = readFileSync(path.join(root, "scripts/build.ts"), "utf8");
const built = existsSync(path.join(root, "dist/lib/runtime.js"));

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
  });

  test("copies only declared native resources and the approved public avatar", () => {
    // Enforce the copy boundary even before dist exists; emitted files receive an exact whitelist check below.
    const copies = [...build.matchAll(/await cp\(([^;]+)\);/g)].map((match) => match[1]);
    expect(copies).toHaveLength(3);
    expect(copies[0]).toContain('`${page}.${extension}`');
    expect(build).toMatch(/for \(const extension of \["json", "wxml", "wxss"\]\)/);
    expect(copies[1]).toContain('path.join(source, name)');
    expect(build).toContain('["app.json", "app.wxss", "theme.json", "sitemap.json"]');
    expect(copies[2]).toContain("Assets.xcassets/profile_avatar.imageset/profile_avatar.png");
    expect(copies.join("\n")).not.toMatch(/recursive|sensitive|\.env|sqlite|smaug|credentials/);
    expect(build).toContain('env: "disable"');
    expect(build).not.toMatch(/process\.env|Bun\.env/);
    expect(build).toMatch(/maximumBytes\s*=\s*2\s*\*\s*1024\s*\*\s*1024/);
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

  test.skipIf(!built)("emitted package has no unapproved files, secret material, or size overflow (run build first)", () => {
    expect(() => verifyPackage()).not.toThrow();
  });

  test.skipIf(!built)("tab switches cache instances, unload detail stacks, and run lifecycle callbacks once per transition", () => {
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

  test.skipIf(!built)("built shared runtime initializes once without injected browser APIs (run build first)", () => {
    const harness = createAppService();
    try {
      for (const name of ["fetch", "URL", "TextEncoder", "TextDecoder", "AbortController"]) {
        expect(vm.runInContext(`typeof ${name}`, harness.context)).toBe("undefined");
      }
      const first = harness.load("lib/runtime.js");
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
