import { spawn } from "node:child_process";
import { Effect, Schedule } from "effect";
import assert from "node:assert/strict";
import { once } from "node:events";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { runCodexCli } from "../modules/analysis/readers.mjs";
import { runCommand, trackXSync } from "../modules/x-sync/pipeline.mjs";

const fixtureSource = `
import { spawn } from "node:child_process";
import { closeSync } from "node:fs";
import { connect } from "node:net";
const [port, role = "parent"] = process.argv.slice(2);
const socket = connect(Number(port), "127.0.0.1");
socket.on("connect", () => socket.write(JSON.stringify({ role, pid: process.pid }) + "\\n"));
socket.on("error", () => process.exit(1));
let buffer = "";
socket.on("data", (chunk) => {
  buffer += chunk.toString();
  let end;
  while ((end = buffer.indexOf("\\n")) !== -1) {
    const command = buffer.slice(0, end);
    buffer = buffer.slice(end + 1);
    if (command === "stdout" || command === "stderr") process[command].write("x".repeat(100));
    if (command === "stdin-error") closeSync(0);
    if (command === "tree") spawn(process.execPath, [import.meta.filename, port, "descendant"], { stdio: ["ignore", "inherit", "inherit"] });
    if (command === "success") process.exit(0);
    if (command === "failure") process.exit(7);
    if (command === "stop") process.exit(0);
  }
});
`;

async function createFixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "site-process-lifecycle-"));
  const script = path.join(directory, "fixture.mjs");
  const connections = new Map();
  const waiters = new Map();
  const server = createServer((socket) => {
    const closed = once(socket, "close");
    socket.on("error", () => {});
    let buffer = "";
    socket.on("data", (chunk) => {
      buffer += chunk.toString();
      const end = buffer.indexOf("\n");
      if (end === -1) return;
      const { role, pid } = JSON.parse(buffer.slice(0, end));
      const connection = { socket, pid, closed };
      connections.set(role, connection);
      waiters.get(role)?.(connection);
    });
  });
  await writeFile(script, fixtureSource);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return {
    args: [script, String(server.address().port)],
    directory,
    ready(role = "parent") {
      if (connections.has(role)) return Promise.resolve(connections.get(role));
      return new Promise((resolve) => waiters.set(role, resolve));
    },
    async cleanup() {
      for (const { socket } of connections.values()) {
        if (!socket.destroyed) socket.write("stop\n");
      }
      await Promise.all([...connections.values()].map(({ closed }) => closed));
      const closed = once(server, "close");
      server.close();
      await closed;
      await rm(directory, { recursive: true, force: true });
    },
  };
}

async function assertStopped(connection) {
  if (!connection.socket.destroyed) {
    await once(connection.socket, "close", { signal: AbortSignal.timeout(2000) }).catch((error) => {
      assert.fail(`fixture process ${connection.pid} survived resource release (${error.name})`);
    });
  }
  await connection.closed;
}

for (const stream of ["stdout", "stderr"]) {
  test(`Codex CLI ${stream} overflow terminates the process before returning failure`, { timeout: 10000 }, async () => {
    const fixture = await createFixture();
    const controller = new AbortController();
    const result = Effect.runPromiseExit(runCodexCli(process.execPath, fixture.args, { input: "", maxBuffer: 10 }), {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]),
    });
    try {
      const child = await fixture.ready();
      child.socket.write(`${stream}\n`);
      const exit = await result;
      assert.equal(exit._tag, "Failure");
      assert.match(String(exit.cause), /输出超过安全缓冲上限/u);
      await assertStopped(child);
    } finally {
      controller.abort();
      await result;
      await fixture.cleanup();
    }
  });
}

test("Codex CLI stdin failure terminates the process before returning failure", { timeout: 10000 }, async () => {
  const fixture = await createFixture();
  const controller = new AbortController();
  const result = Effect.runPromiseExit(runCodexCli(process.execPath, fixture.args, { input: "x".repeat(8 * 1024 * 1024) }), {
    signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]),
  });
  try {
    const child = await fixture.ready();
    child.socket.write("stdin-error\n");
    const exit = await result;
    assert.equal(exit._tag, "Failure");
    assert.equal(exit.cause.reasons[0].error.operation, "analysis.stdin");
    assert.match(String(exit.cause), /EPIPE/u);
    await assertStopped(child);
  } finally {
    controller.abort();
    await result;
    await fixture.cleanup();
  }
});

