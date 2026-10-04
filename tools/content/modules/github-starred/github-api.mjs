import { Effect } from "effect";
import { attempt, io } from "@site/effect";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const MANIFEST_FILES = ["package.json", "pyproject.toml", "Cargo.toml", "go.mod", "pom.xml", "Gemfile"];
const CHINESE_README_NAME = /^readme(?:[._-](?:zh(?:[._-]?cn)?|cn|chinese))?\.(?:md|mdx|rst|txt)$/iu;

const STARRED_REPOSITORIES_QUERY = `
  query StarredRepositories($after: String) {
    viewer {
      starredRepositories(first: 100, after: $after, orderBy: { field: STARRED_AT, direction: DESC }) {
        pageInfo { hasNextPage endCursor }
        edges {
          starredAt
          node {
            id
            name
            nameWithOwner
            url
            description
            isArchived
            isFork
            isPrivate
            stargazerCount
            updatedAt
            defaultBranchRef { name }
            primaryLanguage { name }
            owner { login }
            repositoryTopics(first: 20) { nodes { topic { name } } }
          }
        }
      }
    }
  }
`;

export function truncateUtf8(value, maximumBytes) {
  if (Buffer.byteLength(value, "utf8") <= maximumBytes) return { truncated: false, value };
  let end = Math.min(value.length, maximumBytes);
  while (Buffer.byteLength(value.slice(0, end), "utf8") > maximumBytes) end -= 1;
  return { truncated: true, value: value.slice(0, end) };
}

function toIso(value) {
  return value ? new Date(value).toISOString() : null;
}

function compactRepository(node, starredAt) {
  return {
    defaultBranch: node.defaultBranchRef?.name ?? null,
    description: node.description ?? "",
    fullName: node.nameWithOwner,
    isArchived: Boolean(node.isArchived),
    isFork: Boolean(node.isFork),
    isPrivate: Boolean(node.isPrivate),
    language: node.primaryLanguage?.name ?? null,
    nodeId: node.id,
    owner: node.owner?.login ?? node.nameWithOwner.split("/")[0],
    repositoryUrl: node.url,
    starredAt: toIso(starredAt),
    stargazerCount: Number(node.stargazerCount ?? 0),
    topics: (node.repositoryTopics?.nodes ?? []).map((item) => item.topic.name),
    updatedAt: toIso(node.updatedAt),
  };
}

function gh(args, { exec = execFileAsync } = {}) {
  return Effect.gen(function* () {
    const { stdout } = yield* io("gh", (signal) => exec("gh", args, { maxBuffer: 8 * 1024 * 1024, signal }));
    return stdout;
  });
}

function ghJson(args, options) {
  return Effect.gen(function* () {
    const text = yield* gh(args, options);
    return yield* attempt("github.json", () => JSON.parse(text));
  });
}

function isNotFound(error) {
  const body = `${error?.stdout ?? ""}\n${error?.stderr ?? ""}\n${error?.message ?? ""}`;
  return /(?:HTTP 404|Not Found|status 404)/iu.test(body);
}

export function listStarredRepositories({ limit = Infinity, exec } = {}) {
  return Effect.gen(function* () {
    const repositories = [];
    let after = null;

    while (repositories.length < limit) {
      const stdout = yield* gh(
        ["api", "graphql", "-f", `query=${STARRED_REPOSITORIES_QUERY}`, "-f", `after=${after ?? ""}`],
        { exec },
      );
      const page = JSON.parse(stdout).data.viewer.starredRepositories;
      for (const edge of page.edges) {
        repositories.push(compactRepository(edge.node, edge.starredAt));
        if (repositories.length >= limit) break;
      }
      if (!page.pageInfo.hasNextPage || repositories.length >= limit) break;
      after = page.pageInfo.endCursor;
    }

    return repositories;
  });
}

