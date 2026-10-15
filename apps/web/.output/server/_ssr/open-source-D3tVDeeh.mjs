import { __toESM } from "../_runtime.mjs";
import { ArraySchema, Boolean as Boolean$1, Literals, NullOr, Number as Number$1, String as String$1, Struct, TaggedError, all, cached, check, decodeUnknownEffect, decodeUnknownSync, fail, gen, isFinite, isGreaterThan, isGreaterThanOrEqualTo, isInt, isLessThanOrEqualTo, isMaxLength, isMinLength, isPattern, makeFilter, mutable, omit, optional, pick, runSync, sync, tryPromise, try_, withDecodingDefaultType } from "../_libs/effect.mjs";
import { require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { createClient } from "../_libs/supabase__supabase-js.mjs";
import { existsSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
//#region node_modules/.nitro/vite/services/ssr/assets/ai-news-types-DeqpevSx.js
var UrlString = String$1.pipe(check(makeFilter((value) => URL.canParse(value), { message: "Invalid URL" })));
function validDate(value) {
	const date = value.slice(0, 10);
	return Number.isFinite(Date.parse(value)) && (/* @__PURE__ */ new Date(`${date}T00:00:00Z`)).toISOString().slice(0, 10) === date;
}
var UtcDateTimeString = String$1.pipe(check(isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u)), check(makeFilter(validDate)));
var DateTimeString = String$1.pipe(check(isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/u)), check(makeFilter(validDate)));
var aiNewsItemContentSchema = Struct({
	category: String$1,
	id: String$1.check(isMinLength(1)),
	publishedAt: NullOr(String$1),
	reason: String$1,
	score: NullOr(Number$1.check(isFinite())),
	sourceName: String$1,
	summary: String$1,
	title: String$1.check(isMinLength(1)),
	url: UrlString
});
var aiNewsListRowSchema = Struct({
	...aiNewsItemContentSchema.mapFields(omit([
		"reason",
		"score",
		"url"
	])).fields,
	selected: Boolean$1
});
var aiNewsCategoryLabels = {
	"ai-models": "模型",
	"ai-products": "产品",
	industry: "行业",
	paper: "论文",
	tip: "教程"
};
var aiNewsCategoryOrder = [
	"ai-models",
	"ai-products",
	"industry",
	"paper",
	"tip"
];
function getAiNewsCategoryLabel(category) {
	return aiNewsCategoryLabels[category] ?? category;
}
/** 按固定分类顺序列出当前条目里实际出现的分类，供列表页筛选。 */
function listAiNewsCategories(items) {
	const present = new Set(items.map((item) => item.category).filter(Boolean));
	const ordered = aiNewsCategoryOrder.filter((category) => present.has(category));
	const rest = [...present].filter((category) => !aiNewsCategoryOrder.includes(category)).sort();
	return [...ordered, ...rest].map((id) => ({
		id,
		label: getAiNewsCategoryLabel(id)
	}));
}
var shanghaiDay = new Intl.DateTimeFormat("zh-CN", {
	day: "2-digit",
	month: "2-digit",
	timeZone: "Asia/Shanghai",
	year: "numeric"
});
var shanghaiClock = new Intl.DateTimeFormat("zh-CN", {
	hour: "2-digit",
	minute: "2-digit",
	hourCycle: "h23",
	timeZone: "Asia/Shanghai"
});
var shanghaiWeekday = new Intl.DateTimeFormat("zh-CN", {
	timeZone: "Asia/Shanghai",
	weekday: "long"
});
/** 北京时间日期分组的 key（YYYY-MM-DD）；无发布时间返回空串。 */
function getAiNewsDayKey(publishedAt) {
	if (!publishedAt) return "";
	const parts = shanghaiDay.formatToParts(new Date(publishedAt));
	const get = (type) => parts.find((part) => part.type === type)?.value ?? "";
	return `${get("year")}-${get("month")}-${get("day")}`;
}
function formatAiNewsTime(publishedAt) {
	if (!publishedAt) return "时间待定";
	return new Intl.DateTimeFormat("zh-CN", {
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		month: "long",
		timeZone: "Asia/Shanghai"
	}).format(new Date(publishedAt));
}
function formatAiNewsClock(publishedAt) {
	if (!publishedAt) return "--:--";
	return shanghaiClock.format(new Date(publishedAt));
}
/** 按北京时间日期倒序分组；无发布时间的条目排在最后的「时间待定」组。 */
function groupAiNewsByDay(items) {
	const groups = /* @__PURE__ */ new Map();
	for (const item of items) {
		const key = getAiNewsDayKey(item.publishedAt);
		const list = groups.get(key) ?? [];
		list.push(item);
		groups.set(key, list);
	}
	return [...groups.entries()].sort(([a], [b]) => {
		if (a === "") return 1;
		if (b === "") return -1;
		return b.localeCompare(a);
	}).map(([dayKey, groupItems]) => ({
		dayKey,
		items: groupItems,
		label: dayKey ? `${Number(dayKey.slice(5, 7))}月${Number(dayKey.slice(8, 10))}日` : "时间待定",
		weekday: dayKey ? shanghaiWeekday.format(/* @__PURE__ */ new Date(`${dayKey}T12:00:00+08:00`)) : ""
	}));
}
function formatAiNewsRelativeTime(publishedAt, now = Date.now()) {
	if (!publishedAt) return null;
	const diff = now - new Date(publishedAt).getTime();
	if (Number.isNaN(diff) || diff < 0) return null;
	const minutes = Math.floor(diff / 6e4);
	if (minutes < 1) return "刚刚";
	if (minutes < 60) return `${minutes}分钟前`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}小时前`;
	return `${Math.floor(hours / 24)}天前`;
}
function getAiNewsUrlHost(url) {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return url;
	}
}
function getAiNewsOriginalAction(url) {
	const host = getAiNewsUrlHost(url);
	if (host === "x.com" || host === "twitter.com") return "在 X 查看原推";
	if (host === "mp.weixin.qq.com") return "在微信查看原文";
	if (host === "github.com") return "在 GitHub 查看";
	return "查看原文";
}
//#endregion
//#region node_modules/.nitro/vite/services/ssr/assets/open-source-D3tVDeeh.js
var import_react = /* @__PURE__ */ __toESM(require_react());
/**
* SDK / platform failures enter the typed error channel at the I/O boundary.
*/
var OperationError = class extends TaggedError("OperationError") {
	/** @param {string} operation @param {unknown} cause */
	constructor(operation, cause) {
		super({
			operation,
			cause,
			message: cause instanceof Error ? cause.message : String(cause)
		});
	}
};
/**
* @template A
* @param {string} operation
* @param {(signal: AbortSignal) => PromiseLike<A>} run
* @returns {Effect.Effect<A, OperationError>}
*/
var io = (operation, run) => tryPromise({
	try: (signal) => Promise.resolve(run(signal)),
	catch: (cause) => new OperationError(operation, cause)
});
/**
* @template A
* @param {string} operation
* @param {() => A} run
* @returns {Effect.Effect<A, OperationError>}
*/
var attempt = (operation, run) => try_({
	try: run,
	catch: (cause) => new OperationError(operation, cause)
});
/**
* 每请求记忆化：Effect.cached 只在 React cache 回调内分配，同请求内重复读取共享结果，
* 跨请求/访客不共享请求绑定的 fiber。
*/
function cachedRequest(program) {
	return (0, import_react.cache)((...args) => runSync(cached(program(...args))));
}
var clientCache = /* @__PURE__ */ new Map();
function getCachedSupabaseClient(key, purpose) {
	const slot = key === "SUPABASE_SERVICE_ROLE_KEY" ? "admin" : "public";
	let client = clientCache.get(slot);
	if (!client) {
		client = createClient(requiredEnv("SUPABASE_URL", purpose), requiredEnv(key, purpose), { auth: {
			autoRefreshToken: false,
			persistSession: false
		} });
		clientCache.set(slot, client);
	}
	return client;
}
/** 公开投影只读客户端（publishable key）；调用方传入缺 key 时的诊断文案。 */
function getPublicSupabaseClient(purpose) {
	return getCachedSupabaseClient("SUPABASE_PUBLISHABLE_KEY", purpose);
}
/** 服务端管理客户端（service role key），只允许在服务端同步/持久化路径使用。 */
function getAdminSupabaseClient(purpose) {
	return getCachedSupabaseClient("SUPABASE_SERVICE_ROLE_KEY", purpose);
}
/** 读取业务自身必需的环境变量，缺失时抛出带诊断文案的错误。 */
function requiredEnv(key, purpose) {
	const value = process.env[key];
	if (!value) throw new Error(`缺少 ${key}；${purpose}`);
	return value;
}
var ARCHIVE_PATH = "data/ai-news.sqlite";
function openArchive(filename = ARCHIVE_PATH, readonly = true) {
	const db = new Database(filename, {
		readonly,
		fileMustExist: readonly
	});
	try {
		db.function("news_lower", { deterministic: true }, (value) => String(value).toLowerCase());
		if (!readonly) db.exec(`
      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY, published_at TEXT, synced_at TEXT NOT NULL,
        content TEXT NOT NULL, selected INTEGER NOT NULL CHECK(selected IN (0,1))
      );
      CREATE INDEX IF NOT EXISTS items_date ON items(published_at DESC, id DESC);
      CREATE TABLE IF NOT EXISTS archive_meta (id INTEGER PRIMARY KEY CHECK(id = 1), value TEXT NOT NULL);
    `);
		return db;
	} catch (error) {
		db.close();
		throw error;
	}
}
function archiveMetadata(db) {
	const row = db.prepare("SELECT value FROM archive_meta WHERE id = 1").get();
	return row ? JSON.parse(row.value) : null;
}
function readArchivedItem(db, id) {
	const row = db.prepare("SELECT content, selected FROM items WHERE id = ?").get(id);
	return row ? {
		...JSON.parse(row.content),
		selected: Boolean(row.selected)
	} : null;
}
function readArchivedPage(db, limit, excludedIds = [], offset = 0) {
	return db.prepare(`SELECT content, selected FROM items
    WHERE id NOT IN (SELECT value FROM json_each(?))
    ORDER BY published_at DESC, id DESC LIMIT ? OFFSET ?`).all(JSON.stringify(excludedIds), limit, offset).map((row) => ({
		...JSON.parse(row.content),
		selected: Boolean(row.selected)
	}));
}
function compareNews(left, right) {
	return (right.publishedAt ? Date.parse(right.publishedAt) : -Infinity) - (left.publishedAt ? Date.parse(left.publishedAt) : -Infinity) || (right.id > left.id ? 1 : right.id < left.id ? -1 : 0);
}
function newsSearchScore(item, query) {
	const needle = query.trim().toLowerCase();
	if (!needle) return 0;
	const occurrences = (text) => text.toLowerCase().split(needle).length - 1;
	return occurrences(item.title) * 8 + occurrences(item.summary) * 2 + occurrences([
		item.reason,
		item.category,
		item.sourceName
	].join("\n"));
}
function searchArchivedItems(db, query, limit, excludedIds = []) {
	const needle = query.trim().toLowerCase();
	if (!needle) return [];
	return db.prepare(`SELECT content, selected FROM items
    WHERE id NOT IN (SELECT value FROM json_each(?))
      AND instr(news_lower(json_extract(content, '$.title') || char(10) ||
        json_extract(content, '$.summary') || char(10) || json_extract(content, '$.reason') || char(10) ||
        json_extract(content, '$.category') || char(10) || json_extract(content, '$.sourceName')), ?) > 0`).all(JSON.stringify(excludedIds), needle).map((row) => {
		const item = JSON.parse(row.content);
		return {
			...item,
			selected: Boolean(row.selected),
			score: newsSearchScore(item, needle)
		};
	}).sort((a, b) => b.score - a.score || compareNews(a, b)).slice(0, limit);
}
/** Stable keyset pagination; never infer completeness from a server's capped page length. */
function readPublicRows(client, { cutoff, select = "id,content,selected,published_at,synced_at", changedSince } = {}) {
	return gen(function* () {
		const rows = [];
		let lastId;
		while (true) {
			let request = client.from("ai_news_public_items").select(select).order("id").limit(500);
			if (cutoff) request = request.or(`published_at.lt.${cutoff},and(published_at.is.null,synced_at.lt.${cutoff})`);
			if (changedSince) request = request.or(`published_at.gte.${changedSince.cutoff},synced_at.gte.${changedSince.capturedAt}`);
			if (lastId) request = request.gt("id", lastId);
			const { data, error } = yield* io("readPublicRows", (signal) => request.abortSignal(signal));
			if (error) return yield* fail(/* @__PURE__ */ new Error(`读取每日动态公开投影失败：${error.message}`));
			if (!data?.length) return rows;
			rows.push(...data);
			lastId = data.at(-1).id;
		}
	});
}
var archive;
function getAiNewsArchive() {
	archive ??= openArchive();
	return archive;
}
function getPublicAiNewsClient() {
	return getPublicSupabaseClient("每日动态增量需要 Supabase 公开投影。");
}
var aiNewsRowSchema = Struct({
	content: aiNewsItemContentSchema,
	selected: Boolean$1
});
var listSelect = "category:content->>category,id,publishedAt:content->>publishedAt,selected,sourceName:content->>sourceName,summary:content->>summary,title:content->>title";
var readLiveList = cachedRequest(() => gen(function* () {
	const rows = yield* readPublicRows(yield* attempt("ai-news.client", getPublicAiNewsClient), {
		select: listSelect,
		changedSince: yield* attempt("ai-news.archive", () => archiveMetadata(getAiNewsArchive()))
	});
	return yield* decodeUnknownEffect(ArraySchema(aiNewsListRowSchema).pipe(mutable))(rows);
}));
function getAiNewsPage(offset = 0, limit = 50) {
	return gen(function* () {
		const live = yield* readLiveList();
		const archiveOffset = Math.max(0, offset - live.length);
		const archived = yield* attempt("ai-news.page", () => readArchivedPage(getAiNewsArchive(), live.length + limit + 1, live.map((item) => item.id), archiveOffset));
		const start = offset - archiveOffset;
		const items = [...live, ...archived].sort(compareNews).slice(start, start + limit + 1);
		return {
			hasMore: items.length > limit,
			items: yield* decodeUnknownEffect(ArraySchema(aiNewsListRowSchema).pipe(mutable))(items.slice(0, limit))
		};
	});
}
var getAiNewsItem = cachedRequest((id) => gen(function* () {
	const archive = yield* attempt("ai-news.archive", getAiNewsArchive);
	const archived = yield* attempt("ai-news.item", () => readArchivedItem(archive, id));
	const metadata = yield* attempt("ai-news.metadata", () => archiveMetadata(archive));
	let query = (yield* attempt("ai-news.client", getPublicAiNewsClient)).from("ai_news_public_items").select("content,selected").eq("id", id);
	if (archived && metadata) query = query.gte("synced_at", metadata.capturedAt);
	const { data, error } = yield* io("ai-news.detail", () => query.maybeSingle());
	if (error) return yield* fail(/* @__PURE__ */ new Error(`读取 Supabase 每日动态详情失败：${error.message}`));
	if (!data) return archived;
	const row = yield* decodeUnknownEffect(aiNewsRowSchema)(data);
	return {
		...row.content,
		selected: row.selected
	};
}));
var aiNewsSearchRowSchema = Struct({
	id: String$1,
	title: String$1,
	summary: String$1,
	reason: String$1,
	published_at: NullOr(String$1),
	score: Number$1.check(isFinite())
});
function searchAiNewsDocuments(query, limit = 6) {
	return gen(function* () {
		if (!query.trim()) return [];
		const archive = yield* attempt("ai-news.archive", getAiNewsArchive);
		const client = yield* attempt("ai-news.client", getPublicAiNewsClient);
		const [changedRows, { data, error }] = yield* all([readPublicRows(client, {
			select: "id",
			changedSince: archiveMetadata(archive)
		}), io("ai-news.search", () => client.rpc("search_ai_news_public_items", {
			p_query: query,
			p_limit: limit
		}))], { concurrency: 2 });
		if (error) return yield* fail(/* @__PURE__ */ new Error(`检索 Supabase 每日动态失败：${error.message}`));
		const changedIds = (yield* decodeUnknownEffect(ArraySchema(Struct({ id: String$1 })).pipe(mutable))(changedRows)).map((row) => row.id);
		const archived = yield* attempt("ai-news.searchArchive", () => searchArchivedItems(archive, query, limit, changedIds));
		const live = (yield* decodeUnknownEffect(ArraySchema(aiNewsSearchRowSchema).pipe(mutable))(data)).map((row) => ({
			...row,
			publishedAt: row.published_at
		}));
		return [...new Map([...archived, ...live].map((item) => [item.id, item])).values()].filter((item) => item.score > 0).sort((a, b) => b.score - a.score || compareNews(a, b)).slice(0, limit).map((item) => ({
			content: [item.summary, item.reason].filter(Boolean).join("\n\n"),
			id: `ai-news:${item.id}`,
			publishedAt: item.publishedAt,
			score: item.score,
			sourceId: item.id,
			sourceUrl: `/ai-news/${encodeURIComponent(item.id)}`,
			title: item.title
		}));
	});
}
/**
* 公开策展投影（curation.sqlite `content_json`）的唯一结构定义：
* Effect Schema 同时承担运行时校验与静态类型推导，避免手写类型与校验规则漂移。
*/
var curationItemSchema = Struct({
	analysis: String$1.check(isMinLength(1)),
	author: Struct({
		handle: String$1,
		name: String$1
	}),
	collectedAt: NullOr(UtcDateTimeString).pipe(withDecodingDefaultType(sync(() => null))),
	collectedOrder: NullOr(Number$1.check(isFinite()).check(isInt()).check(isGreaterThanOrEqualTo(0))).pipe(withDecodingDefaultType(sync(() => null))),
	design: NullOr(Struct({
		categories: ArraySchema(String$1.check(isMinLength(1))).pipe(mutable).check(isMaxLength(3)),
		classifiedAt: UtcDateTimeString,
		confidence: Number$1.check(isFinite()).check(isGreaterThanOrEqualTo(0)).check(isLessThanOrEqualTo(1)),
		evidence: ArraySchema(String$1.check(isMinLength(1))).pipe(mutable).check(isMaxLength(4)),
		reason: String$1.check(isMinLength(1)),
		relevant: Boolean$1,
		status: Literals(["include", "exclude"])
	})).pipe(withDecodingDefaultType(sync(() => null))),
	facts: Struct({
		version: Number$1.check(isFinite()).check(isInt()).check(isGreaterThan(0)),
		contentType: Literals([
			"original",
			"quote",
			"reply"
		]),
		domains: ArraySchema(String$1).pipe(mutable),
		hashtags: ArraySchema(String$1).pipe(mutable),
		linkTypes: ArraySchema(String$1).pipe(mutable),
		mediaTypes: ArraySchema(String$1).pipe(mutable),
		mentions: ArraySchema(String$1).pipe(mutable),
		sourceKinds: ArraySchema(String$1).pipe(mutable),
		tools: ArraySchema(String$1).pipe(mutable)
	}).pipe(withDecodingDefaultType(sync(() => ({
		version: 1,
		contentType: "original",
		domains: [],
		hashtags: [],
		linkTypes: [],
		mediaTypes: [],
		mentions: [],
		sourceKinds: [],
		tools: []
	})))),
	excerptTime: NullOr(String$1).pipe(withDecodingDefaultType(sync(() => null))),
	id: String$1.check(isMinLength(1)),
	links: ArraySchema(Struct({
		shortUrl: NullOr(UrlString),
		type: String$1.check(isMinLength(1)),
		url: UrlString
	})).pipe(mutable),
	media: ArraySchema(Struct({
		durationMs: NullOr(Number$1.check(isFinite()).check(isInt()).check(isGreaterThanOrEqualTo(0))).pipe(withDecodingDefaultType(sync(() => null))),
		height: NullOr(Number$1.check(isFinite()).check(isInt()).check(isGreaterThan(0))),
		previewUrl: NullOr(UrlString),
		type: Literals([
			"photo",
			"video",
			"animated_gif"
		]),
		url: UrlString,
		videoUrl: NullOr(UrlString).pipe(withDecodingDefaultType(sync(() => null))),
		width: NullOr(Number$1.check(isFinite()).check(isInt()).check(isGreaterThan(0)))
	})).pipe(mutable),
	publishedAt: NullOr(UtcDateTimeString),
	quoteContext: NullOr(Struct({
		author: String$1,
		authorName: String$1,
		text: String$1
	})),
	source: Struct({
		label: String$1.check(isMinLength(1)),
		platform: Literals(["douyin", "x"]),
		url: UrlString
	}),
	searchSignals: NullOr(Struct({
		concepts: ArraySchema(String$1).pipe(mutable),
		entities: ArraySchema(String$1).pipe(mutable),
		problems: ArraySchema(String$1).pipe(mutable),
		sentiment: Literals([
			"positive",
			"negative",
			"neutral",
			"humorous",
			"controversial"
		]),
		tools: ArraySchema(String$1).pipe(mutable),
		useCases: ArraySchema(String$1).pipe(mutable)
	})).pipe(withDecodingDefaultType(sync(() => null))),
	summary: String$1.check(isMinLength(1)),
	tags: ArraySchema(String$1.check(isMinLength(1))).pipe(mutable).check(isMinLength(1)),
	text: String$1.check(isMinLength(1)),
	title: String$1.check(isMinLength(1)),
	visualFacts: NullOr(Struct({
		interactionSignals: ArraySchema(String$1).pipe(mutable),
		objects: ArraySchema(String$1).pipe(mutable),
		ocr: ArraySchema(String$1).pipe(mutable),
		scenes: ArraySchema(String$1).pipe(mutable),
		styles: ArraySchema(String$1).pipe(mutable),
		tools: ArraySchema(String$1).pipe(mutable)
	})).pipe(withDecodingDefaultType(sync(() => null)))
});
/**
* Fields needed by the feed; the full analysis remains detail-only.
* 剪报簿结构在列表里同时呈现判断（title/summary）与证据（text 摘录、tags、attachments），
* attachments 由投影在读取时从 media 与 quoteContext 归并成登记用词。
*/
var curationListItemSchema = Struct({
	...curationItemSchema.mapFields(pick([
		"author",
		"collectedAt",
		"design",
		"id",
		"media",
		"publishedAt",
		"source",
		"summary",
		"tags",
		"text",
		"title"
	])).fields,
	attachments: ArraySchema(String$1).pipe(mutable)
});
var PUBLIC_DATABASE_PATH = path.join(process.cwd(), "data/curation.sqlite");
var contentJsonRowSchema = Struct({ content_json: String$1.check(isMinLength(1)) });
var database;
function getPublicDatabase() {
	if (!existsSync(PUBLIC_DATABASE_PATH)) throw new Error("缺少 data/curation.sqlite；请先生成本地公开投影。");
	database ??= new Database(PUBLIC_DATABASE_PATH, {
		fileMustExist: true,
		readonly: true
	});
	return database;
}
var curationNeighborRowSchema = Struct({
	id: String$1.check(isMinLength(1)),
	title: String$1.check(isMinLength(1))
});
var ATTACHMENT_LABELS = {
	animated_gif: "GIF",
	photo: "图片",
	video: "视频"
};
var CURATION_ORDER = "collected_at DESC NULLS LAST, collected_order ASC NULLS LAST, published_at DESC NULLS LAST, id DESC";
var ORDER_BY_PLATFORM = {
	douyin: "collected_order ASC NULLS LAST, collected_at DESC NULLS LAST, published_at DESC NULLS LAST, id DESC",
	x: CURATION_ORDER
};
var CURATION_PLATFORM = "json_extract(content_json, '$.source.platform')";
var CURATION_DESIGN_INCLUDE = "json_extract(content_json, '$.design.status') = 'include'";
function parseCurationItem(contentJson) {
	return decodeUnknownSync(curationItemSchema)(JSON.parse(contentJson));
}
/** 把投影行折成列表条目：media/quoteContext 归并为附件登记词，原文与标签随行。 */
function toCurationListItem(item) {
	const attachments = [...new Set(item.media.map((media) => media.type))].map((kind) => ATTACHMENT_LABELS[kind]);
	if (item.quoteContext) attachments.push("引用");
	return {
		attachments,
		author: item.author,
		collectedAt: item.collectedAt,
		design: item.design,
		id: item.id,
		media: item.media,
		publishedAt: item.publishedAt,
		source: item.source,
		summary: item.summary,
		tags: item.tags,
		text: item.text,
		title: item.title
	};
}
function selectCurationRows(where, parameters, offset, limit) {
	return getPublicDatabase().prepare(`SELECT content_json FROM curation_items WHERE ${where} LIMIT ? OFFSET ?`).all(...parameters, limit + 1, offset).map((row) => decodeUnknownSync(contentJsonRowSchema)(row)).map((row) => toCurationListItem(parseCurationItem(row.content_json)));
}
function getCurationPageByPlatform(platform, offset, limit, designOnly = false, tag = null) {
	return attempt("curation.page", () => {
		const where = designOnly ? `${CURATION_PLATFORM} = 'x' AND ${CURATION_DESIGN_INCLUDE}` : `${CURATION_PLATFORM} = ?`;
		const order = ORDER_BY_PLATFORM[platform];
		const items = selectCurationRows(`${where}${tag ? " AND EXISTS (SELECT 1 FROM json_each(content_json, '$.tags') WHERE value = ?)" : ""} ORDER BY ${order}`, [...designOnly ? [] : [platform], ...tag ? [tag] : []], offset, limit);
		return {
			hasMore: items.length > limit,
			items: items.slice(0, limit)
		};
	});
}
/** 每日关注：来源拆分后只呈现 X 条目；抖音条目由 /douyin 板块承载。 */
function getCurationPage(offset = 0, limit = 20, tag = null) {
	return getCurationPageByPlatform("x", offset, limit, false, tag);
}
/** 全库主题计数及首条 ID，不受已加载分页限制；首条用于校验返回列表的会话快照。 */
function getCurationTags() {
	return attempt("curation.tags", () => {
		const rows = getPublicDatabase().prepare(`SELECT id, json_extract(content_json, '$.tags') AS tags
      FROM curation_items WHERE ${CURATION_PLATFORM} = 'x' ORDER BY ${CURATION_ORDER}`).all();
		const tags = /* @__PURE__ */ new Map();
		const rowSchema = Struct({
			id: String$1,
			tags: String$1
		});
		for (const row of rows) {
			const parsed = decodeUnknownSync(rowSchema)(row);
			for (const tag of new Set(decodeUnknownSync(ArraySchema(String$1))(JSON.parse(parsed.tags)))) {
				const entry = tags.get(tag) ?? {
					tag,
					count: 0,
					headId: parsed.id
				};
				entry.count += 1;
				tags.set(tag, entry);
			}
		}
		const priority = {
			提示词: 9,
			视频提示词: 8,
			软件工程提示词: 7,
			图像提示词: 6,
			写作提示词: 5,
			学习提示词: 4,
			研究提示词: 3,
			助手提示词: 2,
			技能: 1
		};
		return [...tags.values()].sort((a, b) => (priority[b.tag] ?? 0) - (priority[a.tag] ?? 0) || b.count - a.count);
	});
}
/** 抖音收藏板块：只呈现公开投影中已发布的抖音来源条目。 */
function getDouyinCurationPage(offset = 0, limit = 20) {
	return getCurationPageByPlatform("douyin", offset, limit);
}
/** 设计收藏：呈现模型判断为设计相关的 X 条目。 */
function getDesignCurationPage(offset = 0, limit = 20) {
	return getCurationPageByPlatform("x", offset, limit, true);
}
var curationPlatformRowSchema = Struct({ platform: Literals(["douyin", "x"]) });
function getCurationNeighbors(id, designOnly = false) {
	return attempt("getCurationNeighbors", () => {
		const platformRow = getPublicDatabase().prepare(`SELECT ${CURATION_PLATFORM} AS platform FROM curation_items WHERE id = ?`).get(id);
		if (!platformRow) return {
			newer: null,
			older: null
		};
		const { platform } = decodeUnknownSync(curationPlatformRowSchema)(platformRow);
		const order = ORDER_BY_PLATFORM[platform];
		const rows = getPublicDatabase().prepare(`SELECT id, title FROM curation_items
      WHERE ${CURATION_PLATFORM} = ?
        ${designOnly ? `AND ${CURATION_DESIGN_INCLUDE}` : ""}
      ORDER BY ${order}`).all(platform).map((row) => decodeUnknownSync(curationNeighborRowSchema)(row));
		const index = rows.findIndex((row) => row.id === id);
		return {
			newer: index > 0 ? rows[index - 1] ?? null : null,
			older: index >= 0 ? rows[index + 1] ?? null : null
		};
	});
}
var findCurationItem = cachedRequest((id) => attempt("curation.detail", () => {
	const row = getPublicDatabase().prepare("SELECT content_json FROM curation_items WHERE id = ?").get(id);
	if (!row) return null;
	return parseCurationItem(decodeUnknownSync(contentJsonRowSchema)(row).content_json);
}));
var openSourceCategories = [
	{
		id: "all",
		label: "全部"
	},
	{
		id: "skills",
		label: "Skills 与工作流"
	},
	{
		id: "agents",
		label: "智能体系统"
	},
	{
		id: "context",
		label: "智能体上下文"
	},
	{
		id: "tools",
		label: "AI 开发工具"
	}
];
var openSourceDimensions = [
	{
		id: "agent-skills",
		label: "Agent Skills"
	},
	{
		id: "coding-agent",
		label: "Coding Agent"
	},
	{
		id: "agent-runtime",
		label: "Agent 运行时"
	},
	{
		id: "long-running",
		label: "长程 Agent"
	},
	{
		id: "multi-agent",
		label: "多智能体协作"
	},
	{
		id: "agent-control",
		label: "Agent 控制面"
	},
	{
		id: "agent-infra",
		label: "Agent 基础设施"
	},
	{
		id: "agent-context",
		label: "Agent 上下文"
	},
	{
		id: "local-retrieval",
		label: "本地检索"
	},
	{
		id: "model-gateway",
		label: "模型网关"
	},
	{
		id: "ai-ingestion",
		label: "AI 数据入口"
	}
];
function toOpenSourceListEntry(entry) {
	return {
		category: entry.category,
		checkedAt: entry.evidence.checkedAt,
		dimensions: entry.dimensions,
		repository: entry.repository,
		slug: entry.slug,
		sourceSummary: entry.sourceSummary,
		status: entry.status,
		type: entry.type
	};
}
function getOpenSourceCategoryLabel(category) {
	return openSourceCategories.find((item) => item.id === category)?.label ?? category;
}
function getOpenSourceDimensionLabel(dimension) {
	return openSourceDimensions.find((item) => item.id === dimension)?.label ?? dimension;
}
var openSourceEntrySchema = Struct({
	category: Literals(openSourceCategories.map(({ id }) => id).filter((id) => id !== "all")),
	dimensions: ArraySchema(Literals(openSourceDimensions.map(({ id }) => id))).pipe(mutable),
	evidence: Struct({
		checkedAt: String$1,
		kind: Literals(["readme", "repository"]),
		label: String$1,
		note: String$1,
		url: UrlString
	}),
	parsedMarkdown: optional(NullOr(String$1)),
	personalNote: String$1,
	readingSource: optional(Literals(["official-zh-readme", "model-translation"])),
	readingSourcePath: optional(NullOr(String$1)),
	repository: String$1,
	repositoryDefaultBranch: optional(NullOr(String$1)),
	repositoryUrl: UrlString,
	slug: String$1,
	sourceMarkdown: optional(NullOr(String$1)),
	sourceSummary: String$1,
	status: Literals([
		"持续跟踪",
		"计划试用",
		"已提炼"
	]),
	type: String$1
});
function parseEntry(contentJson) {
	return decodeUnknownSync(openSourceEntrySchema)(JSON.parse(contentJson));
}
function getOpenSourceListEntries() {
	return attempt("getOpenSourceListEntries", () => getPublicDatabase().prepare("SELECT content_json FROM open_source_items ORDER BY display_rank ASC, published_at DESC").all().map((row) => decodeUnknownSync(contentJsonRowSchema)(row)).map((row) => toOpenSourceListEntry(parseEntry(row.content_json))));
}
function getOpenSourcePage(offset = 0, limit = 20) {
	return gen(function* () {
		const entries = yield* getOpenSourceListEntries();
		return {
			hasMore: offset + limit < entries.length,
			items: entries.slice(offset, offset + limit)
		};
	});
}
var getOpenSourceEntry = cachedRequest((slug) => attempt("open-source.detail", () => {
	if (!/^[\w-]+$/u.test(slug)) return null;
	const row = getPublicDatabase().prepare("SELECT content_json FROM open_source_items WHERE slug = ?").get(slug);
	return row ? parseEntry(decodeUnknownSync(contentJsonRowSchema)(row).content_json) : null;
}));
//#endregion
export { DateTimeString, OperationError, PUBLIC_DATABASE_PATH, aiNewsListRowSchema, archiveMetadata, attempt, curationListItemSchema, findCurationItem, formatAiNewsClock, formatAiNewsRelativeTime, formatAiNewsTime, getAdminSupabaseClient, getAiNewsArchive, getAiNewsCategoryLabel, getAiNewsItem, getAiNewsOriginalAction, getAiNewsPage, getAiNewsUrlHost, getCurationNeighbors, getCurationPage, getCurationTags, getDesignCurationPage, getDouyinCurationPage, getOpenSourceCategoryLabel, getOpenSourceDimensionLabel, getOpenSourceEntry, getOpenSourceListEntries, getOpenSourcePage, getPublicDatabase, groupAiNewsByDay, io, listAiNewsCategories, openSourceCategories, requiredEnv, searchAiNewsDocuments };
