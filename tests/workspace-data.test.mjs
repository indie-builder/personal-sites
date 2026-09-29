import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

test("Web preparation copies only approved snapshots from any working directory and fails on missing data", () => {
  const root = mkdtempSync(path.join(tmpdir(), "site-workspace-"));
  try {
    mkdirSync(path.join(root, "apps/web/scripts"), { recursive: true });
    mkdirSync(path.join(root, "data/sensitive"), { recursive: true });
    writeFileSync(path.join(root, "data/sensitive/private.txt"), "must stay out");
    for (const name of ["curation.sqlite", "ai-news.sqlite"]) writeFileSync(path.join(root, "data", name), name);
    const script = path.join(root, "apps/web/scripts/prepare-data.mjs");
    copyFileSync(new URL("../apps/web/scripts/prepare-data.mjs", import.meta.url), script);
    const run = () => spawnSync(process.execPath, [script], { cwd: tmpdir(), encoding: "utf8" });
    assert.equal(run().status, 0);
    assert.deepEqual(readdirSync(path.join(root, "apps/web/data")).sort(), ["ai-news.sqlite", "curation.sqlite"]);
    assert.equal(readFileSync(path.join(root, "apps/web/data/ai-news.sqlite"), "utf8"), "ai-news.sqlite");
    rmSync(path.join(root, "data/ai-news.sqlite"));
    assert.notEqual(run().status, 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
