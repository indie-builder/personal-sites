import "server-only";
import { openArchive } from "@/modules/ai-news/archive.mjs";

let archive: ReturnType<typeof openArchive> | undefined;
export function getAiNewsArchive() {
  archive ??= openArchive();
  return archive;
}
