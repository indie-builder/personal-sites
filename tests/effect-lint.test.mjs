import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const binary = path.join(root, "node_modules/.bin/oxlint");

test("Effect lint enforces real execution boundaries and allows lazy cache allocation", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "site-effect-lint-"));
  try {
    const config = path.join(directory, "config.json");
    await writeFile(config, JSON.stringify({
      jsPlugins: [{ name: "site-effect", specifier: path.join(root, "scripts/effect-lint-plugin.mjs") }],
      rules: { "site-effect/execution-boundary": ["error", "business"] },
      overrides: [{ files: ["cli.mjs"], rules: { "site-effect/execution-boundary": ["error", "cli"] } }],
    }));
    const cases = [
      ["business.mjs", 'import { Effect as E } from "effect"; E.runPromise(E.succeed(1));', false],
      ["business.mjs", 'import { runSync } from "effect/Effect"; runSync(1);', false],
      ["business.mjs", 'import * as E from "effect/Effect"; E["runPromise"](1);', false],
      ["business.mjs", 'import { Effect } from "effect"; export const cache = Effect.runSync(Effect.cached(Effect.succeed(1)));', true],
      ["business.mjs", 'import { Effect } from "effect"; Effect.gen(function* () { throw new Error("invalid"); });', false],
      ["business.mjs", 'import { Effect } from "effect"; Effect.sync(() => { throw new Error("invalid"); });', false],
      ["business.mjs", 'import { attempt } from "@site/effect"; attempt("parse", () => { throw new Error("invalid"); });', true],
      ["business.mjs", 'import { Effect } from "effect"; Effect.retry({ times: 1, schedule, while: isTransient });', true],
      ["business.mjs", 'import { Effect } from "effect"; Effect.retry({ schedule, while: isTransient });', false],
      ["business.mjs", 'import { Effect } from "effect"; Effect.retry({ times: 1, schedule });', false],
      ["business.mjs", 'import { Effect } from "effect"; Effect.retry(schedule);', false],
      ["cli.mjs", 'import { runCli } from "@site/effect/cli"; runCli(program);', true],
      ["cli.mjs", 'import { Effect } from "effect"; Effect.runPromise(program);', false],
      ["cli.mjs", 'import { runCli } from "@site/effect/cli"; process.exit(1);', false],
    ];
    for (const [name, source, valid] of cases) {
      const target = path.join(directory, name);
      await writeFile(target, source);
      let passed = true;
      let output = "";
      try {
        output = execFileSync(binary, ["--config", config, "--no-ignore", target], { cwd: directory, encoding: "utf8", stdio: "pipe" });
      } catch (error) {
        passed = false;
        output = `${error.stdout ?? ""}${error.stderr ?? ""}`;
        assert.match(output, /site-effect.*execution-boundary/su, output);
      }
      assert.equal(passed, valid, `${source}\n${output}`);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
