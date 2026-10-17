import { Cause, Effect } from "effect";
import { TestConsole } from "effect/testing";
import assert from "node:assert/strict";
import test from "node:test";
import { expandUrl, fetchArticleText, fetchGithubRepo } from "../modules/x-sync/link-content.mjs";

const throwing = (error) => async () => {
  throw error;
};
const curlTimeout = Object.assign(new Error("curl: (28) Connection timed out"), {
  code: 28,
  stderr: "curl: (28) Connection timed out after 15001 milliseconds",
});
const ghError = (stderr, extra = {}) => Object.assign(new Error(stderr), { code: 1, stderr, ...extra });

test("expandUrl propagates a curl failure instead of swallowing it as null", async () => {
  const exit = await Effect.runPromise(Effect.exit(expandUrl("http://", { exec: throwing(curlTimeout) })));
  assert.equal(exit._tag, "Failure");
  assert.equal(Cause.hasFails(exit.cause), true);
});

test("fetchArticleText propagates a curl failure instead of swallowing it as null", async () => {
  const exit = await Effect.runPromise(Effect.exit(fetchArticleText("http://", { exec: throwing(curlTimeout) })));
  assert.equal(exit._tag, "Failure");
  assert.equal(Cause.hasFails(exit.cause), true);
});

test("fetchGithubRepo returns null when the repository genuinely 404s", async () => {
  const exit = await Effect.runPromise(
    Effect.exit(fetchGithubRepo("https://github.com/example/missing", { exec: throwing(ghError("gh: Not Found (HTTP 404)")) })),
  );
  assert.equal(exit._tag, "Success");
  assert.equal(exit.value, null);
});

test("fetchGithubRepo logs what it suppresses", async () => {
  const lines = await Effect.runPromise(
    fetchGithubRepo("https://github.com/example/missing", { exec: throwing(ghError("gh: Not Found (HTTP 404)")) }).pipe(
      Effect.flatMap(() => TestConsole.logLines),
      Effect.provide(TestConsole.layer),
    ),
  );
  assert.match(lines.join("\n"), /example\/missing/u);
});

test("fetchGithubRepo propagates authentication failure", async () => {
  const exit = await Effect.runPromise(
    Effect.exit(fetchGithubRepo("https://github.com/example/repo", { exec: throwing(ghError("gh: Bad credentials (HTTP 401)")) })),
  );
  assert.equal(exit._tag, "Failure");
  assert.equal(Cause.hasFails(exit.cause), true);
});

test("fetchGithubRepo propagates a missing gh binary but swallows a missing file", async () => {
  const missingBinary = Object.assign(new Error('Executable not found in $PATH: "gh"'), {
    code: "ENOENT",
    syscall: "spawn gh",
  });
  const spawnExit = await Effect.runPromise(
    Effect.exit(fetchGithubRepo("https://github.com/example/repo", { exec: throwing(missingBinary) })),
  );
  assert.equal(spawnExit._tag, "Failure");
  const missingFile = Object.assign(new Error("ENOENT: no such file"), { code: "ENOENT", syscall: "open" });
  const fileExit = await Effect.runPromise(
    Effect.exit(fetchGithubRepo("https://github.com/example/repo", { exec: throwing(missingFile) })),
  );
  assert.equal(fileExit._tag, "Success");
  assert.equal(fileExit.value, null);
});
