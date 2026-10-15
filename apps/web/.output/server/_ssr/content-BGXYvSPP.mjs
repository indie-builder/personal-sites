import { TSS_SERVER_FUNCTION, createServerFn } from "./ssr.mjs";
import { Literals, NullOr, Number, String, Struct, all, decodeUnknownSync, optional, runPromise } from "../_libs/effect.mjs";
import { findCurationItem, getAiNewsItem, getAiNewsPage, getCurationNeighbors, getCurationPage, getCurationTags, getDesignCurationPage, getDouyinCurationPage, getOpenSourceEntry, getOpenSourceListEntries } from "./open-source-DgxG6IN-.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/content-BGXYvSPP.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var pageInput = Struct({
	limit: optional(Number),
	offset: optional(Number),
	tag: optional(NullOr(String))
});
/** 每日动态分页（首页与 /ai-news 首屏；合并 SQLite 历史与 Supabase 增量）。 */
var fetchAiNewsPage_createServerFn_handler = createServerRpc({
	id: "c2be3c536d048567dcb0bad67d089668b85517c332ca44b1f7dc66a1a1e9e607",
	name: "fetchAiNewsPage",
	filename: "src/functions/content.ts"
}, (opts) => fetchAiNewsPage.__executeServer(opts));
var fetchAiNewsPage = createServerFn({ method: "GET" }).validator((input) => decodeUnknownSync(Struct({
	offset: Number,
	limit: Number
}))(input ?? {})).handler(fetchAiNewsPage_createServerFn_handler, async ({ data }) => runPromise(getAiNewsPage(data.offset, data.limit)));
var fetchAiNewsItem_createServerFn_handler = createServerRpc({
	id: "4f3963247b12f02090fa3da8be4d5199ea1c85a10c96c6a37de7a1408f20dc3d",
	name: "fetchAiNewsItem",
	filename: "src/functions/content.ts"
}, (opts) => fetchAiNewsItem.__executeServer(opts));
var fetchAiNewsItem = createServerFn({ method: "GET" }).validator((input) => decodeUnknownSync(Struct({ id: String }))(input)).handler(fetchAiNewsItem_createServerFn_handler, async ({ data }) => runPromise(getAiNewsItem(data.id)));
var fetchCurationFeed_createServerFn_handler = createServerRpc({
	id: "9f96209fcd0c2e871ad5c0af35101fe12be312aab649c067eb545e4c600552f7",
	name: "fetchCurationFeed",
	filename: "src/functions/content.ts"
}, (opts) => fetchCurationFeed.__executeServer(opts));
var fetchCurationFeed = createServerFn({ method: "GET" }).validator((input) => decodeUnknownSync(pageInput)(input ?? {})).handler(fetchCurationFeed_createServerFn_handler, async ({ data }) => runPromise(all({
	page: getCurationPage(data.offset ?? 0, data.limit ?? 20, data.tag ?? null),
	tags: getCurationTags()
})));
var fetchDesignPage_createServerFn_handler = createServerRpc({
	id: "986a875b84db8e5a9a1cf6a05227d62c5eb5069d82992b8ced169e5726267167",
	name: "fetchDesignPage",
	filename: "src/functions/content.ts"
}, (opts) => fetchDesignPage.__executeServer(opts));
var fetchDesignPage = createServerFn({ method: "GET" }).validator((input) => decodeUnknownSync(Struct({
	offset: Number,
	limit: Number
}))(input ?? {})).handler(fetchDesignPage_createServerFn_handler, async ({ data }) => runPromise(getDesignCurationPage(data.offset, data.limit)));
var fetchDouyinPage_createServerFn_handler = createServerRpc({
	id: "a39971a6ee6f0199e3064e88f67135247797ed64388161f9ea80f23a537cbdda",
	name: "fetchDouyinPage",
	filename: "src/functions/content.ts"
}, (opts) => fetchDouyinPage.__executeServer(opts));
var fetchDouyinPage = createServerFn({ method: "GET" }).validator((input) => decodeUnknownSync(Struct({
	offset: Number,
	limit: Number
}))(input ?? {})).handler(fetchDouyinPage_createServerFn_handler, async ({ data }) => runPromise(getDouyinCurationPage(data.offset, data.limit)));
var fetchOpenSourceEntries_createServerFn_handler = createServerRpc({
	id: "8eb68cef1317990e5e52949743be9622d519c7bee590de89732a896e02fa78b0",
	name: "fetchOpenSourceEntries",
	filename: "src/functions/content.ts"
}, (opts) => fetchOpenSourceEntries.__executeServer(opts));
var fetchOpenSourceEntries = createServerFn({ method: "GET" }).handler(fetchOpenSourceEntries_createServerFn_handler, () => runPromise(getOpenSourceListEntries()));
var fetchOpenSourceEntry_createServerFn_handler = createServerRpc({
	id: "7b0c716ecadd5492215c4fee7b1ab979be78c28d88456ad752c0674d360362a5",
	name: "fetchOpenSourceEntry",
	filename: "src/functions/content.ts"
}, (opts) => fetchOpenSourceEntry.__executeServer(opts));
var fetchOpenSourceEntry = createServerFn({ method: "GET" }).validator((input) => decodeUnknownSync(Struct({ slug: String }))(input)).handler(fetchOpenSourceEntry_createServerFn_handler, async ({ data }) => runPromise(getOpenSourceEntry(data.slug)));
var fetchCurationEntry_createServerFn_handler = createServerRpc({
	id: "15e027738148afc6dd5ac09918f45c3d72c76be6893863d22ac19ffce269c55f",
	name: "fetchCurationEntry",
	filename: "src/functions/content.ts"
}, (opts) => fetchCurationEntry.__executeServer(opts));
var fetchCurationEntry = createServerFn({ method: "GET" }).validator((input) => decodeUnknownSync(Struct({
	context: Literals(["curation", "design"]),
	id: String
}))(input)).handler(fetchCurationEntry_createServerFn_handler, async ({ data }) => {
	const item = await runPromise(findCurationItem(data.id));
	if (!item || data.context === "design" && item.design?.status !== "include") return null;
	return {
		item,
		neighbors: await runPromise(getCurationNeighbors(data.id, data.context === "design"))
	};
});
//#endregion
export { fetchAiNewsItem_createServerFn_handler, fetchAiNewsPage_createServerFn_handler, fetchCurationEntry_createServerFn_handler, fetchCurationFeed_createServerFn_handler, fetchDesignPage_createServerFn_handler, fetchDouyinPage_createServerFn_handler, fetchOpenSourceEntries_createServerFn_handler, fetchOpenSourceEntry_createServerFn_handler };
