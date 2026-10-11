// portfolio-project CLI：参数校验拒绝未知/缺值参数，--help 不触发发布；
// 种子引导只补缺、不覆盖本机原始副本。

import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Effect } from "effect";

import { bootstrapPortfolioSeeds } from "../scripts/lib/portfolio-seeds.mjs";
import { publishPortfolio } from "../modules/portfolio/project.mjs";
import { openDatabase } from "../modules/portfolio/inspora/db.ts";

const script = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../scripts/portfolio-project.mjs",
);

function run(args) {
  return spawnSync(process.execPath, [script, ...args], { encoding: "utf8", timeout: 20000 });
}

test("--help 打印用法且不读取原始输入", () => {
  const result = run(["--help"]);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes("--input-root"), result.stdout);
});

test("--input-root 缺值以退出码 2 拒绝", () => {
  const result = run(["--input-root"]);
  assert.equal(result.status, 2, result.stdout + result.stderr);
  assert.ok(result.stderr.includes("需要一个值"), result.stderr);
});

test("未知参数与位置参数以退出码 2 拒绝", () => {
  for (const args of [["--wat"], ["extra"]]) {
    const result = run(args);
    assert.equal(result.status, 2, result.stdout + result.stderr);
    assert.ok(result.stderr.includes("未知参数"), result.stderr);
  }
});

test("种子引导补齐三个目录文件，且不覆盖已存在的本机副本", async (t) => {
  const inputRoot = mkdtempSync(path.join(tmpdir(), "portfolio-seeds-"));
  t.after(() => rmSync(inputRoot, { recursive: true, force: true }));
  await bootstrapPortfolioSeeds(inputRoot);
  const catalog = JSON.parse(await readFile(path.join(inputRoot, "catalog.json"), "utf8"));
  assert.ok(Array.isArray(catalog) && catalog.length > 0);
  const corrections = JSON.parse(await readFile(path.join(inputRoot, "corrections.json"), "utf8"));
  assert.ok(typeof corrections === "object");
  const tools = JSON.parse(
    await readFile(path.join(inputRoot, "design-engineer-tools/catalog.json"), "utf8"),
  );
  assert.ok(Array.isArray(tools.categories));

  await writeFile(path.join(inputRoot, "catalog.json"), "local override");
  await bootstrapPortfolioSeeds(inputRoot);
  assert.equal(await readFile(path.join(inputRoot, "catalog.json"), "utf8"), "local override");
});

test("只有 inspora.db 的全新输入根目录经种子引导即可完成发布", async (t) => {
  const root = mkdtempSync(path.join(tmpdir(), "portfolio-fresh-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const { db, stmts } = openDatabase(path.join(root, "inspora.db"));
  stmts.upsertPost({
    id: "p1",
    slug: "p-1",
    title: "作品",
    source: "inspora",
    createdAt: "2026-10-01T00:00:00.000Z",
  });
  db.close();
  await bootstrapPortfolioSeeds(root);
  const output = path.join(root, "out");
  mkdirSync(output, { recursive: true });
  const summary = await Effect.runPromise(
    publishPortfolio({
      inputRoot: root,
      outputPath: path.join(output, "portfolio.sqlite"),
      dataDir: path.join(output, "data"),
    }),
  );
  assert.ok(summary.posts >= 1);
  const layouts = JSON.parse(await readFile(path.join(output, "data/layouts.json"), "utf8"));
  assert.ok(Array.isArray(layouts) && layouts.length > 0);
  const tools = JSON.parse(await readFile(path.join(output, "data/tools.json"), "utf8"));
  assert.ok(Array.isArray(tools.categories) && tools.categories.length > 0);
});
