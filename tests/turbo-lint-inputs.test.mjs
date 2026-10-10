import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));

test("every lint task hashes the shared Effect lint plugin", () => {
  const output = execFileSync(path.join(root, "node_modules/.bin/turbo"), ["run", "lint", "lint:repo", "--dry-run=json"], {
    cwd: root,
    encoding: "utf8",
    stdio: "pipe",
  });
  const { tasks } = JSON.parse(output);
  assert.ok(tasks.some((task) => task.taskId === "@site/web#lint"));
  assert.ok(tasks.some((task) => task.taskId === "//#lint:repo"));
  for (const task of tasks) {
    const pluginInput = path.relative(path.resolve(root, task.directory), path.join(root, "scripts/effect-lint-plugin.mjs"));
    assert.ok(task.inputs[pluginInput], `${task.taskId} must hash the shared plugin`);
  }
});
