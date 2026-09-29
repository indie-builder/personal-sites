import "server-only";
import { openArchive } from "@site/public-data/ai-news/archive.mjs";

let archive: ReturnType<typeof openArchive> | undefined;
export function getAiNewsArchive() {
  archive ??= openArchive();
  return archive;
}
