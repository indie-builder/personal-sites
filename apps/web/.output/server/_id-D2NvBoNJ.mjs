import { require_jsx_runtime } from "./_libs/@openuidev/react-headless+[...].mjs";
import { CurationEntryView, Route$7 } from "./_ssr/router-C2oYZlh0.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/_id-D2NvBoNJ.js
var import_jsx_runtime = require_jsx_runtime();
function DesignEntryPage() {
	const { entry } = Route$7.useLoaderData();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CurationEntryView, {
		context: "design",
		entry
	});
}
//#endregion
export { DesignEntryPage as component };
