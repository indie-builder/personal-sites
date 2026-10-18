#!/usr/bin/env bun

import { execFileSync } from "node:child_process";
import path from "node:path";

const maxBytes = 5_000 * 4;
const lockfiles = /^(?:.*\.lockb?|package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|skills-lock\.json|Package\.resolved|go\.sum)$/;
const generatedFiles = /(?:^|\/)(?:node_modules|vendor|generated|__generated__|dist|build|coverage)\/|\.(?:gen|generated|min)\.[^/]+$|\.map$/;

function main() {
  const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  const git = (args, options = {}) => execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  });
  // numstat infers binaries from worktree attributes and the old blob, so list names instead.
  const files = git([
    "diff", "--cached", "--name-only", "-z", "--no-renames", "--diff-filter=ACMT",
    "--ignore-submodules=all",
  ]).split("\0").filter((file) =>
    file && !lockfiles.test(path.posix.basename(file)) && !generatedFiles.test(file));
  if (files.length === 0) return;

  // shortcut: check all authored text; narrow to agents only if reliable provenance tracking is added.
  const attributes = git([
    "check-attr", "--cached", "-z", "--stdin", "linguist-generated", "linguist-vendored",
  ], { input: `${files.join("\0")}\0` }).split("\0");
  const excluded = new Set();
  for (let index = 0; index < attributes.length - 1; index += 3) {
    if (attributes[index + 2] === "set" || attributes[index + 2] === "true") {
      excluded.add(attributes[index]);
    }
  }

  const violations = [];
  for (const file of files) {
    if (excluded.has(file)) continue;
    const bytes = Number(git(["cat-file", "-s", `:0:${file}`]).trim());
    if (bytes <= maxBytes) continue;
    // Git's binary heuristic inspects the first 8,000 bytes of the new blob only.
    const blob = git(["cat-file", "blob", `:0:${file}`], { encoding: "buffer", maxBuffer: bytes + 1 });
    if (!blob.subarray(0, 8_000).includes(0)) {
      violations.push(`- ${JSON.stringify(file)}: ${bytes} bytes / 4 = ${bytes / 4} tokens`);
    }
  }
  if (violations.length === 0) return;

  process.stderr.write(`Commit blocked: staged files exceed 5,000 tokens (20,000 bytes).\n${violations.join("\n")}\n\nSplit each file by responsibility:\n1. Extract independent components, helpers, or domain logic into focused sibling files.\n2. Move tests/fixtures into separate files; split documentation by topic and link from the original.\n3. Update imports, exports, and callers; keep every resulting file at or below 20,000 bytes.\n4. Stage the split files with git add and commit again.\nFor actual codegen or vendored files, mark their paths linguist-generated=true or linguist-vendored=true in .gitattributes and stage that file too.\n`);
  process.exitCode = 1;
}

try {
  main();
} catch (error) {
  process.stderr.write(`Staged token check failed: ${error.message}\n`);
  process.exitCode = 2;
}
