import { Await } from "../_libs/@tanstack/react-router+[...].mjs";
import { require_jsx_runtime } from "../_libs/@openuidev/react-headless+[...].mjs";
import { FeedPage, Route$11 } from "./router-BKZi6fNy.mjs";
import { TaggedCurationStream } from "./curation-stream-Chw6yC0q.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/curation-BbEBc_jn.js
var import_jsx_runtime = require_jsx_runtime();
function CurationPage() {
	const { feed } = Route$11.useLoaderData();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FeedPage, {
		label: "每日关注",
		section: "daily",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Await, {
			promise: feed,
			children: ({ page, tags }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TaggedCurationStream, {
				initialHasMore: page.hasMore,
				initialItems: page.items,
				tags
			})
		})
	});
}
//#endregion
export { CurationPage as component };
