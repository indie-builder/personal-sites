import { Cause, Data, Effect } from "effect";
import { io } from "@site/effect";
import "server-only";

import { Result, Schema } from "effect";

import {
  githubRepositoryFileUrl,
  normalizeGitHubPath,
  type GitHubRepositoryTreeEntry,
} from "@/lib/github-repository-browser";
import { getOpenSourceEntry } from "@/lib/open-source";

const MAX_FILE_BYTES = 512 * 1024;
const MAX_TREE_ENTRIES = 6_000;
const repositorySchema = Schema.String.check(Schema.isPattern(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u));
const repositoryMetadataSchema = Schema.Struct({ default_branch: Schema.String.check(Schema.isMinLength(1)) });
const repositoryTreeSchema = Schema.Struct({
  tree: Schema.Array(
    Schema.Struct({
      path: Schema.String,
      size: Schema.optional(Schema.Number.check(Schema.isFinite()).check(Schema.isInt()).check(Schema.isGreaterThanOrEqualTo(0))),
      type: Schema.Literals(["blob", "tree", "commit"]),
    }),
  ).pipe(Schema.mutable),
  truncated: Schema.optional(Schema.Boolean),
});

class GitHubRepositoryBrowserError extends Data.TaggedError("GitHubRepositoryBrowserError")<{
  message: string;
  status: number;
}> {
  constructor(message: string, status: number) {
    super({ message, status });
  }
}

export function repositoryResponse(
  params: Promise<{ slug: string }>,
  read: (slug: string) => Effect.Effect<unknown, Error>,
  noun: "原始仓库" | "原始文件",
  signal?: AbortSignal,
) {
  return Effect.runPromise(
    io("route.params", () => params).pipe(Effect.flatMap(({ slug }) => read(slug))).pipe(
      Effect.map((data) =>
        Response.json(data, { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } }),
      ),
      Effect.catchCause((cause) =>
        Effect.sync(() => {
          const error = Cause.squash(cause);
          if (error instanceof GitHubRepositoryBrowserError)
            return Response.json({ error: error.message }, { status: error.status });
          console.error(`读取${noun}失败`, error);
          return Response.json({ error: `暂时无法读取${noun}。` }, { status: 500 });
        }),
      ),
    ),
    { signal },
  );
}

function githubHeaders() {
  const headers = new Headers({
    Accept: "application/vnd.github+json",
    "User-Agent": "chen-yuan-personal-site",
    "X-GitHub-Api-Version": "2022-11-28",
  });
  if (process.env.GITHUB_TOKEN) headers.set("Authorization", `Bearer ${process.env.GITHUB_TOKEN}`);
  return headers;
}

function githubFetch(pathname: string, init: RequestInit = {}) {
  return Effect.gen(function* () {
    const headers = githubHeaders();
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    const response = yield* io("githubFetch", (signal) =>
      fetch(`https://api.github.com${pathname}`, {
        ...init,
        headers,
        signal,
        next: { revalidate: 600 },
      }),
    );
    if (response.status === 404)
      return yield* Effect.fail(new GitHubRepositoryBrowserError("原始仓库或文件不存在。", 404));
    if (!response.ok)
      return yield* Effect.fail(new GitHubRepositoryBrowserError("暂时无法读取 GitHub 原始仓库。", 502));
    return response;
  });
}

function resolvePublicRepository(slug: string) {
  return Effect.gen(function* () {
    const entry = yield* getOpenSourceEntry(slug);
    if (!entry) return yield* Effect.fail(new GitHubRepositoryBrowserError("未找到已公开的开源仓库。", 404));
    const repository = Schema.decodeUnknownResult(repositorySchema)(entry.repository);
    if (Result.isFailure(repository))
      return yield* Effect.fail(new GitHubRepositoryBrowserError("公开仓库地址无效。", 500));
    return {
      // repositoryDefaultBranch 由 github-starred 同步管线写入公开投影（见
      // modules/github-starred/publish-to-sqlite.mjs）；存量投影行在回填前仍为
      // null，此时读取侧保留回源 GitHub 的兜底（getDefaultBranch）。
      defaultBranch: entry.repositoryDefaultBranch ?? null,
      repository: repository.success,
      repositoryUrl: entry.repositoryUrl,
    };
  });
}

function getDefaultBranch(repository: string) {
  return Effect.gen(function* () {
    const response = yield* githubFetch(`/repos/${repository}`);
    const metadata = yield* Schema.decodeUnknownEffect(repositoryMetadataSchema)(
      yield* io("github.branch.json", () => response.json()),
    );
    return metadata.default_branch;
  });
}

export function getGitHubRepositoryTree(slug: string) {
  return Effect.gen(function* () {
    const { defaultBranch, repository, repositoryUrl } = yield* resolvePublicRepository(slug);
    const branch = defaultBranch ?? (yield* getDefaultBranch(repository));
    const response = yield* githubFetch(`/repos/${repository}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
    const result = yield* Schema.decodeUnknownEffect(repositoryTreeSchema)(
      yield* io("github.tree.json", () => response.json()),
    );
    const entries: GitHubRepositoryTreeEntry[] = result.tree
      .flatMap((entry) =>
        entry.type === "blob" || entry.type === "tree"
          ? [{ path: entry.path, size: entry.size, type: entry.type }]
          : [],
      )
      .slice(0, MAX_TREE_ENTRIES);

    return {
      branch,
      entries,
      repository,
      repositoryUrl,
      truncated: Boolean(result.truncated) || result.tree.length > MAX_TREE_ENTRIES,
    };
  });
}

export function getGitHubRepositoryFile(slug: string, requestedPath: string) {
  return Effect.gen(function* () {
    const path = normalizeGitHubPath(requestedPath);
    if (!path) return yield* Effect.fail(new GitHubRepositoryBrowserError("文件路径无效。", 400));

    const { defaultBranch, repository, repositoryUrl } = yield* resolvePublicRepository(slug);
    const branch = defaultBranch ?? (yield* getDefaultBranch(repository));
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    const response = yield* githubFetch(
      `/repos/${repository}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`,
      {
        headers: { Accept: "application/vnd.github.raw" },
      },
    );
    const bytes = new Uint8Array(yield* io("getGitHubRepositoryFile", () => response.arrayBuffer()));
    if (bytes.byteLength > MAX_FILE_BYTES)
      return yield* Effect.fail(
        new GitHubRepositoryBrowserError("文件超过 512 KB，已改为仅提供 GitHub 原文件链接。", 413),
      );
    const binary = bytes.includes(0);

    return {
      binary,
      branch,
      content: binary ? null : new TextDecoder().decode(bytes),
      fileUrl: githubRepositoryFileUrl(repositoryUrl, branch, path),
      path,
      repository,
    };
  });
}