export function fetchReadme(repository, { exec } = {}) {
  return gh(["api", `repos/${repository.fullName}/readme`, "-H", "Accept: application/vnd.github.raw"], { exec }).pipe(
    Effect.catch((error) =>
      isNotFound(error.cause ?? error)
        ? Effect.succeed(null)
        : Effect.fail(new Error(`读取 ${repository.fullName} README 失败：${error.message}`)),
    ),
  );
}

function normaliseContents(items) {
  const rows = Array.isArray(items) ? items : [items];
  return rows
    .filter((item) => item && typeof item.name === "string")
    .map((item) => ({
      name: item.name,
      path: item.path,
      size: Number(item.size ?? 0),
      type: item.type,
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

export function isChineseMarkdown(markdown) {
  const characters = markdown.match(/[\u3400-\u9fff]/gu) ?? [];
  return characters.length >= 20;
}

function chineseReadmeCandidates(entries) {
  return entries
    .filter((entry) => entry.type === "file" && CHINESE_README_NAME.test(entry.name))
    .sort((left, right) => {
      const score = (entry) => (/zh[-_.]?cn/iu.test(entry.name) ? 0 : /(?:[_.-]cn|chinese)/iu.test(entry.name) ? 1 : 2);
      return score(left) - score(right) || left.path.localeCompare(right.path);
    });
}

function fetchRawFile(repository, filePath, { exec } = {}) {
  return gh(["api", `repos/${repository.fullName}/contents/${filePath}`, "-H", "Accept: application/vnd.github.raw"], {
    exec,
  }).pipe(
    Effect.catch((error) =>
      isNotFound(error.cause ?? error)
        ? Effect.succeed(null)
        : Effect.fail(new Error(`读取 ${repository.fullName}/${filePath} 失败：${error.message}`)),
    ),
  );
}

export function fetchOfficialChineseReadme(repository, { exec, maxBytes } = {}) {
  return Effect.gen(function* () {
    const refQuery = repository.defaultBranch ? `?ref=${encodeURIComponent(repository.defaultBranch)}` : "";
    const root = normaliseContents(
      yield* ghJson(["api", `repos/${repository.fullName}/contents${refQuery}`], { exec }),
    );
    for (const candidate of chineseReadmeCandidates(root)) {
      const raw = yield* fetchRawFile(repository, candidate.path, { exec });
      if (raw === null || !isChineseMarkdown(raw)) continue;
      return { markdown: truncateUtf8(raw, maxBytes), path: candidate.path };
    }
    return null;
  });
}

function buildRepositoryStructureMarkdown(repository, rootEntries, manifests) {
  const lines = [
    `# ${repository.fullName}`,
    "",
    "_README 不存在；以下为仓库根目录与可识别入口文件的原始证据。_",
    "",
    "## Root structure",
    "",
    "```text",
    ...rootEntries.map((entry) => `${entry.type === "dir" ? "[dir]" : "[file]"} ${entry.path}`),
    "```",
  ];

  for (const [filePath, content] of Object.entries(manifests)) {
    if (!content) continue;
    lines.push("", `## ${filePath}`, "", "```text", content.trimEnd(), "```");
  }
  return lines.join("\n") + "\n";
}

export function fetchRepositoryStructure(repository, { exec, maxBytes } = {}) {
  return Effect.gen(function* () {
    const refQuery = repository.defaultBranch ? `?ref=${encodeURIComponent(repository.defaultBranch)}` : "";
    const root = normaliseContents(
      yield* ghJson(["api", `repos/${repository.fullName}/contents${refQuery}`], { exec }),
    );
    const names = new Set(root.filter((item) => item.type === "file").map((item) => item.name));
    const manifests = {};

    for (const fileName of MANIFEST_FILES) {
      if (!names.has(fileName)) continue;
      const raw = yield* fetchRawFile(repository, fileName, { exec });
      if (raw !== null) manifests[fileName] = raw.slice(0, maxBytes);
    }

    return {
      manifests,
      markdown: buildRepositoryStructureMarkdown(repository, root, manifests),
      root,
    };
  });
}
