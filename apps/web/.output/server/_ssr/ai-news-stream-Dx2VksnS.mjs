import { __toESM } from "../_runtime.mjs";
import { require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { require_jsx_runtime } from "../_libs/@openuidev/react-headless+[...].mjs";
import { useReducedMotion } from "../_libs/framer-motion+[...].mjs";
import { motion } from "../_libs/motion.mjs";
import { formatAiNewsClock, getAiNewsCategoryLabel, groupAiNewsByDay, listAiNewsCategories } from "./open-source-DgxG6IN-.mjs";
import { STREAM_EASE, STREAM_REVEAL_DURATION, STREAM_REVEAL_Y, StreamLoadStatus, staggerDelay } from "./router-BKZi6fNy.mjs";
import { aiNewsStreamSnapshot, getCurationScrollTarget, useStreamFeed } from "./use-stream-feed-Crck_SP5.mjs";
import { StreamFilterMenu, useStreamDate } from "./stream-filter-menu-RoVngBkI.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ai-news-stream-Dx2VksnS.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function AiNewsStream({ initialHasMore, initialItems }) {
	const reduceMotion = useReducedMotion();
	const [activeCategory, setActiveCategory] = (0, import_react.useState)(null);
	const [filterVersion, setFilterVersion] = (0, import_react.useState)(0);
	const { appendStart, hasMore, isLoading, items, loadError, loadMore, streamRef } = useStreamFeed({
		apiPath: "/api/ai-news",
		pageSize: 50,
		loadErrorMessage: "暂时无法加载更多每日动态。",
		initialHasMore,
		initialItems,
		snapshot: aiNewsStreamSnapshot,
		snapshotExtra: () => ({ activeCategory }),
		onSnapshotRestore: (snapshot) => setActiveCategory(snapshot.activeCategory)
	});
	const selectCategory = (next) => {
		if (next === activeCategory) return;
		setActiveCategory(next);
		setFilterVersion((version) => version + 1);
	};
	(0, import_react.useEffect)(() => {
		if (filterVersion === 0) return;
		const stream = streamRef.current;
		if (!stream) return;
		getCurationScrollTarget(stream).scrollTo({
			behavior: reduceMotion ? "auto" : "smooth",
			top: 0
		});
	}, [
		filterVersion,
		reduceMotion,
		streamRef
	]);
	const categories = (0, import_react.useMemo)(() => listAiNewsCategories(items), [items]);
	const hasSelected = (0, import_react.useMemo)(() => items.some((item) => item.selected), [items]);
	const itemIndex = (0, import_react.useMemo)(() => new Map(items.map((item, index) => [item.id, index])), [items]);
	const activeFilterLabel = activeCategory === "selected" ? "精选" : activeCategory ? getAiNewsCategoryLabel(activeCategory) : null;
	const groups = (0, import_react.useMemo)(() => {
		const visible = activeCategory === "selected" ? items.filter((item) => item.selected) : activeCategory ? items.filter((item) => item.category === activeCategory) : items;
		return groupAiNewsByDay(visible);
	}, [activeCategory, items]);
	const filteredIndex = (0, import_react.useMemo)(() => {
		const index = /* @__PURE__ */ new Map();
		let position = 0;
		for (const group of groups) for (const item of group.items) {
			index.set(item.id, position);
			position += 1;
		}
		return index;
	}, [groups]);
	const visibleDay = useStreamDate(streamRef, groups);
	const visibleGroup = groups.find((group) => (group.dayKey || "unknown") === visibleDay) ?? groups[0];
	if (initialItems.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
		className: "curation-home__stream",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
			"aria-live": "polite",
			className: "curation-home__stream-status",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "暂时无法获取每日动态，稍后再来看看。" })
		})
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "ai-news__stream",
		ref: streamRef,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "stream-date-toolbar",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "ai-news__day-heading",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "ai-news__day-label",
						children: visibleGroup?.label ?? "每日动态"
					}), visibleGroup ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "ai-news__day-meta",
						children: [
							visibleGroup.weekday,
							" · ",
							visibleGroup.items.length,
							" 条"
						]
					}) : null]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StreamFilterMenu, {
					ariaLabel: `筛选每日动态：${activeFilterLabel ?? "全部动态"}`,
					triggerLabel: activeFilterLabel ?? "全部动态",
					value: activeCategory ?? "all",
					options: [
						{
							value: "all",
							label: "全部动态"
						},
						...hasSelected ? [{
							value: "selected",
							label: "精选动态"
						}] : [],
						...categories.map(({ id, label }) => ({
							value: id,
							label
						}))
					],
					onSelect: (value) => selectCategory(value === "all" ? null : value)
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "ai-news__groups",
				children: groups.map((group, groupIndex) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					"aria-label": group.label,
					className: "ai-news__day",
					"data-stream-date": group.dayKey || "unknown",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
						className: groupIndex === 0 ? "sr-only" : "ai-news__day-heading",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "ai-news__day-label",
							children: group.label
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "ai-news__day-meta",
							children: [
								group.weekday ? `${group.weekday} · ` : "",
								group.items.length,
								" 条"
							]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
						className: "ai-news__timeline",
						children: group.items.map((item) => {
							const index = itemIndex.get(item.id) ?? 0;
							const revealIndex = filteredIndex.get(item.id) ?? 0;
							const isAppended = index >= appendStart;
							const animateMount = !reduceMotion && (isAppended || filterVersion > 0 && revealIndex < 8);
							const mountDelay = isAppended ? staggerDelay(index - appendStart) : staggerDelay(revealIndex);
							return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(motion.li, {
								animate: {
									opacity: 1,
									y: 0
								},
								initial: animateMount ? {
									opacity: 0,
									y: `${STREAM_REVEAL_Y}rem`
								} : false,
								transition: {
									delay: animateMount ? mountDelay : 0,
									duration: STREAM_REVEAL_DURATION,
									ease: STREAM_EASE
								},
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
									className: "ai-news__entry",
									"data-content-id": item.id,
									params: { id: item.id },
									preload: "intent",
									to: "/ai-news/$id",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "ai-news__entry-meta",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("time", {
												dateTime: item.publishedAt ?? void 0,
												children: formatAiNewsClock(item.publishedAt)
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: item.sourceName.replace(/\s*\(@[^)]+\)\s*$/, "") }),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: getAiNewsCategoryLabel(item.category) }),
											item.selected ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "精选" }) : null
										]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "ai-news__entry-copy",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: item.title }), item.summary ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: item.summary }) : null]
									})]
								})
							}, item.id);
						})
					})]
				}, group.dayKey || "unknown"))
			}, activeCategory ?? "all"),
			groups.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(motion.p, {
				animate: { opacity: 1 },
				className: "ai-news__empty",
				initial: reduceMotion ? false : { opacity: 0 },
				transition: {
					duration: STREAM_REVEAL_DURATION,
					ease: STREAM_EASE
				},
				children: "这个分类下暂时没有每日动态。"
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				"aria-live": "polite",
				className: "ai-news__status",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "sr-only",
						children: activeFilterLabel ? `正在显示${activeFilterLabel}动态` : "正在显示全部动态"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StreamLoadStatus, {
						isLoading,
						loadError,
						loadMore
					}),
					!hasMore && !loadError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: activeFilterLabel ? `已加载全部${activeFilterLabel}动态` : "已加载全部动态" }) : null
				]
			})
		]
	});
}
//#endregion
export { AiNewsStream };
