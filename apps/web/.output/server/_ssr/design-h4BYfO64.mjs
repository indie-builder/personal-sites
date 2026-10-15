import { Await } from "../_libs/@tanstack/react-router+[...].mjs";
import { require_jsx_runtime } from "../_libs/@openuidev/react-headless+[...].mjs";
import { FeedPage, Route$9 } from "./router-DuGGPPwl.mjs";
import { CurationStream } from "./curation-stream-DSYfwspl.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/design-h4BYfO64.js
var import_jsx_runtime = require_jsx_runtime();
function DesignPage() {
	const { designPage } = Route$9.useLoaderData();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FeedPage, {
		label: "设计收藏",
		section: "design",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Await, {
			promise: designPage,
			children: (page) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CurationStream, {
				apiPath: "/api/design",
				emptyLabel: "暂时没有高置信度的设计收藏。",
				initialHasMore: page.hasMore,
				initialItems: page.items,
				loadErrorMessage: "暂时无法加载更多设计收藏。",
				loadedAllLabel: "已加载全部设计收藏",
				snapshotKey: "design-stream-v1",
				variant: "design"
			})
		})
	});
}
//#endregion
export { DesignPage as component };