for (const [label, run] of [
  ["Codex CLI", runCodexCli],
  ["pipeline command", runCommand],
  ["tracked X command", (command, args, options) => trackXSync({
    repoRoot: options.cwd, options: { fetchOnly: true }, run: runCommand(command, args, options),
  })],
]) {
  test(`${label} cancellation terminates its child and descendant`, { timeout: 10000 }, async () => {
    const fixture = await createFixture();
    const controller = new AbortController();
    const result = Effect.runPromiseExit(run(process.execPath, fixture.args, { cwd: fixture.directory, input: "" }), {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]),
    });
    try {
      const child = await fixture.ready();
      child.socket.write("tree\n");
      const descendant = await fixture.ready("descendant");
      controller.abort();
      const exit = await result;
      assert.equal(exit._tag, "Failure");
      assert.equal(exit.cause.reasons.some((reason) => reason._tag === "Interrupt"), true);
      await assertStopped(child);
      await assertStopped(descendant);
    } finally {
      controller.abort();
      await result;
      await fixture.cleanup();
    }
  });

  for (const outcome of ["success", "failure"]) {
    test(`${label} ${outcome} releases descendants after its parent exits`, {
      timeout: 10000,
      skip: process.platform === "win32" && "Windows cannot address a tree after its root exits",
    }, async () => {
      const fixture = await createFixture();
      const controller = new AbortController();
      const result = Effect.runPromiseExit(run(process.execPath, fixture.args, { cwd: fixture.directory, input: "" }), {
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]),
      });
      try {
        const child = await fixture.ready();
        child.socket.write("tree\n");
        const descendant = await fixture.ready("descendant");
        child.socket.write(`${outcome}\n`);
        const exit = await result;
        assert.equal(exit._tag, outcome === "success" ? "Success" : "Failure");
        if (outcome === "success" && label === "Codex CLI") assert.deepEqual(exit.value, { stdout: "", stderr: "" });
        if (outcome === "failure") assert.match(String(exit.cause), /7/u);
        await assertStopped(child);
        await assertStopped(descendant);
      } finally {
        controller.abort();
        await result;
        await fixture.cleanup();
      }
    });
  }
}

for (const nested of [false, true]) {
 test(`X takeover waits for a ${nested ? "nested " : ""}detached worker surviving its owner SIGKILL`, { timeout: 10000 }, async () => {
  const fixture = await createFixture();
  const script = `
    import { Effect } from "effect";
    import { runCommand, trackXSync } from ${JSON.stringify(new URL("../modules/x-sync/pipeline.mjs", import.meta.url).href)};
    await Effect.runPromise(trackXSync({
      repoRoot: process.argv[1], options: { fetchOnly: true },
      run: runCommand(process.execPath, process.argv.slice(2), { cwd: process.argv[1] }),
    }));
  `;
  const nestedScript = `
    import { Effect } from "effect";
    import { runCommand } from ${JSON.stringify(new URL("../modules/x-sync/pipeline.mjs", import.meta.url).href)};
    await Effect.runPromise(runCommand(process.execPath, process.argv.slice(1), { cwd: process.cwd() }));
  `;
  const workerArgs = nested ? ["--input-type=module", "-e", nestedScript, ...fixture.args] : fixture.args;
  const owner = spawn(process.execPath, ["--input-type=module", "-e", script, fixture.directory, ...workerArgs], {
    cwd: path.resolve(import.meta.dirname, ".."), stdio: ["ignore", "ignore", "inherit"],
  });
  const closed = once(owner, "close");
  try {
    const worker = await Promise.race([
      fixture.ready(), closed.then(() => { throw new Error("fixture owner exited before worker startup"); }),
    ]);
    let ran = false;
    const replacement = trackXSync({
      repoRoot: fixture.directory, options: { fetchOnly: true },
      run: Effect.sync(() => { ran = true; }),
    });
    assert.equal((await Effect.runPromiseExit(replacement))._tag, "Failure");
    owner.kill("SIGKILL");
    await closed;
    assert.equal(worker.socket.destroyed, false);
    const blocked = await Effect.runPromiseExit(replacement);
    assert.equal(blocked._tag, "Failure");
    assert.match(String(blocked.cause), /遗留工作进程/u);
    assert.equal(ran, false);
    worker.socket.write("stop\n");
    await assertStopped(worker);
    await Effect.runPromise(replacement.pipe(Effect.retry({ times: 50, schedule: Schedule.spaced("20 millis") })));
    assert.equal(ran, true);
  } finally {
    owner.kill("SIGKILL");
    await closed;
    await fixture.cleanup();
  }
 });
}

test("X worker cannot execute when its owner marker cannot be persisted", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "site-process-register-"));
  const output = path.join(directory, "must-not-exist");
  try {
    const exit = await Effect.runPromiseExit(runCommand(process.execPath, ["-e",
      `require("node:fs").writeFileSync(${JSON.stringify(output)}, "unexpected write")`,
    ], { cwd: directory, env: { X_SYNC_WORKER_DIRECTORY: path.join(directory, "missing") } }));
    assert.equal(exit._tag, "Failure");
    assert.equal(exit.cause.reasons[0].error.operation, "x.sync-worker.register");
    await assert.rejects(access(output), { code: "ENOENT" });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("process adapters report spawn failures without hanging cleanup", async () => {
  for (const run of [runCodexCli, runCommand]) {
    const exit = await Effect.runPromiseExit(run(path.join(os.tmpdir(), "missing-site-process", "executable"), [], { input: "" }));
    assert.equal(exit._tag, "Failure");
    assert.match(String(exit.cause), /ENOENT/u);
  }
});
