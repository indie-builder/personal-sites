import type { PublicDataHealthEvidence } from "./sqlite.mjs";

export type DataSourceStatus = {
  ageMinutes: number | null;
  count: number;
  healthy: boolean;
  latestAt: string | null;
};

export type DataHealth = {
  aiNews: { ageMinutes: number | null; healthy: boolean; lastError?: string | null; lastStartedAt?: string | null; lastSucceededAt: string | null; running: boolean };
  askIndex: { documents: number; fts: number; healthy: boolean; missingFts: number; orphanFts: number };
  curation: { douyin: DataSourceStatus; x: DataSourceStatus };
  database: { healthy: boolean; quickCheck: string };
  deployment: { commit: string | null };
  generatedAt: string;
  healthy: boolean;
  insights: { analysisErrors: number | null; designReview: number | null } | null;
  openSource: DataSourceStatus;
  warnings: string[];
};

export function buildDataHealth(options: {
  aiNews: DataHealth["aiNews"];
  commit?: string | null;
  insights?: DataHealth["insights"];
  now?: Date;
  publicData: PublicDataHealthEvidence;
}): DataHealth;
