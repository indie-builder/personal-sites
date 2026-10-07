import type Database from "better-sqlite3";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Effect } from "effect";
import {
  pruneArchivedRows,
  saveArchive,
  type ArchiveMetadata,
} from "@site/public-data/ai-news/archive.mjs";

// Compile-only caller contract; the .mjs implementation is not typechecked by this file.
export function archiveWriteContract(db: Database.Database, client: SupabaseClient, content: unknown) {
  const snapshot = { cutoff: "2026-09-28T16:00:00.000Z", capturedAt: "2026-09-28T20:17:00.000Z" };
  const row = { id: "news-1", content, selected: false, synced_at: snapshot.capturedAt };
  const metadata: ArchiveMetadata = saveArchive(db, [row], snapshot);
  const prune: Effect.Effect<{ dryRun: boolean; eligible: number }, Error> = pruneArchivedRows(client, db, metadata);
  pruneArchivedRows(client, db, null);
  pruneArchivedRows(client, db, undefined, { now: new Date(), dryRun: false });

  // @ts-expect-error A snapshot must include its capture time.
  saveArchive(db, [row], { cutoff: snapshot.cutoff });
  // @ts-expect-error The projection selection flag must be boolean.
  saveArchive(db, [{ ...row, selected: 1 }], snapshot);
  // @ts-expect-error The projection must identify the stored version.
  saveArchive(db, [{ id: row.id, content, selected: false }], snapshot);
  // @ts-expect-error Prune accepts a Date, not its serialized representation.
  pruneArchivedRows(client, db, metadata, { now: snapshot.capturedAt });
  // @ts-expect-error Dry-run is an explicit boolean.
  pruneArchivedRows(client, db, metadata, { dryRun: "false" });
  // @ts-expect-error The deployed archive must supply both identity fields.
  pruneArchivedRows(client, db, { cutoff: snapshot.cutoff });
  // @ts-expect-error Async orchestration remains Effect-based.
  const promise: Promise<unknown> = prune;
  return { metadata, prune, promise };
}
