import { __commonJSMin } from "../_runtime.mjs";
//#region ../../node_modules/.bun/hex-rgb@4.3.0/node_modules/hex-rgb/index.js
var require_hex_rgb = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var hexCharacters = "a-f\\d";
	var match3or4Hex = `#?[${hexCharacters}]{3}[${hexCharacters}]?`;
	var match6or8Hex = `#?[${hexCharacters}]{6}([${hexCharacters}]{2})?`;
	var nonHexChars = new RegExp(`[^#${hexCharacters}]`, "gi");
	var validHexSize = new RegExp(`^${match3or4Hex}$|^${match6or8Hex}$`, "i");
	module.exports = (hex, options = {}) => {
		if (typeof hex !== "string" || nonHexChars.test(hex) || !validHexSize.test(hex)) throw new TypeError("Expected a valid hex string");
		hex = hex.replace(/^#/, "");
		let alphaFromHex = 1;
		if (hex.length === 8) {
			alphaFromHex = Number.parseInt(hex.slice(6, 8), 16) / 255;
			hex = hex.slice(0, 6);
		}
		if (hex.length === 4) {
			alphaFromHex = Number.parseInt(hex.slice(3, 4).repeat(2), 16) / 255;
			hex = hex.slice(0, 3);
		}
		if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
		const number = Number.parseInt(hex, 16);
		const red = number >> 16;
		const green = number >> 8 & 255;
		const blue = number & 255;
		const alpha = typeof options.alpha === "number" ? options.alpha : alphaFromHex;
		if (options.format === "array") return [
			red,
			green,
			blue,
			alpha
		];
		if (options.format === "css") return `rgb(${red} ${green} ${blue}${alpha === 1 ? "" : ` / ${Number((alpha * 100).toFixed(2))}%`})`;
		return {
			red,
			green,
			blue,
			alpha
		};
	};
}));
//#endregion
export { require_hex_rgb };
