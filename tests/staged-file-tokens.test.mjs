import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checker = path.join(projectRoot, "scripts/check-staged-file-tokens.mjs");

function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), "staged-file-tokens-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" });
  git("init", "--quiet");
  git("config", "core.hooksPath", ".git/hooks");
  const write = (file, contents) => {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), contents);
  };
  const stage = (file, contents) => {
    write(file, contents);
    git("add", "--", file);
  };
  const commit = () => git(
    "-c", "user.name=Token Test", "-c", "user.email=token-test@example.invalid",
    "commit", "--quiet", "-m", "fixture",
  );
  const check = () => spawnSync(process.execPath, [checker], { cwd: root, encoding: "utf8" });
  return { root, git, write, stage, commit, check };
}

test("accepts exactly 5,000 tokens and rejects one extra byte with splitting instructions", (t) => {
  const { stage, check } = fixture(t);
  stage("source.ts", "a".repeat(20_000));
  assert.equal(check().status, 0);
  stage("source.ts", "a".repeat(20_001));
  const result = check();
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /source\.ts.*20001 bytes \/ 4 = 5000\.25 tokens/);
  assert.match(result.stderr, /Split each file by responsibility/);
  assert.match(result.stderr, /Update imports, exports, and callers/);
  assert.match(result.stderr, /git add/);
});

test("uses staged bytes even when the worktree has a different size", (t) => {
  const { stage, write, check } = fixture(t);
  stage("source.ts", "small");
  write("source.ts", "a".repeat(20_001));
  assert.equal(check().status, 0);
  stage("source.ts", "a".repeat(20_001));
  write("source.ts", "small");
  assert.equal(check().status, 1);
});

test("ignores untracked, unchanged, and deleted files but checks renames", (t) => {
  const { stage, write, git, commit, check } = fixture(t);
  stage("unchanged.ts", "a".repeat(20_001));
  stage("deleted.ts", "a".repeat(20_001));
  commit();
  write("untracked.ts", "a".repeat(20_001));
  git("rm", "deleted.ts");
  stage("small.ts", "small");
  assert.equal(check().status, 0);
  git("mv", "unchanged.ts", "renamed.ts");
  const result = check();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /renamed\.ts/);
});

test("skips lockfiles, generated code, vendored code, binary assets, and submodules", (t) => {
  const { stage, git, check } = fixture(t);
  for (const file of [
    "bun.lock", "nested/yarn.lock", "bun.lockb", "package-lock.json", "pnpm-lock.yaml",
    "skills-lock.json", "Package.resolved", "go.sum", "src/routeTree.gen.ts",
    "src/client.generated.ts", "src/generated/client.ts", "vendor/library.js",
    "client.min.js", "client.js.map",
  ]) stage(file, "a".repeat(20_001));
  stage("image.png", Buffer.alloc(20_001));
  git("update-index", "--add", "--cacheinfo", "160000,0123456789012345678901234567890123456789,submodule");
  const result = check();
  assert.equal(result.status, 0, result.stderr);
});

test("honors staged generated attributes and ignores unstaged exemptions", (t) => {
  const { stage, write, check } = fixture(t);
  stage("schema/client.ts", "a".repeat(20_001));
  stage("external/library.js", "a".repeat(20_001));
  write(".gitattributes", "schema/* linguist-generated=true\nexternal/* linguist-vendored\n");
  assert.equal(check().status, 1);
  stage(".gitattributes", "schema/* linguist-generated=true\nexternal/* linguist-vendored\n");
  write(".gitattributes", "");
  assert.equal(check().status, 0);
  stage(".gitattributes", "schema/* -linguist-generated\nexternal/* linguist-vendored=false\n");
  assert.equal(check().status, 1);
});

