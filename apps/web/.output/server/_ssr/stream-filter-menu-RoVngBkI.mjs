import { __toESM } from "../_runtime.mjs";
import { require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { require_jsx_runtime } from "../_libs/@openuidev/react-headless+[...].mjs";
import { Check, ChevronDown } from "../_libs/lucide-react.mjs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItemIndicator, DropdownMenuPortal, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "../_libs/@openuidev/react-ui+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/stream-filter-menu-RoVngBkI.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function useStickyToolbarOffset(streamRef) {
	(0, import_react.useEffect)(() => {
		const stream = streamRef.current;
		if (!stream) return;
		const mobileNav = document.querySelector("[data-mobile-navigation]");
		const desktopNav = stream.closest(".site-section-motion")?.querySelector(":scope > nav");
		const media = window.matchMedia("(max-width: 900px)");
		const measure = () => {
			const nav = media.matches ? mobileNav : desktopNav;
			stream.style.setProperty("--stream-toolbar-top", `${nav?.getBoundingClientRect().height ?? 0}px`);
		};
		const observer = new ResizeObserver(measure);
		if (mobileNav) observer.observe(mobileNav);
		if (desktopNav) observer.observe(desktopNav);
		media.addEventListener("change", measure);
		measure();
		return () => {
			observer.disconnect();
			media.removeEventListener("change", measure);
			stream.style.removeProperty("--stream-toolbar-top");
		};
	}, [streamRef]);
}
/** 四个阅读栏目共用：工具栏跟随导航停靠，日期随当前可见分组更新。 */
function useStreamDate(streamRef, revision) {
	const [visibleDay, setVisibleDay] = (0, import_react.useState)(null);
	useStickyToolbarOffset(streamRef);
	(0, import_react.useEffect)(() => {
		const stream = streamRef.current;
		if (!stream) return;
		let frame = 0;
		const updateDay = () => {
			frame = 0;
			const toolbar = stream.querySelector(".stream-date-toolbar");
			if (!toolbar) return;
			const edge = toolbar.getBoundingClientRect().bottom + 1;
			const sections = stream.querySelectorAll("[data-stream-date]");
			let current = sections[0]?.dataset.streamDate ?? null;
			for (const section of sections) {
				if (section.getBoundingClientRect().top > edge) break;
				current = section.dataset.streamDate ?? null;
			}
			setVisibleDay(current);
		};
		const schedule = () => {
			if (!frame) frame = window.requestAnimationFrame(updateDay);
		};
		window.addEventListener("scroll", schedule, {
			passive: true,
			capture: true
		});
		window.addEventListener("resize", schedule);
		const observer = new ResizeObserver(schedule);
		observer.observe(stream);
		schedule();
		return () => {
			window.cancelAnimationFrame(frame);
			observer.disconnect();
			window.removeEventListener("scroll", schedule, true);
			window.removeEventListener("resize", schedule);
		};
	}, [revision, streamRef]);
	return visibleDay;
}
function StreamFilterMenu({ ariaLabel, triggerLabel, value, options, onSelect, menuClassName }) {
	const viaKeyboard = (0, import_react.useRef)(false);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenu, {
		modal: false,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuTrigger, {
			asChild: true,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				"aria-label": ariaLabel,
				className: "ai-news__category-select",
				type: "button",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: triggerLabel }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { "aria-hidden": "true" })]
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuPortal, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuContent, {
			align: "end",
			sideOffset: 4,
			collisionPadding: 16,
			className: `ai-news__category-menu${menuClassName ? ` ${menuClassName}` : ""}`,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuRadioGroup, {
				value,
				onValueChange: (next) => onSelect(next, viaKeyboard.current),
				children: options.map(({ value: optionValue, label }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DropdownMenuRadioItem, {
					"data-slot": "dropdown-menu-radio-item",
					onClick: (event) => {
						viaKeyboard.current = event.detail === 0;
					},
					value: optionValue,
					children: [label, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						"data-slot": "dropdown-menu-radio-item-indicator",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DropdownMenuItemIndicator, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { "aria-hidden": "true" }) })
					})]
				}, optionValue))
			})
		}) })]
	});
}
//#endregion
export { StreamFilterMenu, useStickyToolbarOffset, useStreamDate };
