import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Effect } from "effect";
import { attempt, io } from "@site/effect";

const execFileAsync = promisify(execFile);
const README_CAP = 12_000;
const ARTICLE_CAP = 8_000;

export function expandUrl(shortUrl) {
  return io("link.expand", (signal) =>
    execFileAsync("curl", ["-sIL", "-o", "/dev/null", "-w", "%{url_effective}", "--max-time", "15", shortUrl], {
      signal,
    }),
  ).pipe(
    Effect.map(({ stdout }) => stdout.trim() || null),
    Effect.catch(() => Effect.succeed(null)),
  );
}

export function classifyUrl(url) {
  if (/github\.com\/[\w.-]+\/[\w.-]+/u.test(url)) return "github";
  if (/x\.com\/i\/article\//u.test(url)) return "x-article";
  return "article";
}

export function fetchGithubRepo(url) {
  const match = /github\.com\/([\w.-]+\/[\w.-]+)/u.exec(url);
  if (!match) return Effect.succeed(null);
  const fullName = match[1].replace(/\.git$/u, "");
  return Effect.gen(function* () {
    const [meta, readme] = yield* Effect.all(
      [
        io("link.github.metadata", (signal) => execFileAsync("gh", ["api", `repos/${fullName}`], { signal })),
        io("link.github.readme", (signal) =>
          execFileAsync("gh", ["api", `repos/${fullName}/readme`, "-H", "Accept: application/vnd.github.raw"], {
            signal,
          }),
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
  }).pipe(Effect.catch(() => Effect.succeed(null)));
}

export function fetchArticleText(url) {
  return io("link.article", (signal) =>
    execFileAsync(
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
    Effect.catch(() => Effect.succeed(null)),
  );
}
