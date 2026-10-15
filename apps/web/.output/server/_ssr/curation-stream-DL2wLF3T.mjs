import { __toESM } from "../_runtime.mjs";
import "./open-source-DgxG6IN-.mjs";
import { require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { require_jsx_runtime } from "../_libs/@openuidev/react-headless+[...].mjs";
import { useReducedMotion } from "../_libs/framer-motion+[...].mjs";
import { motion } from "../_libs/motion.mjs";
import { STREAM_EASE, STREAM_REVEAL_DURATION, STREAM_REVEAL_Y, StreamLoadStatus, XVideoPlayer, formatCurationClip, formatCurationDate, staggerDelay } from "./router-CHLaDmxj.mjs";
import { curationStreamSnapshot, getCurationScrollTarget, useStreamFeed } from "./use-stream-feed-Crck_SP5.mjs";
import { StreamFilterMenu, useStreamDate } from "./stream-filter-menu-RoVngBkI.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/curation-stream-DL2wLF3T.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var TAG_STORAGE_KEY = "curation-active-tag";
function TaggedCurationStream({ initialHasMore, initialItems, tags }) {
	const reduceMotion = useReducedMotion();
	const [activeTag, setActiveTag] = (0, import_react.useState)(null);
	const wrapperRef = (0, import_react.useRef)(null);
	(0, import_react.useLayoutEffect)(() => {
		try {
			const saved = window.sessionStorage.getItem(TAG_STORAGE_KEY);
			if (tags.some(({ tag }) => tag === saved)) setActiveTag(saved);
		} catch {}
	}, [tags]);
	const selectTag = (value, viaKeyboard = false) => {
		const next = value === "all" ? null : value;
		if (next === activeTag) return;
		setActiveTag(next);
		try {
			if (next) window.sessionStorage.setItem(TAG_STORAGE_KEY, next);
			else window.sessionStorage.removeItem(TAG_STORAGE_KEY);
		} catch {}
		if (wrapperRef.current) getCurationScrollTarget(wrapperRef.current).scrollTo({
			behavior: reduceMotion || viaKeyboard ? "instant" : "smooth",
			top: 0
		});
	};
	const selected = tags.find(({ tag }) => tag === activeTag);
	const filter = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StreamFilterMenu, {
		ariaLabel: `筛选每日关注：${activeTag ?? "全部主题"}`,
		triggerLabel: activeTag ?? "全部主题",
		value: activeTag ?? "all",
		options: [{
			value: "all",
			label: "全部主题"
		}, ...tags.map(({ tag, count }) => ({
			value: tag,
			label: `${tag} · ${count}`
		}))],
		onSelect: selectTag,
		menuClassName: "curation-category-menu"
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		ref: wrapperRef,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CurationStream, {
			apiPath: activeTag ? `/api/curation?tag=${encodeURIComponent(activeTag)}` : "/api/curation",
			emptyLabel: "这个主题暂无已发布内容。",
			filter,
			initialHasMore: activeTag ? true : initialHasMore,
			initialItems: activeTag ? [] : initialItems,
			snapshotHeadId: selected?.headId,
			snapshotKey: activeTag ? `curation-stream-tag-${activeTag}-v1` : void 0
		}, activeTag ?? "all")
	});
}
function CurationStream({ apiPath, emptyLabel = "暂无已发布的策展条目。", initialHasMore, initialItems, filter, snapshotHeadId, snapshotKey, loadErrorMessage = "暂时无法加载更多策展内容。", loadedAllLabel = "已加载全部策展内容", variant = "default" }) {
	const wrapperRef = (0, import_react.useRef)(null);
	const reduceMotion = useReducedMotion();
	const { appendStart, hasMore, isLoading, items, loadError, loadMore, streamRef } = useStreamFeed({
		apiPath,
		pageSize: 20,
		loadErrorMessage,
		initialHasMore,
		initialItems,
		snapshotHeadId,
		snapshot: curationStreamSnapshot,
		storageKey: snapshotKey
	});
	const currentDate = useStreamDate(wrapperRef, items) ?? (items[0] ? formatCurationDate(items[0]) : null);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		ref: wrapperRef,
		children: [currentDate || filter ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "stream-date-toolbar",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "curation-stream__date",
				children: currentDate ?? "每日关注"
			}), filter]
		}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ol", {
			className: "curation-home__stream",
			ref: streamRef,
			children: [items.map((item, index) => {
				const isAppended = index >= appendStart;
				const playableMedia = item.media.filter((media) => media.videoUrl);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(motion.li, {
					animate: isAppended ? {
						opacity: 1,
						y: 0
					} : void 0,
					initial: isAppended && !reduceMotion ? {
						opacity: 0,
						y: `${STREAM_REVEAL_Y}rem`
					} : false,
					"data-stream-date": formatCurationDate(item),
					transition: {
						delay: isAppended ? staggerDelay(index - appendStart) : 0,
						duration: STREAM_REVEAL_DURATION,
						ease: STREAM_EASE
					},
					children: variant === "design" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
						className: "design-curation__entry",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "curation-home__stream-meta",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("time", {
									dateTime: item.collectedAt ?? item.publishedAt ?? void 0,
									children: formatCurationDate(item)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: `X · @${item.author.handle}` }),
								item.design?.categories.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: item.design.categories.join(" · ") }) : null
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "curation-home__stream-copy",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
									"data-content-id": item.id,
									params: { id: item.id },
									to: "/design/$id",
									children: item.title
								}) }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: item.summary }),
								playableMedia.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "design-curation__media",
									children: playableMedia.map((media) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(XVideoPlayer, {
										compact: true,
										isAnimatedGif: media.type === "animated_gif",
										itemTitle: item.title,
										poster: media.previewUrl ?? media.url,
										tweetUrl: item.source.url,
										videoUrl: media.videoUrl
									}, media.videoUrl))
								}) : null,
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StreamClipAndTags, { item })
							]
						})]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						"data-content-id": item.id,
						params: { id: item.id },
						to: "/curation/$id",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "curation-home__stream-meta",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("time", {
									dateTime: item.collectedAt ?? item.publishedAt ?? void 0,
									children: formatCurationDate(item)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: item.source.platform === "x" ? `X · @${item.author.handle}` : `抖音 · ${item.author.name}` }),
								item.attachments.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: item.attachments.join(" · ") }) : null
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "curation-home__stream-copy",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: item.title }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: item.summary }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StreamClipAndTags, { item })
							]
						})]
					})
				}, item.id);
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				"aria-live": "polite",
				className: "curation-home__stream-status",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StreamLoadStatus, {
					isLoading,
					loadError,
					loadMore
				}), !hasMore && !loadError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: items.length === 0 ? emptyLabel : loadedAllLabel }) : null]
			})]
		})]
	});
}
/** 两种列表变体共用的剪报摘录 + 标签行；判断正文之外的原声音登记。 */
function StreamClipAndTags({ item }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [item.text.trim() ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("blockquote", {
		className: "curation-home__stream-clip",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: formatCurationClip(item.text) })
	}) : null, item.tags.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "curation-home__stream-tags",
		children: item.tags.join(" · ")
	}) : null] });
}
//#endregion
export { CurationStream, TaggedCurationStream };
