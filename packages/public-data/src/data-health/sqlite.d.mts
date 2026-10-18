import type Database from "better-sqlite3";

export type XSyncState = {
  status: "running" | "succeeded" | "failed";
  lastStartedAt: string;
  lastFinishedAt: string | null;
  lastSucceededAt: string | null;
};

export type PublicDataHealthEvidence = {
  askDocuments: number;
  askSearchableDocuments: number;
  /** Documents with at least one indexed token, including orphan postings. */
  askFts: number;
  askMissingFts: number;
  askOrphanFts: number;
  /** Differences in (term, document, column, offset) postings. */
  askMissingPostings: number;
  askExtraPostings: number;
  curation: {
    douyin: { count: number; latestAt: string | null };
    x: { count: number; latestAt: string | null; sync: XSyncState | null };
  };
  openSource: { count: number; latestAt: string | null };
  quickCheck: string;
};

export function recordXSyncState(database: Database.Database, status: XSyncState["status"], at: string, runId: string): boolean;
export function readPublicDataHealth(database: Database.Database): PublicDataHealthEvidence;
