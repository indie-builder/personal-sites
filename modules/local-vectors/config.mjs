import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const databasePath = path.join(repoRoot, "data/sensitive/local-vectors.sqlite");
export const curationDatabasePath = path.join(repoRoot, "data/curation.sqlite");
export const modelCachePath = path.join(repoRoot, "data/sensitive/model-cache");
export const defaultInputs = [
  "knowledge/sensitive/personal/index.md",
  "knowledge/sensitive/personal/topics",
  "knowledge/sensitive/personal/github/index.md",
  "knowledge/sensitive/personal/github/curation-report.md",
  "data/sensitive/github/starred/derived",
  "data/sensitive/personal",
  "data/sensitive/personal-site",
];

export const MODEL_ID = "onnx-community/bge-small-zh-v1.5-ONNX";
export const MODEL_DTYPE = "q8";
export const VECTOR_DIMENSIONS = 512;
export const QUERY_PREFIX = "为这个句子生成表示以用于检索相关文章：";
export const BATCH_SIZE = 16;
export const SUPPORTED_EXTENSIONS = new Set([".md", ".mdx", ".txt"]);
export const INDEX_FINGERPRINT_KEY = "default_fingerprint";
// 分块或索引参数变化时递增，让指纹短路失效。
export const INDEXER_VERSION = 1;
