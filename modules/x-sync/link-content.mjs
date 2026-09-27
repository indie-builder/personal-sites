import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const README_CAP = 12_000;
const ARTICLE_CAP = 8_000;

// ---------- 短链展开 ----------

export async function expandUrl(shortUrl) {
  try {
    const { stdout } = await execFileAsync(
      "curl",
      ["-sIL", "-o", "/dev/null", "-w", "%{url_effective}", "--max-time", "15", shortUrl],
    );
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

export function classifyUrl(url) {
  if (/github\.com\/[\w.-]+\/[\w.-]+/u.test(url)) return "github";
  if (/x\.com\/i\/article\//u.test(url)) return "x-article";
  return "article";
}

// ---------- 内容抓取 ----------

export async function fetchGithubRepo(url) {
  const match = /github\.com\/([\w.-]+\/[\w.-]+)/u.exec(url);
  if (!match) return null;
  const fullName = match[1].replace(/\.git$/u, "");
  try {
    const [meta, readme] = await Promise.all([
      execFileAsync("gh", ["api", `repos/${fullName}`]),
      execFileAsync("gh", [
        "api", `repos/${fullName}/readme`,
        "-H", "Accept: application/vnd.github.raw",
      ]),
    ]);
    const metaJson = JSON.parse(meta.stdout);
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
  } catch {
    return null;
  }
}

export async function fetchArticleText(url) {
  try {
    const { stdout } = await execFileAsync("curl", [
      "-sL", "--max-time", "20",
      "-H", "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      url,
    ]);
    return stdout
      .replace(/<script[\s\S]*?<\/script>/giu, " ")
      .replace(/<style[\s\S]*?<\/style>/giu, " ")
      .replace(/<[^>]+>/gu, " ")
      .replace(/&nbsp;/gu, " ").replace(/&amp;/gu, "&").replace(/&lt;/gu, "<").replace(/&gt;/gu, ">")
      .replace(/\s+/gu, " ")
      .trim()
      .slice(0, ARTICLE_CAP);
  } catch {
    return null;
  }
}
