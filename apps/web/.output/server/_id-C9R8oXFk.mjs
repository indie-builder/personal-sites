import { require_jsx_runtime } from "./_libs/@openuidev/react-headless+[...].mjs";
import { CurationEntryView, Route$8 } from "./_ssr/router-C2oYZlh0.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/_id-C9R8oXFk.js
var import_jsx_runtime = require_jsx_runtime();
function CurationEntryPage() {
	const { entry } = Route$8.useLoaderData();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CurationEntryView, {
		context: "curation",
		entry
	});
}
//#endregion
export { CurationEntryPage as component };
