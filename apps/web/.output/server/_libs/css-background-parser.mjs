import { __commonJSMin } from "../_runtime.mjs";
//#region ../../node_modules/.bun/css-background-parser@0.1.0/node_modules/css-background-parser/index.js
var require_css_background_parser = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	/*!
	* https://github.com/gilmoreorless/css-background-parser
	* Copyright © 2015 Gilmore Davidson under the MIT license: http://gilmoreorless.mit-license.org/
	*/
	(function(exports$1) {
		function BackgroundList(backgrounds) {
			if (!(this instanceof BackgroundList)) return new BackgroundList();
			this.backgrounds = backgrounds || [];
		}
		BackgroundList.prototype.toString = function() {
			return this.backgrounds.join(", ");
		};
		function Background(props) {
			if (!(this instanceof Background)) return new Background(props);
			props = props || {};
			var bg = this;
			function defprop(name, defaultValue) {
				bg[name] = name in props ? props[name] : defaultValue;
			}
			defprop("color", "");
			defprop("image", "none");
			defprop("attachment", "scroll");
			defprop("clip", "border-box");
			defprop("origin", "padding-box");
			defprop("position", "0% 0%");
			defprop("repeat", "repeat");
			defprop("size", "auto");
		}
		Background.prototype.toString = function() {
			var list = [
				this.image,
				this.repeat,
				this.attachment,
				this.position + " / " + this.size,
				this.origin,
				this.clip
			];
			if (this.color) list.unshift(this.color);
			return list.join(" ");
		};
		exports$1.BackgroundList = BackgroundList;
		exports$1.Background = Background;
		function parseImages(cssText) {
			var images = [];
			var tokens = /[,\(\)]/;
			var parens = 0;
			var buffer = "";
			if (cssText == null) return images;
			while (cssText.length) {
				var match = tokens.exec(cssText);
				if (!match) break;
				var char = match[0];
				var ignoreChar = false;
				switch (char) {
					case ",":
						if (!parens) {
							images.push(buffer.trim());
							buffer = "";
							ignoreChar = true;
						}
						break;
					case "(":
						parens++;
						break;
					case ")": parens--;
				}
				var index = match.index + 1;
				buffer += cssText.slice(0, ignoreChar ? index - 1 : index);
				cssText = cssText.slice(index);
			}
			if (buffer.length || cssText.length) images.push((buffer + cssText).trim());
			return images;
		}
		function trim(str) {
			return str.trim();
		}
		function parseSimpleList(cssText) {
			return (cssText || "").split(",").map(trim);
		}
		exports$1.parseElementStyle = function(styleObject) {
			var list = new BackgroundList();
			if (styleObject == null) return list;
			var bgImage = parseImages(styleObject.backgroundImage);
			var bgColor = styleObject.backgroundColor;
			var bgAttachment = parseSimpleList(styleObject.backgroundAttachment);
			var bgClip = parseSimpleList(styleObject.backgroundClip);
			var bgOrigin = parseSimpleList(styleObject.backgroundOrigin);
			var bgPosition = parseSimpleList(styleObject.backgroundPosition);
			var bgRepeat = parseSimpleList(styleObject.backgroundRepeat);
			var bgSize = parseSimpleList(styleObject.backgroundSize);
			var background;
			for (var i = 0, ii = bgImage.length; i < ii; i++) {
				background = new Background({
					image: bgImage[i],
					attachment: bgAttachment[i % bgAttachment.length],
					clip: bgClip[i % bgClip.length],
					origin: bgOrigin[i % bgOrigin.length],
					position: bgPosition[i % bgPosition.length],
					repeat: bgRepeat[i % bgRepeat.length],
					size: bgSize[i % bgSize.length]
				});
				if (i === ii - 1) background.color = bgColor;
				list.backgrounds.push(background);
			}
			return list;
		};
	})((function(root) {
		if (typeof module !== "undefined" && module.exports !== void 0) return module.exports;
		return root.cssBgParser = {};
	})(exports));
}));
//#endregion
export { require_css_background_parser };
