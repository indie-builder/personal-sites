import { Await } from "../_libs/@tanstack/react-router+[...].mjs";
import { require_jsx_runtime } from "../_libs/@openuidev/react-headless+[...].mjs";
import { FeedPage, Route$25 } from "./router-D7Io2iE5.mjs";
import { CurationStream } from "./curation-stream-CPUtP0Uk.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/douyin-CPLZQAE7.js
var import_jsx_runtime = require_jsx_runtime();
function DouyinPage() {
	const { douyinPage } = Route$25.useLoaderData();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FeedPage, {
		label: "抖音收藏",
		section: "douyin",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Await, {
			promise: douyinPage,
			children: (page) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CurationStream, {
				apiPath: "/api/douyin",
				emptyLabel: "暂无已发布的抖音收藏条目。",
				initialHasMore: page.hasMore,
				initialItems: page.items,
				loadErrorMessage: "暂时无法加载更多抖音收藏。",
				loadedAllLabel: "已加载全部抖音收藏",
				snapshotKey: "douyin-stream-v1"
			})
		})
	});
}
//#endregion
export { DouyinPage as component };
