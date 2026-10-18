import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { OperationError } from "@site/effect";
import { errorMessage, externalUrl, requestWithCancel, SITE_ORIGIN } from "./platform";

export type Section = "ai-news" | "curation" | "design" | "douyin" | "open-source";
export const sections: { id: Section; label: string }[] = [
  { id: "ai-news", label: "每日动态" },
  { id: "curation", label: "每日关注" },
  { id: "design", label: "设计收藏" },
  { id: "douyin", label: "抖音收藏" },
  { id: "open-source", label: "开源关注" },
];
export type FeedRow = { id: string; title: string; summary: string; meta: string; date: string; thumbnail: string; raw: unknown };
export type FeedState = { items: FeedRow[]; loading: boolean; refreshing: boolean; hasMore: boolean; error: string; loaded: boolean };
export type Detail = {
  title: string; meta: string; summary: string; text: string; tags: string[];
  media: { url: string; previewUrl: string; videoUrl: string }[];
  sourceUrl: string; websiteUrl: string; reason: string;
};

const Id = Schema.String.check(Schema.isMinLength(1));
const News = Schema.Struct({
  id: Id, category: Schema.String, publishedAt: Schema.NullOr(Schema.String), selected: Schema.Boolean,
  sourceName: Schema.String, summary: Schema.String, title: Schema.String,
});
const NewsDetail = Schema.Struct({ ...News.fields, reason: Schema.String, url: Schema.String });
const Curation = Schema.Struct({
  id: Id, title: Schema.String, summary: Schema.String, text: Schema.String,
  author: Schema.Struct({ handle: Schema.String, name: Schema.String }),
  source: Schema.Struct({ platform: Schema.Literals(["x", "douyin"]), label: Schema.String, url: Schema.String }),
  publishedAt: Schema.NullOr(Schema.String), collectedAt: Schema.NullOr(Schema.String),
  tags: Schema.Array(Schema.String), attachments: Schema.Array(Schema.String),
  media: Schema.Array(Schema.Struct({ url: Schema.String, previewUrl: Schema.NullOr(Schema.String), videoUrl: Schema.NullOr(Schema.String) })),
  design: Schema.optionalKey(Schema.NullOr(Schema.Struct({ reason: Schema.String }))),
});
const OpenSource = Schema.Struct({
  slug: Id, repository: Schema.String, sourceSummary: Schema.String, checkedAt: Schema.String,
  dimensions: Schema.Array(Schema.String), status: Schema.String, type: Schema.String,
});
const page = <A extends Schema.Constraint>(item: A) => Schema.Struct({ items: Schema.Array(item), hasMore: Schema.Boolean });
const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ");
export function dateLabel(value: string | null, now = Date.now()): string {
  if (!value) return "";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "";
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60_000));
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} 小时前`;
  if (minutes < 43200) return `${Math.floor(minutes / 1440)} 天前`;
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}
const categories: Record<string, string> = { "ai-models": "模型", "ai-products": "产品", industry: "行业", paper: "论文", tip: "教程" };

function newsRow(item: typeof News.Type): FeedRow {
  const summary = item.summary.trim();
  return { id: item.id, title: item.title, summary: (summary.startsWith(item.title) && item.title ? summary.slice(item.title.length) : summary).replace(/^[\s，。：:—-]+/, "").replace(/\s+/g, " "), meta: item.sourceName, date: dateLabel(item.publishedAt), thumbnail: "", raw: item };
}
function curationRow(item: typeof Curation.Type): FeedRow {
  return {
    id: item.id, title: item.title || item.text.split("\n").find((line) => line.trim()) || item.summary || "（无文字内容）",
    summary: item.summary, date: dateLabel(item.publishedAt ?? item.collectedAt),
    meta: join(item.source.platform === "x" ? (item.author.handle ? `@${item.author.handle}` : item.author.name) : item.author.name, item.attachments.slice(0, 2).join(" · ")),
    thumbnail: externalUrl(item.media[0]?.previewUrl || item.media[0]?.url || ""), raw: item,
  };
}
function openSourceRow(item: typeof OpenSource.Type): FeedRow {
  return { id: item.slug, title: item.repository, summary: item.sourceSummary, date: dateLabel(item.checkedAt), meta: join(item.status, item.type, item.dimensions.join(" · ")), thumbnail: "", raw: item };
}

const feedPage = Effect.fn("Feed.page")(function* (section: Section, offset: number, registerCancel: (cancel: () => void) => void) {
  const path = `/api/${section}?offset=${offset}&limit=${section === "ai-news" ? 50 : 20}`;
  if (section === "ai-news") {
    const result = yield* requestWithCancel(path, page(News), SITE_ORIGIN, registerCancel);
    return { ...result, rows: result.items.map(newsRow) };
  }
  if (section === "open-source") {
    const result = yield* requestWithCancel(path, page(OpenSource), SITE_ORIGIN, registerCancel);
    return { ...result, rows: result.items.map(openSourceRow) };
  }
  const result = yield* requestWithCancel(path, page(Curation), SITE_ORIGIN, registerCancel);
  return { ...result, rows: result.items.map(curationRow) };
});

export function createFeed(section: Section, onChange: (state: FeedState) => void) {
  let state: FeedState = { items: [], loading: false, refreshing: false, hasMore: true, error: "", loaded: false };
  let offset = 0;
  let generation = 0;
  let disposed = false;
  let cancelRequest: (() => void) | undefined;
  const patch = (changes: Partial<FeedState>) => {
    state = { ...state, ...changes };
    if (!disposed) onChange(state);
  };
  const load = Effect.fn("Feed.load")(function* (mode: "initial" | "more" | "refresh" = "initial") {
    if (disposed || state.loading || state.refreshing || (mode === "initial" && state.loaded) || (mode === "more" && !state.hasMore && !state.error)) return;
    const token = ++generation;
    const cursor = mode === "refresh" ? 0 : offset;
    patch({ loading: mode !== "refresh", refreshing: mode === "refresh", error: "" });
    yield* Effect.gen(function* () {
      const result = yield* feedPage(section, cursor, (cancel) => { cancelRequest = cancel; });
      if (disposed || token !== generation) return;
      const items = mode === "refresh" ? [] : state.items.slice();
      const seen = new Set(items.map((item) => item.id));
      for (const row of result.rows) {
        if (!seen.has(row.id)) { items.push(row); seen.add(row.id); }
      }
      offset = cursor + result.items.length;
      patch({ items, hasMore: result.hasMore, loaded: true });
    }).pipe(
      Effect.catch((error) => Effect.sync(() => { if (!disposed && token === generation) patch({ error: errorMessage(error) }); })),
      Effect.ensuring(Effect.sync(() => {
        if (token === generation) { cancelRequest = undefined; patch({ loading: false, refreshing: false }); }
      })),
    );
  });
  return {
    get state() { return state; },
    load,
    dispose() {
      disposed = true;
      generation++;
      cancelRequest?.();
      cancelRequest = undefined;
      state = { ...state, loading: false, refreshing: false };
    },
  };
}

const carrier = new Map<string, FeedRow>();
export function stashRow(section: Section, row: FeedRow): void {
  const key = `${section}:${row.id}`;
  carrier.delete(key);
  carrier.set(key, row);
  while (carrier.size > 20) {
    const oldest = carrier.keys().next().value;
    if (oldest !== undefined) carrier.delete(oldest);
  }
}
export function takeRow(section: Section, id: string): FeedRow | undefined { return carrier.get(`${section}:${id}`); }

function videoUrl(platform: string, value: string | null): string {
  const url = externalUrl(value ?? "");
  if (platform !== "x") return url;
  return /^https:\/\/video\.twimg\.com\/(?:amplify_video|ext_tw_video)\/[^?#]+\.mp4(?:\?[^#]*)?$/.test(url)
    ? `${SITE_ORIGIN}/api/x-media?url=${encodeURIComponent(url)}` : "";
}

export const detailFor = Effect.fn("Content.detail")(function* (section: Section, id: string, supplied?: FeedRow): Effect.fn.Return<Detail, OperationError | Schema.SchemaError> {
  const websiteUrl = `${SITE_ORIGIN}/${section}/${encodeURIComponent(id)}`;
  if (section === "ai-news") {
    const { item } = yield* requestWithCancel(`/api/ai-news/${encodeURIComponent(id)}`, Schema.Struct({ item: NewsDetail }));
    return { title: item.title, meta: join(item.sourceName, dateLabel(item.publishedAt), categories[item.category] ?? item.category), summary: item.summary, text: "", reason: item.reason, tags: [], media: [], sourceUrl: externalUrl(item.url), websiteUrl };
  }
  const row = supplied ?? takeRow(section, id);
  if (!row || row.id !== id) return yield* Effect.fail(new OperationError("content.detail", new Error("阅读链接已失效，请返回对应栏目重新打开。")));
  if (section === "open-source") {
    const item = yield* Schema.decodeUnknownEffect(OpenSource)(row.raw);
    const sourceUrl = /^[\w.-]+\/[\w.-]+$/.test(item.repository) ? `https://github.com/${item.repository}` : "";
    return { title: item.repository, meta: row.meta, summary: item.sourceSummary, text: "", tags: [...item.dimensions], media: [], sourceUrl, websiteUrl, reason: "" };
  }
  const item = yield* Schema.decodeUnknownEffect(Curation)(row.raw);
  return {
    title: item.title || row.title, meta: join(row.meta, row.date), summary: item.summary, text: item.text,
    tags: [...item.tags], reason: section === "design" ? item.design?.reason ?? "" : "", websiteUrl,
    sourceUrl: externalUrl(item.source.url),
    media: item.media.map((media) => ({ url: externalUrl(media.url), previewUrl: externalUrl(media.previewUrl || media.url), videoUrl: videoUrl(item.source.platform, media.videoUrl) })),
  };
});
