import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { runWorkerPool } from "../analysis/runtime.mjs";
import { fetchReadme, fetchOfficialChineseReadme, fetchRepositoryStructure, isChineseMarkdown, listStarredRepositories, truncateUtf8 } from "./github-api.mjs";

const README_FILE = "README.md";
const REPOSITORY_FILE = "repository-structure.md";
const SNAPSHOT_FILE = "source.json";
function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function repositoryDirectoryName(fullName) {
  return fullName.replace(/[^a-zA-Z0-9._-]+/gu, "--");
}

async function writeSnapshot(rawRoot, record) {
  const directory = path.join(rawRoot, repositoryDirectoryName(record.repository.fullName));
  const sourceFile = record.sourceKind === "readme" ? README_FILE : REPOSITORY_FILE;
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(path.join(directory, sourceFile), record.sourceMarkdown, { encoding: "utf8", mode: 0o600 });
  const readingFile = record.readingMarkdown && record.readingMarkdown !== record.sourceMarkdown
    ? `official-zh-${path.basename(record.readingSourcePath ?? "README.md")}`
    : null;
  if (readingFile) {
    await writeFile(path.join(directory, readingFile), record.readingMarkdown, { encoding: "utf8", mode: 0o600 });
  }
  await writeFile(
    path.join(directory, SNAPSHOT_FILE),
    JSON.stringify(
      {
        metadata: record.repository,
        schemaVersion: 1,
        sourceFetchedAt: record.sourceFetchedAt,
        sourceFile,
        readingFile,
        readingSourcePath: record.readingSourcePath,
        readingTruncated: record.readingTruncated,
        sourceKind: record.sourceKind,
        sourceLanguage: record.sourceLanguage,
        sourceSha256: record.sourceSha256,
        sourceStructure: record.sourceStructure,
        sourceTruncated: record.sourceTruncated,
      },
      null,
      2,
    ) + "\n",
    { encoding: "utf8", mode: 0o600 },
  );
  return directory;
}

export async function syncRepositorySource(repository, { exec, maxBytes = 1024 * 1024, rawRoot } = {}) {
  const readme = await fetchReadme(repository, { exec });
  const sourceFetchedAt = new Date().toISOString();
  const isReadme = readme !== null;
  const structure = isReadme ? null : await fetchRepositoryStructure(repository, { exec, maxBytes });
  const source = isReadme ? readme : structure.markdown;
  const truncatedSource = truncateUtf8(source, maxBytes);
  const sourceTruncated = isReadme && truncatedSource.truncated;
  const sourceMarkdown = truncatedSource.value;
  const sourceLanguage = isReadme && isChineseMarkdown(sourceMarkdown) ? "zh-CN" : "other";
  const officialChineseReadme = isReadme && sourceLanguage !== "zh-CN"
    ? await fetchOfficialChineseReadme(repository, { exec, maxBytes })
    : null;
  const readingMarkdown = sourceLanguage === "zh-CN" ? sourceMarkdown : officialChineseReadme?.markdown.value ?? null;
  const record = {
    readingMarkdown,
    readingSourcePath: sourceLanguage === "zh-CN" ? "README" : officialChineseReadme?.path ?? null,
    readingTruncated: sourceLanguage === "zh-CN" ? sourceTruncated : Boolean(officialChineseReadme?.markdown.truncated),
    repository,
    sourceFetchedAt,
    sourceKind: isReadme ? "readme" : "repository",
    sourceLanguage,
    sourceMarkdown,
    // 纯英文 README 且没有官方中文版本时，沿用旧的哈希，避免无意义地重跑既有翻译。
    // 一旦出现官方中文 README，就让它参与哈希，以淘汰此前的机器翻译结果。
    sourceSha256: sha256(readingMarkdown ? `${sourceMarkdown}\u0000${readingMarkdown}` : sourceMarkdown),
    sourceStructure: structure ? { manifests: structure.manifests, root: structure.root } : null,
    sourceTruncated,
  };
  if (rawRoot) await writeSnapshot(rawRoot, record);
  return record;
}

function repositoryNeedsSourceRefresh(repository, existingRecord) {
  if (!existingRecord) return true;
  const existing = existingRecord.repository;
  return existing.updatedAt !== repository.updatedAt
    || existing.defaultBranch !== repository.defaultBranch
    || existing.repositoryUrl !== repository.repositoryUrl;
}

export async function syncStarredRepositories({ concurrency = 15, exec, existingRecords = [], incremental = false, limit = Infinity, maxBytes, onRecord, only, rawRoot, repositories: suppliedRepositories } = {}) {
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error("concurrency 必须是大于 0 的整数。");
  if (!rawRoot) throw new Error("rawRoot 是同步 Star 原始资料的必填目录。");

  const discovered = suppliedRepositories ?? await listStarredRepositories({ exec, limit: only ? Infinity : limit });
  const repositories = only ? discovered.filter((repository) => only.has(repository.fullName)).slice(0, limit) : discovered;
  const existingByNodeId = new Map(existingRecords.map((record) => [record.repository.nodeId, record]));
  const records = [];
  const changedRecords = [];
  let completed = 0;
  await runWorkerPool(repositories.length, concurrency, async (index) => {
    const repository = repositories[index];
    const existing = existingByNodeId.get(repository.nodeId);
    const changed = !incremental || repositoryNeedsSourceRefresh(repository, existing);
    const record = changed
      ? await syncRepositorySource(repository, { exec, maxBytes, rawRoot })
      : { ...existing, repository };
    if (!changed) await writeSnapshot(rawRoot, record);
    records.push(record);
    if (changed) changedRecords.push(record);
    completed += 1;
    await onRecord?.(record, completed, repositories.length, { changed });
  });
  const sortedRecords = records.sort((left, right) => left.repository.fullName.localeCompare(right.repository.fullName));
  Object.defineProperty(sortedRecords, "changedRecords", {
    enumerable: false,
    value: changedRecords.sort((left, right) => left.repository.fullName.localeCompare(right.repository.fullName)),
  });
  return sortedRecords;
}

export async function readLocalSourceRecords(rawRoot) {
  const directories = await readdir(rawRoot, { withFileTypes: true });
  const records = [];
  for (const directory of directories) {
    if (!directory.isDirectory()) continue;
    const folder = path.join(rawRoot, directory.name);
    const snapshot = JSON.parse(await readFile(path.join(folder, SNAPSHOT_FILE), "utf8"));
    const sourceMarkdown = await readFile(path.join(folder, snapshot.sourceFile), "utf8");
    const readingMarkdown = snapshot.readingFile
      ? await readFile(path.join(folder, snapshot.readingFile), "utf8")
      : snapshot.sourceLanguage === "zh-CN"
        ? sourceMarkdown
        : null;
    records.push({
      repository: snapshot.metadata,
      sourceFetchedAt: snapshot.sourceFetchedAt,
      readingMarkdown,
      readingSourcePath: snapshot.readingSourcePath ?? null,
      readingTruncated: Boolean(snapshot.readingTruncated),
      sourceKind: snapshot.sourceKind,
      sourceLanguage: snapshot.sourceLanguage ?? "other",
      sourceMarkdown,
      sourceSha256: snapshot.sourceSha256,
      sourceStructure: snapshot.sourceStructure ?? null,
      sourceTruncated: Boolean(snapshot.sourceTruncated),
    });
  }
  return records.sort((left, right) => left.repository.fullName.localeCompare(right.repository.fullName));
}
