import { __toESM } from "../_runtime.mjs";
import { getOpenSourceCategoryLabel, getOpenSourceDimensionLabel, openSourceCategories } from "./open-source-DgxG6IN-.mjs";
import { require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { Await, Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { require_jsx_runtime } from "../_libs/@openuidev/react-headless+[...].mjs";
import { useReducedMotion } from "../_libs/framer-motion+[...].mjs";
import { motion } from "../_libs/motion.mjs";
import { FeedPage, Route$7, STREAM_EASE, STREAM_REVEAL_DURATION, STREAM_REVEAL_Y, open_source_module_default, staggerDelay } from "./router-CHLaDmxj.mjs";
import { StreamFilterMenu, useStickyToolbarOffset } from "./stream-filter-menu-RoVngBkI.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/open-source-CkSPkmCB.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function OpenSourceStream({ entries }) {
	const [category, setCategory] = (0, import_react.useState)("all");
	const [hasFiltered, setHasFiltered] = (0, import_react.useState)(false);
	const streamRef = (0, import_react.useRef)(null);
	useStickyToolbarOffset(streamRef);
	const reduceMotion = useReducedMotion();
	const categoryCounts = new Map(openSourceCategories.map((item) => [item.id, item.id === "all" ? entries.length : 0]));
	for (const entry of entries) categoryCounts.set(entry.category, (categoryCounts.get(entry.category) ?? 0) + 1);
	const visibleEntries = category === "all" ? entries : entries.filter((entry) => entry.category === category);
	const filterLabel = category === "all" ? "全部主题" : getOpenSourceCategoryLabel(category);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		"aria-label": "已判读的开源项目",
		className: open_source_module_default.streamSection,
		ref: streamRef,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "stream-date-toolbar",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "curation-stream__date",
					children: [visibleEntries.length, " 个项目"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StreamFilterMenu, {
					ariaLabel: `筛选开源关注：${filterLabel}`,
					triggerLabel: filterLabel,
					value: category,
					options: openSourceCategories.map((item) => ({
						value: item.id,
						label: `${item.id === "all" ? "全部主题" : item.label} · ${categoryCounts.get(item.id) ?? 0}`
					})),
					onSelect: (value) => {
						const next = openSourceCategories.find((item) => item.id === value);
						if (!next || next.id === category) return;
						setHasFiltered(true);
						setCategory(next.id);
					},
					menuClassName: open_source_module_default.categoryMenu
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
				"aria-live": "polite",
				className: open_source_module_default.stream,
				children: visibleEntries.map((entry, index) => {
					const animateEntry = hasFiltered && !reduceMotion && index < 8;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(motion.li, {
						animate: animateEntry ? {
							opacity: 1,
							y: 0
						} : void 0,
						initial: animateEntry ? {
							opacity: 0,
							y: `${STREAM_REVEAL_Y}rem`
						} : false,
						transition: {
							delay: animateEntry ? staggerDelay(index) : 0,
							duration: animateEntry ? STREAM_REVEAL_DURATION : 0,
							ease: STREAM_EASE
						},
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							params: { slug: entry.slug },
							to: "/open-source/$slug",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: open_source_module_default.meta,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: getOpenSourceCategoryLabel(entry.category) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: entry.status })]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: open_source_module_default.copy,
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: entry.repository }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: open_source_module_default.source,
										children: entry.sourceSummary
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: open_source_module_default.tags,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: getOpenSourceDimensionLabel(entry.dimensions[0]) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: entry.type })]
									})
								]
							})]
						})
					}, entry.slug);
				})
			}, category),
			visibleEntries.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: open_source_module_default.empty,
				children: "暂时没有符合当前筛选的已公开仓库。"
			}) : null
		]
	});
}
function OpenSourcePage() {
	const { entries } = Route$7.useLoaderData();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FeedPage, {
		label: "开源关注",
		section: "open-source",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Await, {
			promise: entries,
			children: (openSourceEntries) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OpenSourceStream, { entries: openSourceEntries })
		})
	});
}
//#endregion
export { OpenSourcePage as component };
