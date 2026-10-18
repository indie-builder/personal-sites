import { Effect, PORTFOLIO_ORIGIN, Schema, request } from "../lib/runtime";

export type Collection = "layouts" | "muse";
export type Project = "tools" | "site";
export const collectionTitle = (collection: Collection) => collection === "layouts" ? "布局参考" : "灵感集";
export const projectTitle = (project: Project) => project === "tools" ? "设计工程工具" : "个人网站";
export const projectPath = (project: Project) => `/pages/project/index?kind=${project}`;
export function projectKind(value: string | undefined): Project | undefined {
  return value === "tools" || value === "site" ? value : undefined;
}
export const layoutAttribution = "图鉴改编自 nevertoday/350-layout-compositions · CC BY 4.0";

export const Product = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  summary: Schema.String,
  date: Schema.String,
  dateLabel: Schema.String,
  cover: Schema.String,
});
export type Product = typeof Product.Type;
export const Products = Schema.Struct({ items: Schema.Array(Product) });
export const Category = Schema.Struct({ id: Schema.String, name: Schema.String, count: Schema.Natural });
export type Category = typeof Category.Type;
export const Media = Schema.Struct({
  id: Schema.String,
  kind: Schema.Literals(["image", "video"]),
  url: Schema.String,
  poster: Schema.String,
  width: Schema.Natural,
  height: Schema.Natural,
});
export type Media = typeof Media.Type;
export const Work = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  category: Schema.String,
  topic: Schema.String,
  author: Schema.String,
  text: Schema.String,
  sourceURL: Schema.String,
  thumbnail: Schema.String,
  media: Schema.Array(Media),
});
export type Work = typeof Work.Type;
// Collection lists only need display fields; text/media stay in the controller for the detail read.
export interface CollectionWork {
  id: string;
  title: string;
  category: string;
  topic: string;
  author: string;
  thumbnail: string;
  video: boolean;
}
export const collectionWork = (work: Work): CollectionWork => ({
  id: work.id, title: work.title, category: work.category, topic: work.topic,
  author: work.author, thumbnail: work.thumbnail, video: work.media[0]?.kind === "video",
});
export const CollectionPage = Schema.Struct({
  items: Schema.Array(Work),
  total: Schema.Natural,
  hasMore: Schema.Boolean,
  categories: Schema.Array(Category),
  topics: Schema.Array(Category),
  attribution: Schema.String,
});
export const WorkDetail = Schema.Struct({ item: Work });
export const Tools = Schema.Struct({
  categories: Schema.Array(Schema.Struct({
    id: Schema.String,
    name: Schema.String,
    tools: Schema.Array(Schema.Struct({ name: Schema.String, url: Schema.String, icon: Schema.String })),
  })),
});
export const Site = Schema.Struct({ video: Schema.String, poster: Schema.String, website: Schema.String, description: Schema.String });
export type Site = typeof Site.Type;

export function productDestination(id: string): Collection | "tools" | "site" | undefined {
  switch (id) {
    case "layout-compositions": return "layouts";
    case "muse": return "muse";
    case "design-engineer-tools": return "tools";
    case "personal-sites": return "site";
    default: return undefined;
  }
}

export const getProducts = () => request("/api/portfolio", Products, PORTFOLIO_ORIGIN).pipe(
  Effect.map((page) => page.items.filter((product) => productDestination(product.id))),
);
export const getTools = () => request("/api/portfolio/tools", Tools, PORTFOLIO_ORIGIN);
export const getSite = () => request("/api/portfolio/site", Site, PORTFOLIO_ORIGIN);
export const getWork = (collection: Collection, id: string) => request(
  `/api/portfolio/${collection}/${encodeURIComponent(id)}`, WorkDetail, PORTFOLIO_ORIGIN,
);

export interface Filters { q: string; cat: string; theme: string }
export function normalizeFilters(collection: Collection, filters: Filters): Filters {
  const q = filters.q.trim().slice(0, 200).replace(/[\uD800-\uDBFF]$/, "");
  return { q, cat: filters.cat, theme: collection === "layouts" ? filters.theme : "" };
}
export function collectionPath(collection: Collection, offset: number, filters: Filters): string {
  const normalized = normalizeFilters(collection, filters);
  const query = [`offset=${offset}`, "limit=24"];
  for (const key of ["q", "cat", "theme"] as const) {
    if (normalized[key]) query.push(`${key}=${encodeURIComponent(normalized[key])}`);
  }
  return `/api/portfolio/${collection}?${query.join("&")}`;
}

export interface CollectionState {
  items: Work[];
  categories: Category[];
  topics: Category[];
  total: number;
  hasMore: boolean;
  loading: boolean;
  loaded: boolean;
  error: string;
  attribution: string;
  filters: Filters;
  // Increments only when the controller replaces the list (filters or non-append load).
  listRevision: number;
}

export function createCollection(collection: Collection, onChange: (state: CollectionState) => void) {
  let state: CollectionState = {
    items: [], categories: [], topics: [], total: 0, hasMore: true,
    loading: false, loaded: false, error: "", attribution: "",
    filters: { q: "", cat: "", theme: "" }, listRevision: 0,
  };
  let offset = 0;
  let generation = 0;
  let disposed = false;
  const update = (patch: Partial<CollectionState>) => {
    state = { ...state, ...patch };
    if (!disposed) onChange(state);
  };
  return {
    get state() { return state; },
    setFilters(filters: Filters) {
      generation += 1;
      offset = 0;
      update({
        filters: normalizeFilters(collection, filters), items: [], total: 0,
        hasMore: true, loading: false, loaded: false, error: "",
        listRevision: state.listRevision + 1,
      });
    },
    load: (mode: "initial" | "more" | "refresh" = "initial") => Effect.gen(function* () {
      if (disposed || state.loading || (mode === "more" && !state.hasMore)) return;
      const current = ++generation;
      const cursor = mode === "more" ? offset : 0;
      update({ loading: true, error: "" });
      yield* request(collectionPath(collection, cursor, state.filters), CollectionPage, PORTFOLIO_ORIGIN).pipe(
        Effect.match({
          onFailure: () => {
            if (current === generation && !disposed) update({ error: "暂时无法读取内容，请重试。" });
          },
          onSuccess: (page) => {
            if (current !== generation || disposed) return;
            const items = mode === "more" ? [...state.items] : [];
            const seen = new Set(items.map((item) => item.id));
            for (const item of page.items) {
              if (!seen.has(item.id)) { items.push(item); seen.add(item.id); }
            }
            // The cursor follows server rows, including duplicates removed from the display.
            offset = cursor + page.items.length;
            update({
              items, total: page.total, hasMore: page.hasMore && page.items.length > 0,
              categories: [...page.categories], topics: [...page.topics],
              attribution: page.attribution, loaded: true,
              listRevision: mode === "more" ? state.listRevision : state.listRevision + 1,
            });
          },
        }),
        Effect.ensuring(Effect.sync(() => {
          if (current === generation && !disposed) update({ loading: false });
        })),
      );
    }),
    dispose() { disposed = true; generation += 1; },
  };
}
