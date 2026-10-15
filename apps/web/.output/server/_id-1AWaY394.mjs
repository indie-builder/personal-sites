import { __toESM } from "./_runtime.mjs";
import { formatAiNewsRelativeTime, formatAiNewsTime, getAiNewsCategoryLabel, getAiNewsOriginalAction, getAiNewsUrlHost } from "./_ssr/open-source-D3tVDeeh.mjs";
import { require_react } from "./_libs/@floating-ui/react-dom+[...].mjs";
import { require_jsx_runtime } from "./_libs/@openuidev/react-headless+[...].mjs";
import { ArrowUpRight } from "./_libs/lucide-react.mjs";
import { DetailTopbar, Route$16, useHasMounted } from "./_ssr/router-C2oYZlh0.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/_id-1AWaY394.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/** 静态详情页的相对时间：服务端渲染为空态，水合后再计算，避免缓存页里的时间过期。 */
function AiNewsRelativeTime({ publishedAt }) {
	if (!useHasMounted()) return null;
	const label = formatAiNewsRelativeTime(publishedAt);
	return label ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: label }) : null;
}
var FALLBACK_PAINTED_KEY = "personal-site:ai-news-fallback-painted";
var FALLBACK_PAINTED_FRESH_MS = 3e3;
function parsePaintedMarker(raw) {
	if (raw === null) return null;
	try {
		const marker = JSON.parse(raw);
		if (typeof marker.path !== "string" || typeof marker.at !== "number") return null;
		return {
			at: marker.at,
			path: marker.path,
			entryId: typeof marker.entryId === "string" ? marker.entryId : null
		};
	} catch {
		return null;
	}
}
function AiNewsDetailArticle({ children, contentId }) {
	const articleRef = (0, import_react.useRef)(null);
	(0, import_react.useLayoutEffect)(() => {
		const article = articleRef.current;
		if (!article) return;
		let marker = null;
		try {
			marker = parsePaintedMarker(window.sessionStorage.getItem(FALLBACK_PAINTED_KEY));
			window.sessionStorage.removeItem(FALLBACK_PAINTED_KEY);
		} catch {
			marker = null;
		}
		if (marker && marker.path === window.location.pathname && Date.now() - marker.at <= FALLBACK_PAINTED_FRESH_MS && marker.entryId === (window.navigation?.currentEntry?.id ?? null)) {
			article.classList.add("ai-news-detail__article--armed");
			getComputedStyle(article).opacity;
			article.classList.remove("ai-news-detail__article--armed");
			article.classList.add("ai-news-detail__article--resolved");
		}
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("article", {
		className: "ai-news-detail__article",
		"data-content-id": contentId,
		ref: articleRef,
		children
	});
}
function AiNewsDetailPage() {
	const { item } = Route$16.useLoaderData();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AiNewsDetailArticle, {
		contentId: item.id,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DetailTopbar, {
				backClassName: "ai-news-detail__back",
				backHref: "/ai-news",
				backLabel: "返回每日动态",
				className: "ai-news-detail__topbar"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "ai-news-detail__header",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "ai-news-detail__kicker",
						children: [getAiNewsCategoryLabel(item.category), item.selected ? " · 精选" : ""]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", { children: item.title }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "ai-news-detail__meta",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: item.sourceName }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("time", {
								dateTime: item.publishedAt ?? void 0,
								children: formatAiNewsTime(item.publishedAt)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AiNewsRelativeTime, { publishedAt: item.publishedAt })
						]
					})
				]
			}),
			item.summary ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				"aria-label": "导读",
				className: "ai-news-detail__section ai-news-detail__lead",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "ai-news-detail__eyebrow",
					children: "导读"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: item.summary })]
			}) : null,
			item.reason ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				"aria-label": "推荐理由",
				className: "ai-news-detail__section ai-news-detail__reason",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "ai-news-detail__eyebrow",
					children: "推荐理由"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: item.reason })]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
				className: "ai-news-detail__source",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
					className: "ai-news-detail__cta",
					href: item.url,
					rel: "noreferrer",
					target: "_blank",
					children: [getAiNewsOriginalAction(item.url), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUpRight, { "aria-hidden": "true" })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "ai-news-detail__cta-host",
					children: getAiNewsUrlHost(item.url)
				})]
			})
		]
	});
}
//#endregion
export { AiNewsDetailPage as component };
