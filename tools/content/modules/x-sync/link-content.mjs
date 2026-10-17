import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Effect } from "effect";
import { attempt, io } from "@site/effect";

const execFileAsync = promisify(execFile);
const README_CAP = 12_000;
const ARTICLE_CAP = 8_000;

// Expected absence (the resource genuinely is not there) must stay a null; a
// systemic break (missing binary, expired auth, rate limit, network) must
// propagate so the item lands in the pipeline's error state and retries next run.
function isAbsentResource(error) {
  const cause = error.cause ?? error;
  // ENOENT for a missing file is absence; for a spawned binary it is a systemic break.
  if (cause.code === "ENOENT") return !/^spawn/u.test(cause.syscall ?? "");
  const body = `${cause.stdout ?? ""}\n${cause.stderr ?? ""}\n${cause.message ?? ""}`;
  return /HTTP 404|Not Found/iu.test(body);
}

export function expandUrl(shortUrl, { exec = execFileAsync } = {}) {
  return io("link.expand", (signal) =>
    exec("curl", ["-sIL", "-o", "/dev/null", "-w", "%{url_effective}", "--max-time", "15", shortUrl], { signal }),
  ).pipe(Effect.map(({ stdout }) => stdout.trim() || null));
}

export function classifyUrl(url) {
  if (/github\.com\/[\w.-]+\/[\w.-]+/u.test(url)) return "github";
  if (/x\.com\/i\/article\//u.test(url)) return "x-article";
  return "article";
}

export function fetchGithubRepo(url, { exec = execFileAsync } = {}) {
  const match = /github\.com\/([\w.-]+\/[\w.-]+)/u.exec(url);
  if (!match) return Effect.succeed(null);
  const fullName = match[1].replace(/\.git$/u, "");
  return Effect.gen(function* () {
    const [meta, readme] = yield* Effect.all(
      [
        io("link.github.metadata", (signal) => exec("gh", ["api", `repos/${fullName}`], { signal })),
        io("link.github.readme", (signal) =>
          exec("gh", ["api", `repos/${fullName}/readme`, "-H", "Accept: application/vnd.github.raw"], { signal }),
        ),
      ],
      { concurrency: 2 },
    );
    const metaJson = yield* attempt("link.github.json", () => JSON.parse(meta.stdout));
    return {
      fullName,
      description: metaJson.description ?? "",
      stars: metaJson.stargazers_count ?? 0,
      language: metaJson.language ?? "",
      createdAt: metaJson.created_at ?? "",
      pushedAt: metaJson.pushed_at ?? "",
      readme: readme.stdout.slice(0, README_CAP),
      readmeTruncated: readme.stdout.length > README_CAP,
    };
  }).pipe(
    Effect.catch((error) =>
      isAbsentResource(error)
        ? Effect.logWarning(`链接跳过（资源不存在）: ${fullName}`).pipe(Effect.as(null))
        : Effect.fail(error),
    ),
  );
}

export function fetchArticleText(url, { exec = execFileAsync } = {}) {
  return io("link.article", (signal) =>
    exec(
      "curl",
      [
        "-sL",
        "--max-time",
        "20",
        "-H",
        "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        url,
      ],
      { signal },
    ),
  ).pipe(
    Effect.map(({ stdout }) =>
      stdout
        .replace(/<script[\s\S]*?<\/script>/giu, " ")
        .replace(/<style[\s\S]*?<\/style>/giu, " ")
        .replace(/<[^>]+>/gu, " ")
        .replace(/&nbsp;/gu, " ")
        .replace(/&amp;/gu, "&")
        .replace(/&lt;/gu, "<")
        .replace(/&gt;/gu, ">")
        .replace(/\s+/gu, " ")
        .trim()
        .slice(0, ARTICLE_CAP),
    ),
  );
}
