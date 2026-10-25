import assert from "node:assert/strict";
import test from "node:test";
import { Effect } from "effect";
import { createXPromptSource, parseBirdReplies, replyCandidates } from "../modules/x-sync/prompt-source.mjs";

const tweet = (id, protectedAccount = false) => ({
  id, text: `Public prompt ${id}`, author: { username: "author", name: "Author" },
  _raw: { core: { user_results: { result: { privacy: { protected: protectedAccount } } } } },
});

test("bird pagination objects retain replies and reject malformed success payloads", () => {
  assert.equal(parseBirdReplies(JSON.stringify({ tweets: [tweet("2")], nextCursor: null }))[0].id, "2");
  assert.equal(parseBirdReplies(JSON.stringify([tweet("2")]))[0].id, "2");
  assert.throws(() => parseBirdReplies('{"error":"upstream changed"}'), /tweets/u);
  assert.throws(() => parseBirdReplies('{"tweets":[{"id":"2"}]}'));
});

test("only confirmed public accounts enter reply candidates", () => {
  assert.deepEqual(replyCandidates([
    tweet("1"), tweet("2"), tweet("3", true), { ...tweet("4"), _raw: undefined }, tweet("2"),
  ], { id: "1", author: { handle: "author" } }).map((reply) => reply.id), ["2"]);
});

test("unconfirmed source visibility fails without publishing a translation", async () => {
  const source = createXPromptSource({
    birdPath: "synthetic-bird", credentials: { authToken: "synthetic", ct0: "synthetic" }, cwd: "/tmp",
    run: (_path, args) => Effect.succeed(JSON.stringify(args[0] === "read" ? tweet("1", true) : { tweets: [] })),
  });
  await assert.rejects(Effect.runPromise(source.fetch({ id: "1", author: { handle: "author" } })), /公开账号/u);
});

test("prompt source reads raw privacy evidence and handles paginated reply output", async () => {
  const calls = [];
  const source = createXPromptSource({
    birdPath: "synthetic-bird", credentials: { authToken: "synthetic", ct0: "synthetic" }, cwd: "/tmp",
    run: (_path, args) => Effect.sync(() => {
      calls.push(args);
      return JSON.stringify(args[0] === "read" ? tweet("1") : { tweets: [tweet("2"), tweet("3", true)] });
    }),
  });
  const result = await Effect.runPromise(source.fetch({ id: "1", author: { handle: "author" } }));
  assert.deepEqual(result.replies.map((reply) => reply.id), ["2"]);
  assert(calls.every((args) => args.includes("--json-full")));
  assert.equal(result.replies[0]._raw, undefined);
});
