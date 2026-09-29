import { readFile } from "node:fs/promises";

/** 读 JSON 文件；文件不存在（ENOENT）时返回 fallback，其余错误照常抛出。 */
export async function readJsonOr(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}
