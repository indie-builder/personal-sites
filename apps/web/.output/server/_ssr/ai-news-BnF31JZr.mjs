import { Await } from "../_libs/@tanstack/react-router+[...].mjs";
import { require_jsx_runtime } from "../_libs/@openuidev/react-headless+[...].mjs";
import { FeedPage, Route$20 } from "./router-D7Io2iE5.mjs";
import { AiNewsStream } from "./ai-news-stream-D3-aXruy.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ai-news-BnF31JZr.js
var import_jsx_runtime = require_jsx_runtime();
function AiNewsPage() {
	const { feed } = Route$20.useLoaderData();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FeedPage, {
		label: "每日动态",
		section: "ai-news",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Await, {
			promise: feed,
			children: (aiNewsPage) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AiNewsStream, {
				initialHasMore: aiNewsPage.hasMore,
				initialItems: aiNewsPage.items
			})
		})
	});
}
//#endregion
export { AiNewsPage as component };
