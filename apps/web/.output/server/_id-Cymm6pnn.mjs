import { formatAiNewsRelativeTime, formatAiNewsTime, getAiNewsCategoryLabel, getAiNewsOriginalAction, getAiNewsUrlHost } from "./_ssr/open-source-DgxG6IN-.mjs";
import { require_jsx_runtime } from "./_libs/@openuidev/react-headless+[...].mjs";
import { ArrowUpRight } from "./_libs/lucide-react.mjs";
import { AiNewsDetailArticle, DetailTopbar, Route$19, useHasMounted } from "./_ssr/router-CHLaDmxj.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/_id-Cymm6pnn.js
var import_jsx_runtime = require_jsx_runtime();
/** 静态详情页的相对时间：服务端渲染为空态，水合后再计算，避免缓存页里的时间过期。 */
function AiNewsRelativeTime({ publishedAt }) {
	if (!useHasMounted()) return null;
	const label = formatAiNewsRelativeTime(publishedAt);
	return label ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: label }) : null;
}
function AiNewsDetailPage() {
	const { item } = Route$19.useLoaderData();
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