test("ignores binary staged content regardless of the worktree or HEAD", (t) => {
  const { stage, git, check } = fixture(t);
  stage("from-binary.ts", Buffer.alloc(20_001));
  stage("from-text.ts", "small");
  stage("from-binary.bin", Buffer.alloc(20_001));
  stage("from-text.bin", "small");
  git("-c", "user.name=Token Test", "-c", "user.email=token-test@example.invalid",
    "commit", "--quiet", "-m", "fixture");
  stage("from-binary.ts", "a".repeat(20_001));
  stage("from-text.ts", Buffer.alloc(20_001));
  stage("from-binary.bin", "a".repeat(20_001));
  stage("from-text.bin", Buffer.alloc(20_001));
  const result = check();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /from-binary\.ts/);
  assert.match(result.stderr, /from-binary\.bin/);
  assert.doesNotMatch(result.stderr, /from-text/);
});

test("detects binaries from staged content only, within Git's first 8,000 bytes", (t) => {
  const { stage, write, commit, check } = fixture(t);
  const binaryAt = (offset) => {
    const bytes = Buffer.alloc(20_001, "a");
    bytes[offset] = 0;
    return bytes;
  };
  stage("head-binary.ts", binaryAt(0));
  for (const file of ["worktree-diff.ts", "staged-binary.ts", "boundary-inside.ts", "boundary-after.ts"]) {
    stage(file, "small");
  }
  commit();
  write(".gitattributes", "worktree-diff.ts -diff\n");
  stage("head-binary.ts", "a".repeat(20_001));
  stage("worktree-diff.ts", "a".repeat(20_001));
  stage("staged-binary.ts", binaryAt(0));
  stage("boundary-inside.ts", binaryAt(7_999));
  stage("boundary-after.ts", binaryAt(8_000));
  const result = check();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /head-binary\.ts/);
  assert.match(result.stderr, /worktree-diff\.ts/);
  assert.match(result.stderr, /boundary-after\.ts/);
  assert.doesNotMatch(result.stderr, /staged-binary/);
  assert.doesNotMatch(result.stderr, /boundary-inside/);
});

test("does not confuse filenames with Git index-stage prefixes", (t) => {
  const { stage, check } = fixture(t);
  stage("source.ts", Buffer.alloc(20_001));
  stage("0:source.ts", "a".repeat(20_001));
  const result = check();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /"0:source\.ts": 20001 bytes/);
});

test("counts UTF-8 bytes and reports all files with unusual path characters", (t) => {
  const { stage, check } = fixture(t);
  const files = ["space name.ts", "tab\tname.ts", "line\nname.ts", "-option.ts", "中文.ts"];
  for (const file of files) stage(file, "中".repeat(6_667));
  const result = check();
  assert.equal(result.status, 1);
  for (const file of files) assert.ok(result.stderr.includes(JSON.stringify(file)), result.stderr);
  assert.match(result.stderr, /20001 bytes/);
});

test("the installed pre-commit hook blocks a real commit", (t) => {
  const { root, stage, check } = fixture(t);
  assert.equal(check().status, 0);
  mkdirSync(path.join(root, ".githooks"));
  mkdirSync(path.join(root, "scripts"));
  for (const hook of ["pre-commit", "pre-push"]) {
    copyFileSync(path.join(projectRoot, ".githooks", hook), path.join(root, ".githooks", hook));
  }
  copyFileSync(checker, path.join(root, "scripts/check-staged-file-tokens.mjs"));
  writeFileSync(path.join(root, "scripts/verify-git-safety.mjs"), "process.exit(0);\n");
  const installed = spawnSync(process.execPath, [path.join(projectRoot, "scripts/install-git-hooks.mjs"), "--repo", root]);
  assert.equal(installed.status, 0, installed.stderr.toString());
  stage("source.ts", "a".repeat(20_001));
  const result = spawnSync("git", [
    "-c", "user.name=Token Test", "-c", "user.email=token-test@example.invalid",
    "commit", "--quiet", "-m", "must be blocked",
  ], { cwd: root, encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Commit blocked: staged files exceed 5,000 tokens/);
});
