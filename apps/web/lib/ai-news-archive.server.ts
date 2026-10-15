import "@tanstack/react-start/server-only";

import { openArchive } from "@site/public-data/ai-news/archive.mjs";

import { resolvePublicDataFile } from "@/lib/bundled-file";

let archive: ReturnType<typeof openArchive> | undefined;
export function getAiNewsArchive() {
  // 共享包默认按 cwd 找 data/ai-news.sqlite；产物里以 server assets 打包，
  // 显式传入定位结果，函数 cwd 不再影响读取。
  archive ??= openArchive(resolvePublicDataFile("ai-news.sqlite"));
  return archive;
}
