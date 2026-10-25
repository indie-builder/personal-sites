import { Deferred, Effect, Schema, Semaphore } from "effect";
import { attempt } from "@site/effect";
import { acquireSubprocess } from "../../lib/subprocess.mjs";
import { normalizeXMedia } from "./media.mjs";


export const PROMPT_SOURCE_VERSION = 2;
const MAX_CANDIDATES = 40;
const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;
const BIRD_TIMEOUT_MILLISECONDS = 120_000;

function runBird(birdPath, args, { cwd, env }) {
  return Effect.scoped(
    Effect.gen(function* () {
      const { child, closed } = yield* acquireSubprocess(
        birdPath,
        args,
        { cwd, env, stdio: ["ignore", "pipe", "pipe"] },
        "x.prompt-source",
      );
      const output = { stderr: "", stdout: "", overflow: false };
      yield* Effect.sync(() => {
        for (const stream of ["stdout", "stderr"]) {
          child[stream].setEncoding("utf8");
          child[stream].on("data", (chunk) => {
            if (output[stream].length + chunk.length <= MAX_OUTPUT_BYTES) output[stream] += chunk;
            else output.overflow = true;
          });
        }
      });
      const { code, signal } = yield* Deferred.await(closed);
      if (code !== 0) {
        return yield* Effect.fail(new Error(
          `bird ${args[0]} 退出异常（code=${code ?? "null"}, signal=${signal ?? "none"}）：${output.stderr.trim().slice(0, 300)}`,
        ));
      }
      if (output.overflow) return yield* Effect.fail(new Error("bird 输出超过安全缓冲上限。"));
      return output.stdout;
    }),
  ).pipe(
    Effect.timeoutOrElse({
      duration: BIRD_TIMEOUT_MILLISECONDS,
      orElse: () => Effect.fail(new Error(`bird ${args[0]} 超时（${BIRD_TIMEOUT_MILLISECONDS / 1000} 秒）。`)),
    }),
  );
}

const birdTweetSchema = Schema.Struct({
  id: Schema.String.check(Schema.isPattern(/^\d+$/u)),
  text: Schema.String,
  author: Schema.Struct({
    username: Schema.String.check(Schema.isPattern(/^[A-Za-z0-9_]{1,15}$/u)),
    name: Schema.String,
  }),
  _raw: Schema.Unknown,
  media: Schema.optional(Schema.Array(Schema.Unknown)),
  quotedTweet: Schema.optional(Schema.Unknown),
});
const decodeTweet = Schema.decodeUnknownSync(birdTweetSchema);

export function parseBirdReplies(raw) {
  const parsed = JSON.parse(raw);
  const tweets = Array.isArray(parsed) ? parsed : parsed?.tweets;
  if (!Array.isArray(tweets)) throw new Error("bird 回复格式无效，缺少 tweets 数组。");
  return tweets.map(decodeTweet);
}

function publicAuthor(tweet) {
  const raw = tweet._raw?.tweet ?? tweet._raw;
  const author = raw?.core?.user_results?.result;
  return (author?.privacy?.protected ?? author?.legacy?.protected) === false;
}

/** 模型失败后重试时复用上次抓到的候选，避免重复请求 X；--refresh 会绕过它。 */
export function cachedPromptSource(item) {
  const cached = item.promptSource;
  if (cached?.version !== PROMPT_SOURCE_VERSION || !Array.isArray(cached.replies) || !cached.fetchedAt) return null;
  return {
    fetchedAt: cached.fetchedAt,
    fullText: cached.fullText ?? item.text,
    quoteText: cached.quoteText ?? null,
    replies: cached.replies,
  };
}

export function replyCandidates(tweets, item) {
  const seen = new Set();
  const candidates = [];
  for (const tweet of Array.isArray(tweets) ? tweets : []) {
    const id = String(tweet?.id ?? "");
    const text = String(tweet?.text ?? "").trim();
    const handle = String(tweet?.author?.username ?? "");
    if (!/^\d+$/u.test(id) || !/^[A-Za-z0-9_]{1,15}$/u.test(handle)
      || id === item.id || !text || seen.has(id) || !publicAuthor(tweet)) continue;
    seen.add(id);
    candidates.push({
      author: { handle, name: String(tweet?.author?.name ?? "") },
      id,
      media: (Array.isArray(tweet?.media) ? tweet.media : []).map(normalizeXMedia).filter((media) => media.url),
      text,
      url: `https://x.com/${handle}/status/${id}`,
    });
  }
  // 同作者的后续补充优先进入候选，其余按抓取顺序补足。
  return [
    ...candidates.filter((candidate) => candidate.author.handle === item.author.handle),
    ...candidates.filter((candidate) => candidate.author.handle !== item.author.handle),
  ].slice(0, MAX_CANDIDATES);
}

/** 抓取原文长正文与回复候选；任何一次抓取失败都整体失败，避免用空回复冒充成功。 */
export function createXPromptSource({
  birdPath,
  credentials,
  concurrency = 2,
  cwd,
  env = process.env,
  run = runBird,
}) {
  const limiter = Semaphore.makeUnsafe(concurrency);
  const birdEnv = { ...env, AUTH_TOKEN: credentials.authToken, CT0: credentials.ct0 };
  const bird = (args) => limiter.withPermits(1)(run(birdPath, args, { cwd, env: birdEnv }));

  return {
    fetch(item) {
      return Effect.gen(function* () {
        const [readRaw, repliesRaw] = yield* Effect.all([
          bird(["read", item.id, "--json-full"]),
          bird(["replies", item.id, "--max-pages", "2", "--json-full"]),
        ], { concurrency: "unbounded" });
        const tweet = yield* attempt("x.prompt-read", () => decodeTweet(JSON.parse(readRaw)));
        if (String(tweet.id) !== item.id) {
          return yield* Effect.fail(new Error(`bird 返回的推文 id 与请求不一致：${tweet?.id ?? "(空)"}`));
        }
        if (!publicAuthor(tweet)) {
          return yield* Effect.fail(new Error("无法确认原帖作者为公开账号，停止补齐。"));
        }
        const replies = replyCandidates(yield* attempt("x.prompt-replies", () => parseBirdReplies(repliesRaw)), item);
        const quote = tweet.quotedTweet;
        if (quote && !publicAuthor(quote)) {
          return yield* Effect.fail(new Error("无法确认引用作者为公开账号，停止补齐。"));
        }
        const quoteText = quote ? String(quote.text ?? "") : null;
        return {
          fetchedAt: new Date().toISOString(),
          fullText: String(tweet.text ?? ""),
          quoteText,
          replies,
        };
      });
    },
  };
}
