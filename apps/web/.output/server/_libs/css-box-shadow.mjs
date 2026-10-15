import { __commonJSMin } from "../_runtime.mjs";
//#region ../../node_modules/.bun/css-box-shadow@1.0.0-3/node_modules/css-box-shadow/index.js
var require_css_box_shadow = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var VALUES_REG = /,(?![^\(]*\))/;
	var PARTS_REG = /\s(?![^(]*\))/;
	var LENGTH_REG = /^[0-9]+[a-zA-Z%]+?$/;
	var parseValue = (str) => {
		const parts = str.split(PARTS_REG);
		const inset = parts.includes("inset");
		const last = parts.slice(-1)[0];
		const color = !isLength(last) ? last : void 0;
		const [offsetX, offsetY, blurRadius, spreadRadius] = parts.filter((n) => n !== "inset").filter((n) => n !== color).map(toNum);
		return {
			inset,
			offsetX,
			offsetY,
			blurRadius,
			spreadRadius,
			color
		};
	};
	var stringifyValue = (obj) => {
		const { inset, offsetX = 0, offsetY = 0, blurRadius = 0, spreadRadius, color } = obj || {};
		return [
			inset ? "inset" : null,
			offsetX,
			offsetY,
			blurRadius,
			spreadRadius,
			color
		].filter((v) => v !== null && v !== void 0).map(toPx).map((s) => ("" + s).trim()).join(" ");
	};
	var isLength = (v) => v === "0" || LENGTH_REG.test(v);
	var toNum = (v) => {
		if (!/px$/.test(v) && v !== "0") return v;
		const n = parseFloat(v);
		return !isNaN(n) ? n : v;
	};
	var toPx = (n) => typeof n === "number" && n !== 0 ? n + "px" : n;
	var parse = (str) => str.split(VALUES_REG).map((s) => s.trim()).map(parseValue);
	var stringify = (arr) => arr.map(stringifyValue).join(", ");
	module.exports = {
		parse,
		stringify
	};
}));
//#endregion
export { require_css_box_shadow };
