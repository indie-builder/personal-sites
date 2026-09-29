#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import { copyFileSync, renameSync, rmSync } from "node:fs";
import { archiveCutoff, archiveMetadata, ARCHIVE_PATH, openArchive, pruneArchivedRows, readPublicRows, saveArchive } from "../modules/ai-news/archive.mjs";
import { loadLocalEnv } from "./lib/load-local-env.mjs";

loadLocalEnv(process.cwd());
const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
if (process.argv.includes("--prune")) {
  const response = await fetch("https://default-coder.lovemyrmb.cn/api/health/ai-news/archive", {
    cache: "no-store", signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`无法确认生产归档：HTTP ${response.status}`);
  const db = openArchive();
  try {
    console.log(await pruneArchivedRows(client, db, await response.json(), { dryRun: !process.argv.includes("--apply") }));
  } finally { db.close(); }
} else {
  const capturedAt = new Date().toISOString();
  const cutoff = archiveCutoff(new Date(capturedAt));
  const rows = await readPublicRows(client, { cutoff });
  const temporary = `${ARCHIVE_PATH}.tmp`;
  copyFileSync(ARCHIVE_PATH, temporary);
  const db = openArchive(temporary, false);
  try {
    const previous = archiveMetadata(db);
    if (previous && previous.cutoff > cutoff) throw new Error("拒绝回退归档截止时间。");
    console.log(saveArchive(db, rows, { cutoff, capturedAt }));
    db.close();
    renameSync(temporary, ARCHIVE_PATH);
  } finally {
    if (db.open) db.close();
    rmSync(temporary, { force: true });
  }
}
