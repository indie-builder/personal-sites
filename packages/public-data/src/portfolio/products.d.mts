import type { Effect } from "effect";

export type PortfolioProduct = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  date: string;
  href: string;
  cover: string;
};

export type LayoutSubcategory = { slug: string; name: string; count: number };

export type LayoutCategory = {
  slug: string;
  name: string;
  count: number;
  subcategories: LayoutSubcategory[];
};

export type LayoutEntry = {
  id: string;
  name: string;
  category: string;
  categorySlug: string;
  subcategory: string;
  subcategorySlug: string;
  width: number;
  height: number;
  image: string | null;
  thumb: string | null;
};

export type ToolEntry = { name: string; url: string; icon: string | null };

export type ToolCategory = { id: string; tools: ToolEntry[] };

export type ToolCatalog = { sourceUrl: string; syncedAt: string; categories: ToolCategory[] };

export type LayoutUpstream = {
  name: string;
  author: string;
  url: string;
  license: string;
  licenseUrl: string;
};

export type PersonalSitePromo = {
  video: string;
  poster: string;
  website: string;
  description: string;
};

export declare const portfolioProducts: PortfolioProduct[];

export declare const layoutUpstream: LayoutUpstream;

export declare const personalSitePromo: PersonalSitePromo;

export declare const layoutEntries: LayoutEntry[];

export declare const readLayoutEntries: () => Effect.Effect<LayoutEntry[], never>;

export declare const readLayoutCategories: () => Effect.Effect<LayoutCategory[], never>;

export declare const readLayoutById: (id: string) => Effect.Effect<LayoutEntry | null, never>;

export declare const toolCatalog: ToolCatalog;

export declare const toolCategories: ToolCategory[];

export declare const toolPreview: ToolEntry[];

export declare const readToolCategories: () => Effect.Effect<ToolCategory[], never>;
