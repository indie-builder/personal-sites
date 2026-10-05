import { Effect } from "effect";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { copyFileSync, renameSync, rmSync } from "node:fs";
import {
  archiveCutoff,
  archiveMetadata,
  ARCHIVE_PATH,
  openArchive,
  pruneArchivedRows,
  readPublicRows,
  saveArchive,
} from "@site/public-data/ai-news/archive.mjs";
import { createSupabaseServiceClient } from "@site/public-data/supabase.mjs";
import { loadLocalEnv } from "../../../scripts/lib/load-local-env.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
loadLocalEnv(repoRoot);
const archivePath = path.join(repoRoot, ARCHIVE_PATH);
const client = createSupabaseServiceClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
if (process.argv.includes("--prune")) {
  const response = await fetch("https://default-coder.lovemyrmb.cn/api/health/ai-news/archive", {
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`无法确认生产归档：HTTP ${response.status}`);
  const db = openArchive(archivePath);
  try {
    console.log(
      await Effect.runPromise(
        pruneArchivedRows(client, db, await response.json(), { dryRun: !process.argv.includes("--apply") }),
      ),
    );
  } finally {
    db.close();
  }
} else {
  const capturedAt = new Date().toISOString();
  const cutoff = archiveCutoff(new Date(capturedAt));
  const rows = await Effect.runPromise(readPublicRows(client, { cutoff }));
  const temporary = `${archivePath}.tmp`;
  copyFileSync(archivePath, temporary);
  const db = openArchive(temporary, false);
  try {
    const previous = archiveMetadata(db);
    if (previous && previous.cutoff > cutoff) throw new Error("拒绝回退归档截止时间。");
    console.log(saveArchive(db, rows, { cutoff, capturedAt }));
    db.close();
    renameSync(temporary, archivePath);
  } finally {
    if (db.open) db.close();
    rmSync(temporary, { force: true });
  }
}
