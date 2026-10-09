import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, readlinkSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
const documents = ["README.md", "README.zh-CN.md", "AGENTS.md", "apps/web/AGENTS.md", "GLOSSARY.md", "docs/monorepo.md", "docs/sensitive-data.md", "docs/frontend-architecture.md", "docs/data-sync.md", "docs/tech-stack-maintenance.md", ".agents/skills/verify-personal-sites/SKILL.md"];
const text = (file) => readFileSync(path.join(root, file), "utf8");
// Generated framework guides resolve paths from their installed package, not the repo root.
const authoredText = (file) => text(file).replace(/<!-- BEGIN:[\s\S]*?<!-- END:[^>]*-->/g, "");
// These document generated or private locations, not source navigation targets.
const nonSourcePaths = new Set([
  "apps/web/node_modules/next/dist/docs/",
  "apps/web/data/",
  "tools/smaug/.state/",
  "tools/smaug/smaug.config.json",
  "tools/smaug/bookmarks.md",
]);

test(".claude/skills is one directory symlink onto the sole canonical skill directory", () => {
  const entry = path.join(root, ".claude/skills");
  assert.ok(lstatSync(entry).isSymbolicLink(), ".claude/skills must be a directory symlink");
  assert.equal(readlinkSync(entry), "../.agents/skills");
  assert.equal(realpathSync(entry), realpathSync(path.join(root, ".agents/skills")));
  const names = tracked.filter((file) => /^\.agents\/skills\/[^/]+\/SKILL\.md$/.test(file)).map((file) => file.split("/")[2]);
  assert.ok(names.length > 0);
  for (const name of names) assert.ok(existsSync(path.join(entry, name, "SKILL.md")), `Unreachable through the directory link: ${name}`);
  assert.ok(tracked.includes(".claude/skills"), "The directory symlink must be tracked");
  assert.deepEqual(tracked.filter((file) => file.startsWith(".claude/skills/")), [], "Skill content must only be tracked in the canonical directory");
});

test("navigation documents resolve their explicit local links and source paths", () => {
  for (const file of documents) {
    const content = authoredText(file);
    for (const [, target] of content.matchAll(/\]\(([^)]+)\)/g)) {
      if (/^[a-z]+:|^#/i.test(target)) continue;
      const resolved = path.resolve(root, path.dirname(file), target.split("#")[0]);
      assert.ok(existsSync(resolved), `${file}: ${target}`);
    }
    for (const [, target] of content.matchAll(/`((?:apps|tools|packages|scripts|docs|tests)\/[\w./-]+)`/g)) {
      if (nonSourcePaths.has(target)) continue;
      const prefix = `${target.replace(/\/$/, "")}/`;
      assert.ok(tracked.some((source) => source === target || source.startsWith(prefix)), `${file}: ${target}`);
    }
  }
});

test("documented root pnpm scripts exist and the verification skill stays executable", () => {
  const { scripts } = JSON.parse(text("package.json"));
  const builtins = new Set(["install", "exec", "outdated", "audit", "view"]);
  for (const file of documents) {
    for (const [, command] of authoredText(file).matchAll(/(?:`|^)(?:PLAYWRIGHT_REUSE_BUILD=1 )?pnpm ([a-z][\w:-]*)/gm)) {
      assert.ok(command in scripts || builtins.has(command), `${file}: pnpm ${command}`);
    }
  }
  for (const file of ["README.md", "docs/monorepo.md"]) {
    for (const [, spec] of text(file).matchAll(/vitest run (tests\/[\w./-]+\.test\.ts)/g)) {
      assert.ok(existsSync(path.join(root, "apps/web", spec)), `${file}: ${spec}`);
    }
  }
});
