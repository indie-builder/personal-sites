// 布局图鉴同步程序：单项失败隔离、断点恢复与产物完整性（自 personal-design
// packages/layout-compositions 的入口集成测试移植，改为直接运行导出的程序并注入临时目录）。

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import sharp from "sharp";
import { Effect } from "effect";

import { runLayoutSync } from "../modules/portfolio/layouts/sync.ts";

function captureLogs(t) {
  const lines = [];
  for (const method of ["log", "warn"]) {
    t.mock.method(console, method, (...args) => lines.push(`${method}: ${args.join(" ")}`));
  }
  return lines;
}

const summary = (lines) => lines.find((line) => line.includes("[sync] 完成:"));

async function runSync(options) {
  return Effect.runPromise(runLayoutSync(options));
}

test("程序隔离单项失败，完成后续条目并汇总，支持高清图和增量恢复", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "layout-sync-"));
  const seedDir = path.join(root, "seed");
  const upstreamDir = path.join(root, "upstream");
  const repo = path.join(upstreamDir, "extracted/repo");
  const out = path.join(root, "out/layout-compositions");
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(seedDir, { recursive: true });
  await mkdir(repo, { recursive: true });
  // 大于 1MB 的占位 tarball 跳过真实下载。
  await writeFile(path.join(upstreamDir, "repo.tar.gz"), Buffer.alloc(1024 * 1024 + 1));
  await sharp({ create: { width: 8, height: 8, channels: 3, background: "white" } })
    .png()
    .toFile(path.join(repo, "source.png"));
  const items = Array.from({ length: 11 }, (_, index) => ({
    id: String(index + 1).padStart(3, "0"),
    name: `布局 ${index + 1}`,
    category_slug: "category",
    image: "source.png",
    thumbnail: "unused.jpg",
    sha256: index === 0 ? "incorrect hash" : "",
  }));
  await writeFile(path.join(seedDir, "catalog.json"), JSON.stringify(items));
  await writeFile(
    path.join(seedDir, "corrections.json"),
    JSON.stringify({ "010": { missing: true } }),
  );
  const thumbs = path.join(out, "thumbnails/category");
  await mkdir(thumbs, { recursive: true });
  await writeFile(path.join(thumbs, "011.webp"), "existing thumbnail");

  const lines = captureLogs(t);
  await assert.rejects(
    runSync({ seedDir, upstreamDir, outBase: out }),
    (error) => /1 条转换失败/.test(error.message),
  );
  assert.match(summary(lines), /新转换 8，跳过 1，上游缺失 1，失败 1/);
  assert.ok(lines.some((line) => line.includes("进度 11/11")), lines.join("\n"));
  assert.ok(
    lines.some((line) => line.includes("001") && line.includes("sha256 校验失败")),
    lines.join("\n"),
  );
  assert.equal((await sharp(path.join(thumbs, "009.webp")).metadata()).format, "webp");
  assert.equal(await readFile(path.join(thumbs, "011.webp"), "utf8"), "existing thumbnail");
  assert.deepEqual((await readdir(out)).sort(), ["images", "thumbnails"]);
  assert.deepEqual(await readdir(path.join(out, "images/category")), []);
  assert.equal((await readdir(thumbs)).filter((name) => name.endsWith(".part")).length, 0);

  const withImagesLines = captureLogs(t);
  await assert.rejects(
    runSync({ seedDir, upstreamDir, outBase: out, withImages: true }),
    (error) => /1 条转换失败/.test(error.message),
  );
  assert.match(summary(withImagesLines), /新转换 9，跳过 0，上游缺失 1，失败 1/);
  assert.equal((await sharp(path.join(out, "images/category/009.webp")).metadata()).width, 8);
  assert.equal((await readdir(path.join(out, "images/category"))).length, 9);

  items[0].sha256 = createHash("sha256")
    .update(await readFile(path.join(repo, "source.png")))
    .digest("hex");
  await writeFile(path.join(seedDir, "catalog.json"), JSON.stringify(items));
  const recoveredLines = captureLogs(t);
  await runSync({ seedDir, upstreamDir, outBase: out, withImages: true });
  assert.match(summary(recoveredLines), /新转换 1，跳过 9，上游缺失 1，失败 0/);
  assert.equal((await sharp(path.join(thumbs, "001.webp")).metadata()).format, "webp");

  const repeatedLines = captureLogs(t);
  await runSync({ seedDir, upstreamDir, outBase: out, withImages: true });
  assert.match(summary(repeatedLines), /新转换 0，跳过 10，上游缺失 1，失败 0/);
});

test("corrections 引用不存在的文件时该条目按失败计入，不中断整体", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "layout-sync-corrections-"));
  const seedDir = path.join(root, "seed");
  const upstreamDir = path.join(root, "upstream");
  const repo = path.join(upstreamDir, "extracted/repo");
  const out = path.join(root, "out");
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(seedDir, { recursive: true });
  await mkdir(repo, { recursive: true });
  await writeFile(path.join(upstreamDir, "repo.tar.gz"), Buffer.alloc(1024 * 1024 + 1));
  await sharp({ create: { width: 4, height: 4, channels: 3, background: "white" } })
    .png()
    .toFile(path.join(repo, "source.png"));
  await writeFile(
    path.join(seedDir, "catalog.json"),
    JSON.stringify([
      { id: "001", name: "a", category_slug: "c", image: "source.png", sha256: "" },
      { id: "002", name: "b", category_slug: "c", image: "source.png", sha256: "" },
    ]),
  );
  await writeFile(
    path.join(seedDir, "corrections.json"),
    JSON.stringify({ "001": { v2: "999" } }),
  );
  const lines = captureLogs(t);
  await assert.rejects(
    runSync({ seedDir, upstreamDir, outBase: out }),
    (error) => /1 条转换失败/.test(error.message),
  );
  assert.ok(
    lines.some((line) => line.includes("corrections.json: 001 引用了不存在的文件 999")),
    lines.join("\n"),
  );
  assert.equal((await readdir(path.join(out, "thumbnails/c"))).length, 1);
});
