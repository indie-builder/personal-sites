import type Database from "better-sqlite3";

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
    x: { count: number; latestAt: string | null };
  };
  openSource: { count: number; latestAt: string | null };
  quickCheck: string;
};

export function readPublicDataHealth(database: Database.Database): PublicDataHealthEvidence;
