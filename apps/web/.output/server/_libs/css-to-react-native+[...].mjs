import { __commonJSMin } from "../_runtime.mjs";
import { require_camelize } from "./camelize.mjs";
import { require_css_color_keywords } from "./css-color-keywords.mjs";
//#region ../../node_modules/.bun/postcss-value-parser@4.2.0/node_modules/postcss-value-parser/lib/parse.js
var require_parse = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var openParentheses = "(".charCodeAt(0);
	var closeParentheses = ")".charCodeAt(0);
	var singleQuote = "'".charCodeAt(0);
	var doubleQuote = "\"".charCodeAt(0);
	var backslash = "\\".charCodeAt(0);
	var slash = "/".charCodeAt(0);
	var comma = ",".charCodeAt(0);
	var colon = ":".charCodeAt(0);
	var star = "*".charCodeAt(0);
	var uLower = "u".charCodeAt(0);
	var uUpper = "U".charCodeAt(0);
	var plus = "+".charCodeAt(0);
	var isUnicodeRange = /^[a-f0-9?-]+$/i;
	module.exports = function(input) {
		var tokens = [];
		var value = input;
		var next, quote, prev, token, escape, escapePos, whitespacePos, parenthesesOpenPos;
		var pos = 0;
		var code = value.charCodeAt(pos);
		var max = value.length;
		var stack = [{ nodes: tokens }];
		var balanced = 0;
		var parent;
		var name = "";
		var before = "";
		var after = "";
		while (pos < max) if (code <= 32) {
			next = pos;
			do {
				next += 1;
				code = value.charCodeAt(next);
			} while (code <= 32);
			token = value.slice(pos, next);
			prev = tokens[tokens.length - 1];
			if (code === closeParentheses && balanced) after = token;
			else if (prev && prev.type === "div") {
				prev.after = token;
				prev.sourceEndIndex += token.length;
			} else if (code === comma || code === colon || code === slash && value.charCodeAt(next + 1) !== star && (!parent || parent && parent.type === "function" && parent.value !== "calc")) before = token;
			else tokens.push({
				type: "space",
				sourceIndex: pos,
				sourceEndIndex: next,
				value: token
			});
			pos = next;
		} else if (code === singleQuote || code === doubleQuote) {
			next = pos;
			quote = code === singleQuote ? "'" : "\"";
			token = {
				type: "string",
				sourceIndex: pos,
				quote
			};
			do {
				escape = false;
				next = value.indexOf(quote, next + 1);
				if (~next) {
					escapePos = next;
					while (value.charCodeAt(escapePos - 1) === backslash) {
						escapePos -= 1;
						escape = !escape;
					}
				} else {
					value += quote;
					next = value.length - 1;
					token.unclosed = true;
				}
			} while (escape);
			token.value = value.slice(pos + 1, next);
			token.sourceEndIndex = token.unclosed ? next : next + 1;
			tokens.push(token);
			pos = next + 1;
			code = value.charCodeAt(pos);
		} else if (code === slash && value.charCodeAt(pos + 1) === star) {
			next = value.indexOf("*/", pos);
			token = {
				type: "comment",
				sourceIndex: pos,
				sourceEndIndex: next + 2
			};
			if (next === -1) {
				token.unclosed = true;
				next = value.length;
				token.sourceEndIndex = next;
			}
			token.value = value.slice(pos + 2, next);
			tokens.push(token);
			pos = next + 2;
			code = value.charCodeAt(pos);
		} else if ((code === slash || code === star) && parent && parent.type === "function" && parent.value === "calc") {
			token = value[pos];
			tokens.push({
				type: "word",
				sourceIndex: pos - before.length,
				sourceEndIndex: pos + token.length,
				value: token
			});
			pos += 1;
			code = value.charCodeAt(pos);
		} else if (code === slash || code === comma || code === colon) {
			token = value[pos];
			tokens.push({
				type: "div",
				sourceIndex: pos - before.length,
				sourceEndIndex: pos + token.length,
				value: token,
				before,
				after: ""
			});
			before = "";
			pos += 1;
			code = value.charCodeAt(pos);
		} else if (openParentheses === code) {
			next = pos;
			do {
				next += 1;
				code = value.charCodeAt(next);
			} while (code <= 32);
			parenthesesOpenPos = pos;
			token = {
				type: "function",
				sourceIndex: pos - name.length,
				value: name,
				before: value.slice(parenthesesOpenPos + 1, next)
			};
			pos = next;
			if (name === "url" && code !== singleQuote && code !== doubleQuote) {
				next -= 1;
				do {
					escape = false;
					next = value.indexOf(")", next + 1);
					if (~next) {
						escapePos = next;
						while (value.charCodeAt(escapePos - 1) === backslash) {
							escapePos -= 1;
							escape = !escape;
						}
					} else {
						value += ")";
						next = value.length - 1;
						token.unclosed = true;
					}
				} while (escape);
				whitespacePos = next;
				do {
					whitespacePos -= 1;
					code = value.charCodeAt(whitespacePos);
				} while (code <= 32);
				if (parenthesesOpenPos < whitespacePos) {
					if (pos !== whitespacePos + 1) token.nodes = [{
						type: "word",
						sourceIndex: pos,
						sourceEndIndex: whitespacePos + 1,
						value: value.slice(pos, whitespacePos + 1)
					}];
					else token.nodes = [];
					if (token.unclosed && whitespacePos + 1 !== next) {
						token.after = "";
						token.nodes.push({
							type: "space",
							sourceIndex: whitespacePos + 1,
							sourceEndIndex: next,
							value: value.slice(whitespacePos + 1, next)
						});
					} else {
						token.after = value.slice(whitespacePos + 1, next);
						token.sourceEndIndex = next;
					}
				} else {
					token.after = "";
					token.nodes = [];
				}
				pos = next + 1;
				token.sourceEndIndex = token.unclosed ? next : pos;
				code = value.charCodeAt(pos);
				tokens.push(token);
			} else {
				balanced += 1;
				token.after = "";
				token.sourceEndIndex = pos + 1;
				tokens.push(token);
				stack.push(token);
				tokens = token.nodes = [];
				parent = token;
			}
			name = "";
		} else if (closeParentheses === code && balanced) {
			pos += 1;
			code = value.charCodeAt(pos);
			parent.after = after;
			parent.sourceEndIndex += after.length;
			after = "";
			balanced -= 1;
			stack[stack.length - 1].sourceEndIndex = pos;
			stack.pop();
			parent = stack[balanced];
			tokens = parent.nodes;
		} else {
			next = pos;
			do {
				if (code === backslash) next += 1;
				next += 1;
				code = value.charCodeAt(next);
			} while (next < max && !(code <= 32 || code === singleQuote || code === doubleQuote || code === comma || code === colon || code === slash || code === openParentheses || code === star && parent && parent.type === "function" && parent.value === "calc" || code === slash && parent.type === "function" && parent.value === "calc" || code === closeParentheses && balanced));
			token = value.slice(pos, next);
			if (openParentheses === code) name = token;
			else if ((uLower === token.charCodeAt(0) || uUpper === token.charCodeAt(0)) && plus === token.charCodeAt(1) && isUnicodeRange.test(token.slice(2))) tokens.push({
				type: "unicode-range",
				sourceIndex: pos,
				sourceEndIndex: next,
				value: token
			});
			else tokens.push({
				type: "word",
				sourceIndex: pos,
				sourceEndIndex: next,
				value: token
			});
			pos = next;
		}
		for (pos = stack.length - 1; pos; pos -= 1) {
			stack[pos].unclosed = true;
			stack[pos].sourceEndIndex = value.length;
		}
		return stack[0].nodes;
	};
}));
//#endregion
//#region ../../node_modules/.bun/postcss-value-parser@4.2.0/node_modules/postcss-value-parser/lib/walk.js
var require_walk = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = function walk(nodes, cb, bubble) {
		var i = 0, max = nodes.length, node, result;
		for (; i < max; i += 1) {
			node = nodes[i];
			if (!bubble) result = cb(node, i, nodes);
			if (result !== false && node.type === "function" && Array.isArray(node.nodes)) walk(node.nodes, cb, bubble);
			if (bubble) cb(node, i, nodes);
		}
	};
}));
//#endregion
//#region ../../node_modules/.bun/postcss-value-parser@4.2.0/node_modules/postcss-value-parser/lib/stringify.js
var require_stringify = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	function stringifyNode(node, custom) {
		var type = node.type;
		var value = node.value;
		var buf;
		var customResult;
		if (custom && (customResult = custom(node)) !== void 0) return customResult;
		else if (type === "word" || type === "space") return value;
		else if (type === "string") {
			buf = node.quote || "";
			return buf + value + (node.unclosed ? "" : buf);
		} else if (type === "comment") return "/*" + value + (node.unclosed ? "" : "*/");
		else if (type === "div") return (node.before || "") + value + (node.after || "");
		else if (Array.isArray(node.nodes)) {
			buf = stringify(node.nodes, custom);
			if (type !== "function") return buf;
			return value + "(" + (node.before || "") + buf + (node.after || "") + (node.unclosed ? "" : ")");
		}
		return value;
	}
	function stringify(nodes, custom) {
		var result, i;
		if (Array.isArray(nodes)) {
			result = "";
			for (i = nodes.length - 1; ~i; i -= 1) result = stringifyNode(nodes[i], custom) + result;
			return result;
		}
		return stringifyNode(nodes, custom);
	}
	module.exports = stringify;
}));
//#endregion
//#region ../../node_modules/.bun/postcss-value-parser@4.2.0/node_modules/postcss-value-parser/lib/unit.js
var require_unit = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var minus = "-".charCodeAt(0);
	var plus = "+".charCodeAt(0);
	var dot = ".".charCodeAt(0);
	var exp = "e".charCodeAt(0);
	var EXP = "E".charCodeAt(0);
	function likeNumber(value) {
		var code = value.charCodeAt(0);
		var nextCode;
		if (code === plus || code === minus) {
			nextCode = value.charCodeAt(1);
			if (nextCode >= 48 && nextCode <= 57) return true;
			var nextNextCode = value.charCodeAt(2);
			if (nextCode === dot && nextNextCode >= 48 && nextNextCode <= 57) return true;
			return false;
		}
		if (code === dot) {
			nextCode = value.charCodeAt(1);
			if (nextCode >= 48 && nextCode <= 57) return true;
			return false;
		}
		if (code >= 48 && code <= 57) return true;
		return false;
	}
	module.exports = function(value) {
		var pos = 0;
		var length = value.length;
		var code;
		var nextCode;
		var nextNextCode;
		if (length === 0 || !likeNumber(value)) return false;
		code = value.charCodeAt(pos);
		if (code === plus || code === minus) pos++;
		while (pos < length) {
			code = value.charCodeAt(pos);
			if (code < 48 || code > 57) break;
			pos += 1;
		}
		code = value.charCodeAt(pos);
		nextCode = value.charCodeAt(pos + 1);
		if (code === dot && nextCode >= 48 && nextCode <= 57) {
			pos += 2;
			while (pos < length) {
				code = value.charCodeAt(pos);
				if (code < 48 || code > 57) break;
				pos += 1;
			}
		}
		code = value.charCodeAt(pos);
		nextCode = value.charCodeAt(pos + 1);
		nextNextCode = value.charCodeAt(pos + 2);
		if ((code === exp || code === EXP) && (nextCode >= 48 && nextCode <= 57 || (nextCode === plus || nextCode === minus) && nextNextCode >= 48 && nextNextCode <= 57)) {
			pos += nextCode === plus || nextCode === minus ? 3 : 2;
			while (pos < length) {
				code = value.charCodeAt(pos);
				if (code < 48 || code > 57) break;
				pos += 1;
			}
		}
		return {
			number: value.slice(0, pos),
			unit: value.slice(pos)
		};
	};
}));
//#endregion
//#region ../../node_modules/.bun/postcss-value-parser@4.2.0/node_modules/postcss-value-parser/lib/index.js
var require_lib = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var parse = require_parse();
	var walk = require_walk();
	var stringify = require_stringify();
	function ValueParser(value) {
		if (this instanceof ValueParser) {
			this.nodes = parse(value);
			return this;
		}
		return new ValueParser(value);
	}
	ValueParser.prototype.toString = function() {
		return Array.isArray(this.nodes) ? stringify(this.nodes) : "";
	};
	ValueParser.prototype.walk = function(cb, bubble) {
		walk(this.nodes, cb, bubble);
		return this;
	};
	ValueParser.unit = require_unit();
	ValueParser.walk = walk;
	ValueParser.stringify = stringify;
	module.exports = ValueParser;
}));
//#endregion
//#region ../../node_modules/.bun/css-to-react-native@3.2.0/node_modules/css-to-react-native/index.js
var require_css_to_react_native = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	function _interopDefault(ex) {
		return ex && typeof ex === "object" && "default" in ex ? ex["default"] : ex;
	}
	var parse = require_lib();
	var parse__default = _interopDefault(parse);
	var camelizeStyleName = _interopDefault(require_camelize());
	var cssColorKeywords = _interopDefault(require_css_color_keywords());
	var matchString = function matchString(node) {
		if (node.type !== "string") return null;
		return node.value.replace(/\\([0-9a-f]{1,6})(?:\s|$)/gi, function(match, charCode) {
			return String.fromCharCode(parseInt(charCode, 16));
		}).replace(/\\/g, "");
	};
	var hexColorRe = /^(#(?:[0-9a-f]{3,4}){1,2})$/i;
	var cssFunctionNameRe = /^(rgba?|hsla?|hwb|lab|lch|gray|color)$/;
	var matchColor = function matchColor(node) {
		if (node.type === "word" && (hexColorRe.test(node.value) || node.value in cssColorKeywords || node.value === "transparent")) return node.value;
		else if (node.type === "function" && cssFunctionNameRe.test(node.value)) return parse.stringify(node);
		return null;
	};
	var noneRe = /^(none)$/i;
	var autoRe = /^(auto)$/i;
	var identRe = /(^-?[_a-z][_a-z0-9-]*$)/i;
	var numberRe = /^([+-]?(?:\d*\.)?\d+(?:e[+-]?\d+)?)$/i;
	var lengthRe = /^(0$|(?:[+-]?(?:\d*\.)?\d+(?:e[+-]?\d+)?)(?=px$))/i;
	var unsupportedUnitRe = /^([+-]?(?:\d*\.)?\d+(?:e[+-]?\d+)?(ch|em|ex|rem|vh|vw|vmin|vmax|cm|mm|in|pc|pt))$/i;
	var angleRe = /^([+-]?(?:\d*\.)?\d+(?:e[+-]?\d+)?(?:deg|rad))$/i;
	var percentRe = /^([+-]?(?:\d*\.)?\d+(?:e[+-]?\d+)?%)$/i;
	var noopToken = function noopToken(predicate) {
		return function(node) {
			return predicate(node) ? "<token>" : null;
		};
	};
	var valueForTypeToken = function valueForTypeToken(type) {
		return function(node) {
			return node.type === type ? node.value : null;
		};
	};
	var regExpToken = function regExpToken(regExp, transform) {
		if (transform === void 0) transform = String;
		return function(node) {
			if (node.type !== "word") return null;
			var match = node.value.match(regExp);
			if (match === null) return null;
			return transform(match[1]);
		};
	};
	var SPACE = noopToken(function(node) {
		return node.type === "space";
	});
	var SLASH = noopToken(function(node) {
		return node.type === "div" && node.value === "/";
	});
	var COMMA = noopToken(function(node) {
		return node.type === "div" && node.value === ",";
	});
	var WORD = valueForTypeToken("word");
	var NONE = regExpToken(noneRe);
	var AUTO = regExpToken(autoRe);
	var NUMBER = regExpToken(numberRe, Number);
	var LENGTH = regExpToken(lengthRe, Number);
	var UNSUPPORTED_LENGTH_UNIT = regExpToken(unsupportedUnitRe);
	var ANGLE = regExpToken(angleRe, function(angle) {
		return angle.toLowerCase();
	});
	var PERCENT = regExpToken(percentRe);
	var IDENT = regExpToken(identRe);
	var STRING = matchString;
	var COLOR = matchColor;
	var LINE = regExpToken(/^(none|underline|line-through)$/i);
	var aspectRatio = function aspectRatio(tokenStream) {
		var aspectRatio = tokenStream.expect(NUMBER);
		if (tokenStream.hasTokens()) {
			tokenStream.expect(SLASH);
			aspectRatio /= tokenStream.expect(NUMBER);
		}
		return { aspectRatio };
	};
	var BORDER_STYLE = regExpToken(/^(solid|dashed|dotted)$/);
	var defaultBorderWidth = 1;
	var defaultBorderColor = "black";
	var defaultBorderStyle = "solid";
	var border = function border(tokenStream) {
		var borderWidth;
		var borderColor;
		var borderStyle;
		if (tokenStream.matches(NONE)) {
			tokenStream.expectEmpty();
			return {
				borderWidth: 0,
				borderColor: "black",
				borderStyle: "solid"
			};
		}
		var partsParsed = 0;
		while (partsParsed < 3 && tokenStream.hasTokens()) {
			if (partsParsed !== 0) tokenStream.expect(SPACE);
			if (borderWidth === void 0 && tokenStream.matches(LENGTH, UNSUPPORTED_LENGTH_UNIT)) borderWidth = tokenStream.lastValue;
			else if (borderColor === void 0 && tokenStream.matches(COLOR)) borderColor = tokenStream.lastValue;
			else if (borderStyle === void 0 && tokenStream.matches(BORDER_STYLE)) borderStyle = tokenStream.lastValue;
			else tokenStream["throw"]();
			partsParsed += 1;
		}
		tokenStream.expectEmpty();
		if (borderWidth === void 0) borderWidth = defaultBorderWidth;
		if (borderColor === void 0) borderColor = defaultBorderColor;
		if (borderStyle === void 0) borderStyle = defaultBorderStyle;
		return {
			borderWidth,
			borderColor,
			borderStyle
		};
	};
	var directionFactory = function directionFactory(_ref) {
		var _ref$types = _ref.types, types = _ref$types === void 0 ? [
			LENGTH,
			UNSUPPORTED_LENGTH_UNIT,
			PERCENT
		] : _ref$types, _ref$directions = _ref.directions, directions = _ref$directions === void 0 ? [
			"Top",
			"Right",
			"Bottom",
			"Left"
		] : _ref$directions, _ref$prefix = _ref.prefix, prefix = _ref$prefix === void 0 ? "" : _ref$prefix, _ref$suffix = _ref.suffix, suffix = _ref$suffix === void 0 ? "" : _ref$suffix;
		return function(tokenStream) {
			var _ref2;
			var values = [];
			values.push(tokenStream.expect.apply(tokenStream, types));
			while (values.length < 4 && tokenStream.hasTokens()) {
				tokenStream.expect(SPACE);
				values.push(tokenStream.expect.apply(tokenStream, types));
			}
			tokenStream.expectEmpty();
			var top = values[0], _values$ = values[1], right = _values$ === void 0 ? top : _values$, _values$2 = values[2], bottom = _values$2 === void 0 ? top : _values$2, _values$3 = values[3], left = _values$3 === void 0 ? right : _values$3;
			var keyFor = function keyFor(n) {
				return "" + prefix + directions[n] + suffix;
			};
			return _ref2 = {}, _ref2[keyFor(0)] = top, _ref2[keyFor(1)] = right, _ref2[keyFor(2)] = bottom, _ref2[keyFor(3)] = left, _ref2;
		};
	};
	var parseShadowOffset = function parseShadowOffset(tokenStream) {
		var width = tokenStream.expect(LENGTH);
		var height = tokenStream.matches(SPACE) ? tokenStream.expect(LENGTH) : width;
		tokenStream.expectEmpty();
		return {
			width,
			height
		};
	};
	var parseShadow = function parseShadow(tokenStream) {
		var offsetX;
		var offsetY;
		var radius;
		var color;
		if (tokenStream.matches(NONE)) {
			tokenStream.expectEmpty();
			return {
				offset: {
					width: 0,
					height: 0
				},
				radius: 0,
				color: "black"
			};
		}
		var didParseFirst = false;
		while (tokenStream.hasTokens()) {
			if (didParseFirst) tokenStream.expect(SPACE);
			if (offsetX === void 0 && tokenStream.matches(LENGTH, UNSUPPORTED_LENGTH_UNIT)) {
				offsetX = tokenStream.lastValue;
				tokenStream.expect(SPACE);
				offsetY = tokenStream.expect(LENGTH, UNSUPPORTED_LENGTH_UNIT);
				tokenStream.saveRewindPoint();
				if (tokenStream.matches(SPACE) && tokenStream.matches(LENGTH, UNSUPPORTED_LENGTH_UNIT)) radius = tokenStream.lastValue;
				else tokenStream.rewind();
			} else if (color === void 0 && tokenStream.matches(COLOR)) color = tokenStream.lastValue;
			else tokenStream["throw"]();
			didParseFirst = true;
		}
		if (offsetX === void 0) tokenStream["throw"]();
		return {
			offset: {
				width: offsetX,
				height: offsetY
			},
			radius: radius !== void 0 ? radius : 0,
			color: color !== void 0 ? color : "black"
		};
	};
	var boxShadow = function boxShadow(tokenStream) {
		var _parseShadow = parseShadow(tokenStream);
		return {
			shadowOffset: _parseShadow.offset,
			shadowRadius: _parseShadow.radius,
			shadowColor: _parseShadow.color,
			shadowOpacity: 1
		};
	};
	var defaultFlexGrow = 1;
	var defaultFlexShrink = 1;
	var defaultFlexBasis = 0;
	var flex = function flex(tokenStream) {
		var flexGrow;
		var flexShrink;
		var flexBasis;
		if (tokenStream.matches(NONE)) {
			tokenStream.expectEmpty();
			return {
				flexGrow: 0,
				flexShrink: 0,
				flexBasis: "auto"
			};
		}
		tokenStream.saveRewindPoint();
		if (tokenStream.matches(AUTO) && !tokenStream.hasTokens()) return {
			flexGrow: 1,
			flexShrink: 1,
			flexBasis: "auto"
		};
		tokenStream.rewind();
		var partsParsed = 0;
		while (partsParsed < 2 && tokenStream.hasTokens()) {
			if (partsParsed !== 0) tokenStream.expect(SPACE);
			if (flexGrow === void 0 && tokenStream.matches(NUMBER)) {
				flexGrow = tokenStream.lastValue;
				tokenStream.saveRewindPoint();
				if (tokenStream.matches(SPACE) && tokenStream.matches(NUMBER)) flexShrink = tokenStream.lastValue;
				else tokenStream.rewind();
			} else if (flexBasis === void 0 && tokenStream.matches(LENGTH, UNSUPPORTED_LENGTH_UNIT, PERCENT)) flexBasis = tokenStream.lastValue;
			else if (flexBasis === void 0 && tokenStream.matches(AUTO)) flexBasis = "auto";
			else tokenStream["throw"]();
			partsParsed += 1;
		}
		tokenStream.expectEmpty();
		if (flexGrow === void 0) flexGrow = defaultFlexGrow;
		if (flexShrink === void 0) flexShrink = defaultFlexShrink;
		if (flexBasis === void 0) flexBasis = defaultFlexBasis;
		return {
			flexGrow,
			flexShrink,
			flexBasis
		};
	};
	var FLEX_WRAP = regExpToken(/(nowrap|wrap|wrap-reverse)/);
	var FLEX_DIRECTION = regExpToken(/(row|row-reverse|column|column-reverse)/);
	var defaultFlexWrap = "nowrap";
	var defaultFlexDirection = "row";
	var flexFlow = function flexFlow(tokenStream) {
		var flexWrap;
		var flexDirection;
		var partsParsed = 0;
		while (partsParsed < 2 && tokenStream.hasTokens()) {
			if (partsParsed !== 0) tokenStream.expect(SPACE);
			if (flexWrap === void 0 && tokenStream.matches(FLEX_WRAP)) flexWrap = tokenStream.lastValue;
			else if (flexDirection === void 0 && tokenStream.matches(FLEX_DIRECTION)) flexDirection = tokenStream.lastValue;
			else tokenStream["throw"]();
			partsParsed += 1;
		}
		tokenStream.expectEmpty();
		if (flexWrap === void 0) flexWrap = defaultFlexWrap;
		if (flexDirection === void 0) flexDirection = defaultFlexDirection;
		return {
			flexWrap,
			flexDirection
		};
	};
	var fontFamily = function fontFamily(tokenStream) {
		var fontFamily;
		if (tokenStream.matches(STRING)) fontFamily = tokenStream.lastValue;
		else {
			fontFamily = tokenStream.expect(IDENT);
			while (tokenStream.hasTokens()) {
				tokenStream.expect(SPACE);
				var nextIdent = tokenStream.expect(IDENT);
				fontFamily += " " + nextIdent;
			}
		}
		tokenStream.expectEmpty();
		return { fontFamily };
	};
	var NORMAL = regExpToken(/^(normal)$/);
	var STYLE = regExpToken(/^(italic)$/);
	var WEIGHT = regExpToken(/^([1-9]00|bold)$/);
	var VARIANT = regExpToken(/^(small-caps)$/);
	var defaultFontStyle = "normal";
	var defaultFontWeight = "normal";
	var defaultFontVariant = [];
	var font = function font(tokenStream) {
		var fontStyle;
		var fontWeight;
		var fontVariant;
		var lineHeight;
		var numStyleWeightVariantMatched = 0;
		while (numStyleWeightVariantMatched < 3 && tokenStream.hasTokens()) {
			if (tokenStream.matches(NORMAL));
			else if (fontStyle === void 0 && tokenStream.matches(STYLE)) fontStyle = tokenStream.lastValue;
			else if (fontWeight === void 0 && tokenStream.matches(WEIGHT)) fontWeight = tokenStream.lastValue;
			else if (fontVariant === void 0 && tokenStream.matches(VARIANT)) fontVariant = [tokenStream.lastValue];
			else break;
			tokenStream.expect(SPACE);
			numStyleWeightVariantMatched += 1;
		}
		var fontSize = tokenStream.expect(LENGTH, UNSUPPORTED_LENGTH_UNIT);
		if (tokenStream.matches(SLASH)) lineHeight = tokenStream.expect(LENGTH, UNSUPPORTED_LENGTH_UNIT);
		tokenStream.expect(SPACE);
		var fontFamily$1 = fontFamily(tokenStream).fontFamily;
		if (fontStyle === void 0) fontStyle = defaultFontStyle;
		if (fontWeight === void 0) fontWeight = defaultFontWeight;
		if (fontVariant === void 0) fontVariant = defaultFontVariant;
		var out = {
			fontStyle,
			fontWeight,
			fontVariant,
			fontSize,
			fontFamily: fontFamily$1
		};
		if (lineHeight !== void 0) out.lineHeight = lineHeight;
		return out;
	};
	var fontVariant = function fontVariant(tokenStream) {
		var values = [tokenStream.expect(IDENT)];
		while (tokenStream.hasTokens()) {
			tokenStream.expect(SPACE);
			values.push(tokenStream.expect(IDENT));
		}
		return { fontVariant: values };
	};
	var ALIGN_CONTENT = regExpToken(/(flex-(?:start|end)|center|stretch|space-(?:between|around))/);
	var JUSTIFY_CONTENT = regExpToken(/(flex-(?:start|end)|center|space-(?:between|around|evenly))/);
	var placeContent = function placeContent(tokenStream) {
		var alignContent = tokenStream.expect(ALIGN_CONTENT);
		var justifyContent;
		if (tokenStream.hasTokens()) {
			tokenStream.expect(SPACE);
			justifyContent = tokenStream.expect(JUSTIFY_CONTENT);
		} else justifyContent = "stretch";
		tokenStream.expectEmpty();
		return {
			alignContent,
			justifyContent
		};
	};
	var STYLE$1 = regExpToken(/^(solid|double|dotted|dashed)$/);
	var defaultTextDecorationLine = "none";
	var defaultTextDecorationStyle = "solid";
	var defaultTextDecorationColor = "black";
	var textDecoration = function textDecoration(tokenStream) {
		var line;
		var style;
		var color;
		var didParseFirst = false;
		while (tokenStream.hasTokens()) {
			if (didParseFirst) tokenStream.expect(SPACE);
			if (line === void 0 && tokenStream.matches(LINE)) {
				var lines = [tokenStream.lastValue.toLowerCase()];
				tokenStream.saveRewindPoint();
				if (lines[0] !== "none" && tokenStream.matches(SPACE) && tokenStream.matches(LINE)) {
					lines.push(tokenStream.lastValue.toLowerCase());
					lines.sort().reverse();
				} else tokenStream.rewind();
				line = lines.join(" ");
			} else if (style === void 0 && tokenStream.matches(STYLE$1)) style = tokenStream.lastValue;
			else if (color === void 0 && tokenStream.matches(COLOR)) color = tokenStream.lastValue;
			else tokenStream["throw"]();
			didParseFirst = true;
		}
		return {
			textDecorationLine: line !== void 0 ? line : defaultTextDecorationLine,
			textDecorationColor: color !== void 0 ? color : defaultTextDecorationColor,
			textDecorationStyle: style !== void 0 ? style : defaultTextDecorationStyle
		};
	};
	var textDecorationLine = function textDecorationLine(tokenStream) {
		var lines = [];
		var didParseFirst = false;
		while (tokenStream.hasTokens()) {
			if (didParseFirst) tokenStream.expect(SPACE);
			lines.push(tokenStream.expect(LINE).toLowerCase());
			didParseFirst = true;
		}
		lines.sort().reverse();
		return { textDecorationLine: lines.join(" ") };
	};
	var textShadow = function textShadow(tokenStream) {
		var _parseShadow2 = parseShadow(tokenStream);
		return {
			textShadowOffset: _parseShadow2.offset,
			textShadowRadius: _parseShadow2.radius,
			textShadowColor: _parseShadow2.color
		};
	};
	var oneOfType = function oneOfType(tokenType) {
		return function(functionStream) {
			var value = functionStream.expect(tokenType);
			functionStream.expectEmpty();
			return value;
		};
	};
	var singleNumber = oneOfType(NUMBER);
	var singleLength = oneOfType(LENGTH);
	var singleAngle = oneOfType(ANGLE);
	var xyTransformFactory = function xyTransformFactory(tokenType) {
		return function(key, valueIfOmitted) {
			return function(functionStream) {
				var _ref3, _ref4;
				var x = functionStream.expect(tokenType);
				var y;
				if (functionStream.hasTokens()) {
					functionStream.expect(COMMA);
					y = functionStream.expect(tokenType);
				} else if (valueIfOmitted !== void 0) y = valueIfOmitted;
				else return x;
				functionStream.expectEmpty();
				return [(_ref3 = {}, _ref3[key + "Y"] = y, _ref3), (_ref4 = {}, _ref4[key + "X"] = x, _ref4)];
			};
		};
	};
	var xyNumber = xyTransformFactory(NUMBER);
	var xyLength = xyTransformFactory(LENGTH);
	var xyAngle = xyTransformFactory(ANGLE);
	var partTransforms = {
		perspective: singleNumber,
		scale: xyNumber("scale"),
		scaleX: singleNumber,
		scaleY: singleNumber,
		translate: xyLength("translate", 0),
		translateX: singleLength,
		translateY: singleLength,
		rotate: singleAngle,
		rotateX: singleAngle,
		rotateY: singleAngle,
		rotateZ: singleAngle,
		skewX: singleAngle,
		skewY: singleAngle,
		skew: xyAngle("skew", "0deg")
	};
	var transforms = {
		aspectRatio,
		background: function background(tokenStream) {
			return { backgroundColor: tokenStream.expect(COLOR) };
		},
		border,
		borderColor: directionFactory({
			types: [COLOR],
			prefix: "border",
			suffix: "Color"
		}),
		borderRadius: directionFactory({
			directions: [
				"TopLeft",
				"TopRight",
				"BottomRight",
				"BottomLeft"
			],
			prefix: "border",
			suffix: "Radius"
		}),
		borderWidth: directionFactory({
			prefix: "border",
			suffix: "Width"
		}),
		boxShadow,
		flex,
		flexFlow,
		font,
		fontFamily,
		fontVariant,
		fontWeight: function fontWeight(tokenStream) {
			return { fontWeight: tokenStream.expect(WORD) };
		},
		margin: directionFactory({
			types: [
				LENGTH,
				UNSUPPORTED_LENGTH_UNIT,
				PERCENT,
				AUTO
			],
			prefix: "margin"
		}),
		padding: directionFactory({ prefix: "padding" }),
		placeContent,
		shadowOffset: function shadowOffset(tokenStream) {
			return { shadowOffset: parseShadowOffset(tokenStream) };
		},
		textShadow,
		textShadowOffset: function textShadowOffset(tokenStream) {
			return { textShadowOffset: parseShadowOffset(tokenStream) };
		},
		textDecoration,
		textDecorationLine,
		transform: function transform(tokenStream) {
			var transforms = [];
			var didParseFirst = false;
			while (tokenStream.hasTokens()) {
				if (didParseFirst) tokenStream.expect(SPACE);
				var functionStream = tokenStream.expectFunction();
				var functionName = functionStream.functionName;
				var transformedValues = partTransforms[functionName](functionStream);
				if (!Array.isArray(transformedValues)) {
					var _ref5;
					transformedValues = [(_ref5 = {}, _ref5[functionName] = transformedValues, _ref5)];
				}
				transforms = transformedValues.concat(transforms);
				didParseFirst = true;
			}
			return { transform: transforms };
		}
	};
	var SYMBOL_MATCH = "SYMBOL_MATCH";
	var TokenStream = /*#__PURE__*/ function() {
		function TokenStream(nodes, parent) {
			this.index = 0;
			this.nodes = nodes;
			this.functionName = parent != null ? parent.value : null;
			this.lastValue = null;
			this.rewindIndex = -1;
		}
		var _proto = TokenStream.prototype;
		_proto.hasTokens = function hasTokens() {
			return this.index <= this.nodes.length - 1;
		};
		_proto[SYMBOL_MATCH] = function() {
			if (!this.hasTokens()) return null;
			var node = this.nodes[this.index];
			for (var i = 0; i < arguments.length; i += 1) {
				var value = (i < 0 || arguments.length <= i ? void 0 : arguments[i])(node);
				if (value !== null) {
					this.index += 1;
					this.lastValue = value;
					return value;
				}
			}
			return null;
		};
		_proto.matches = function matches() {
			return this[SYMBOL_MATCH].apply(this, arguments) !== null;
		};
		_proto.expect = function expect() {
			var value = this[SYMBOL_MATCH].apply(this, arguments);
			return value !== null ? value : this["throw"]();
		};
		_proto.matchesFunction = function matchesFunction() {
			var node = this.nodes[this.index];
			if (node.type !== "function") return null;
			var value = new TokenStream(node.nodes, node);
			this.index += 1;
			this.lastValue = null;
			return value;
		};
		_proto.expectFunction = function expectFunction() {
			var value = this.matchesFunction();
			return value !== null ? value : this["throw"]();
		};
		_proto.expectEmpty = function expectEmpty() {
			if (this.hasTokens()) this["throw"]();
		};
		_proto["throw"] = function _throw() {
			throw new Error("Unexpected token type: " + this.nodes[this.index].type);
		};
		_proto.saveRewindPoint = function saveRewindPoint() {
			this.rewindIndex = this.index;
		};
		_proto.rewind = function rewind() {
			if (this.rewindIndex === -1) throw new Error("Internal error");
			this.index = this.rewindIndex;
			this.lastValue = null;
		};
		return TokenStream;
	}();
	var numberOrLengthRe = /^([+-]?(?:\d*\.)?\d+(?:e[+-]?\d+)?)(?:px)?$/i;
	var boolRe = /^true|false$/i;
	var nullRe = /^null$/i;
	var undefinedRe = /^undefined$/i;
	var transformRawValue = function transformRawValue(propName, value) {
		var numberMatch = value.match(numberOrLengthRe);
		if (numberMatch !== null) return Number(numberMatch[1]);
		var boolMatch = value.match(boolRe);
		if (boolMatch !== null) return boolMatch[0].toLowerCase() === "true";
		if (value.match(nullRe) !== null) return null;
		if (value.match(undefinedRe) !== null) return void 0;
		return value;
	};
	var transformShorthandValue = function baseTransformShorthandValue(propName, value) {
		var tokenStream = new TokenStream(parse__default(value).nodes);
		return transforms[propName](tokenStream);
	};
	var getStylesForProperty = function getStylesForProperty(propName, inputValue, allowShorthand) {
		var _ref6;
		var isRawValue = allowShorthand === false || !(propName in transforms);
		var value = inputValue.trim();
		return isRawValue ? (_ref6 = {}, _ref6[propName] = transformRawValue(propName, value), _ref6) : transformShorthandValue(propName, value);
	};
	exports.getPropertyName = function getPropertyName(propName) {
		if (/^--\w+/.test(propName)) return propName;
		return camelizeStyleName(propName);
	};
	exports.getStylesForProperty = getStylesForProperty;
}));
//#endregion
export { require_css_to_react_native, require_lib };
