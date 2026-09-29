import type Database from "better-sqlite3";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiNewsItem } from "./content.ts";
export type ArchiveMetadata = { cutoff: string; capturedAt: string; count: number; digest: string };
export const ARCHIVE_PATH: string;
export function archiveCutoff(now?: Date): string;
export function openArchive(filename?: string, readonly?: boolean): Database.Database;
export function archiveMetadata(db: Database.Database): ArchiveMetadata | null;
export function readArchivedItem(db: Database.Database, id: string): AiNewsItem | null;
export function readArchivedPage(db: Database.Database, limit: number, excludedIds?: string[], offset?: number): AiNewsItem[];
export function searchArchivedItems(db: Database.Database, query: string, limit: number, excludedIds?: string[]): (AiNewsItem & { score: number })[];
export function compareNews(left: Pick<AiNewsItem, "id" | "publishedAt">, right: Pick<AiNewsItem, "id" | "publishedAt">): number;
export function readPublicRows(client: SupabaseClient, options?: { cutoff?: string; select?: string; changedSince?: ArchiveMetadata | null }): Promise<unknown[]>;

export function newsSearchScore(item: AiNewsItem, query: string): number;
