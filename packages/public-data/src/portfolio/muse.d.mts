import type { Effect } from "effect";

export type MuseMedia = {
  id: string;
  type: "image" | "video";
  src: string;
  poster: string | null;
  width: number | null;
  height: number | null;
  alt: string;
};

export type MuseCard = {
  key: string;
  slug: string;
  category: string;
  lead: string | undefined;
  name: string;
  sub: string;
  href: string;
  kind: "image" | "video";
  src: string;
  poster: string | null | undefined;
  fullSrc: string | null | undefined;
  width: number;
  height: number;
  mediaCount: number;
};

export type MuseDetail = {
  slug: string;
  title: string;
  creatorName: string | null;
  creatorUrl: string | null;
  creatorAvatar: string | null;
  description: string | null;
  category: string | null;
  industries: string[];
  styles: string[];
  sourceUrl: string | null;
  createdAt: string;
  publishedAt: string | null;
  media: MuseMedia[];
};

export type MuseBrowseWindow = {
  currentHref: string;
  browseEntries: { href: string; title: string; category: string; search: string[] }[];
  entries: { href: string; title: string }[];
};

export type MusePreview = { src: string; alt: string; videoSrc?: string };

export type MuseCategory = { name: string; count: number };

export type MuseCardsPage = { items: MuseCard[]; total: number; hasMore: boolean };

export type PortfolioCounts = { posts: number; media: number; layouts: number | null };

export type MuseCardsQuery = { q?: string; category?: string; offset?: number; limit?: number };

export declare const PORTFOLIO_DATABASE_FILENAME: string;

export declare function openPortfolioDatabase(
  filename?: string,
  options?: { fileMustExist?: boolean },
): import("better-sqlite3").Database;

export declare function readMuseTabs(db: import("better-sqlite3").Database): Effect.Effect<MuseCategory[], Error>;

export declare function readMuseCardsPage(
  db: import("better-sqlite3").Database,
  query?: MuseCardsQuery,
): Effect.Effect<MuseCardsPage, Error>;

export declare function readMuseDetail(
  db: import("better-sqlite3").Database,
  slug: string,
): Effect.Effect<MuseDetail | null, Error>;

export declare function readMuseBrowseWindow(
  db: import("better-sqlite3").Database,
  slug: string,
): Effect.Effect<MuseBrowseWindow | null, Error>;

export declare function readMusePreviews(
  db: import("better-sqlite3").Database,
  limit?: number,
): Effect.Effect<MusePreview[], Error>;

export declare function readPortfolioCounts(
  db: import("better-sqlite3").Database,
): Effect.Effect<PortfolioCounts, Error>;
