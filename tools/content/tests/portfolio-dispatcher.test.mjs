// portfolio-sync 调度器：模块路径解析、-- 分隔符剔除与 --help 非变更语义。

import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const script = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../scripts/portfolio-sync.mjs",
);

function run(args) {
  return spawnSync(process.execPath, [script, ...args], { encoding: "utf8", timeout: 20000 });
}

test("--help 打印用法且退出码为 0", () => {
  const result = run(["--help"]);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes("用法：portfolio-sync.mjs"), result.stdout);
});

test("未知目标以退出码 1 拒绝", () => {
  const result = run(["bogus"]);
  assert.equal(result.status, 1);
  assert.ok(result.stderr.includes("用法："), result.stderr);
});

test("模块路径解析到 ../modules 且透传时剔除字面 --（avatars -- --help 到达模块）", () => {
  const result = run(["avatars", "--", "--help"]);
  assert.equal(result.status, 0, result.stderr);
  // --help 由模块自身打印；若 -- 未剔除，模块会把 -- 当作压缩包路径报 Usage 错。
  assert.ok(result.stdout.includes("young-avatars-20.zip"), result.stdout + result.stderr);
});

test("未知透传参数由模块负责拒绝", () => {
  const result = run(["layouts", "--bogus"]);
  assert.equal(result.status, 2, result.stdout + result.stderr);
});
