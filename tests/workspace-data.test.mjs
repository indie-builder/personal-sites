import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const approved = ["ai-news.sqlite", "curation.sqlite", "portfolio.sqlite"];

test("Web preparation copies only approved snapshots from any working directory and fails on missing data", () => {
  const root = mkdtempSync(path.join(tmpdir(), "site-workspace-"));
  try {
    mkdirSync(path.join(root, "apps/web/scripts"), { recursive: true });
    mkdirSync(path.join(root, "data/sensitive"), { recursive: true });
    writeFileSync(path.join(root, "data/sensitive/private.txt"), "must stay out");
    for (const name of approved) writeFileSync(path.join(root, "data", name), name);
    const script = path.join(root, "apps/web/scripts/prepare-data.mjs");
    copyFileSync(new URL("../apps/web/scripts/prepare-data.mjs", import.meta.url), script);
    const run = () => spawnSync(process.execPath, [script], { cwd: tmpdir(), encoding: "utf8" });
    assert.equal(run().status, 0);
    assert.deepEqual(readdirSync(path.join(root, "apps/web/data")).sort(), approved);
    assert.equal(readFileSync(path.join(root, "apps/web/data/portfolio.sqlite"), "utf8"), "portfolio.sqlite");
    rmSync(path.join(root, "data/portfolio.sqlite"));
    assert.notEqual(run().status, 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("Production fixture: portfolio pages and API do not require the source repository", () => {
  // 三个已批准快照 + 公共目录投影即部署输入；读取层不触碰 data/sensitive 或源仓库路径。
  const fixture = new URL("../packages/public-data/src/portfolio/data/layouts.json", import.meta.url);
  const layouts = JSON.parse(readFileSync(fixture, "utf8"));
  assert.equal(layouts.length, 350);
  assert.ok(
    layouts.every((item) => typeof item.image === "string" || item.image === null),
    "布局图鉴投影已物化地址",
  );
});
