import { __toESM } from "../_runtime.mjs";
import { require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { Await, useRouter } from "../_libs/@tanstack/react-router+[...].mjs";
import { require_jsx_runtime } from "../_libs/@openuidev/react-headless+[...].mjs";
import { ContentSectionNavigation, FeedSkeleton, Route$26, SectionMotionLifecycle, SiteProfile } from "./router-BKZi6fNy.mjs";
import { AiNewsStream } from "./ai-news-stream-Dx2VksnS.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-CJJ6QI6J.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var FeedRetryContext = (0, import_react.createContext)(null);
function FeedErrorFallback({ error, retry, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FeedErrorState, {
		...props,
		error,
		retry
	});
}
function FeedErrorState({ error, label, onRetrySettled, onRetryStart, retry, retryPhase }) {
	const buttonRef = (0, import_react.useRef)(null);
	const firstErrorEffectRef = (0, import_react.useRef)(true);
	const previousErrorRef = (0, import_react.useRef)(error);
	const retryFrameRef = (0, import_react.useRef)(null);
	const isRetrying = retryPhase === "retrying";
	(0, import_react.useEffect)(() => () => {
		if (retryFrameRef.current !== null) window.cancelAnimationFrame(retryFrameRef.current);
	}, []);
	(0, import_react.useEffect)(() => {
		const retryFailed = isRetrying && (firstErrorEffectRef.current || previousErrorRef.current !== error);
		firstErrorEffectRef.current = false;
		previousErrorRef.current = error;
		if (!retryFailed) return;
		onRetrySettled();
		retryFrameRef.current = window.requestAnimationFrame(() => {
			retryFrameRef.current = null;
			buttonRef.current?.focus({ preventScroll: true });
		});
	}, [
		error,
		isRetrying,
		onRetrySettled
	]);
	const handleRetry = () => {
		if (isRetrying) return;
		onRetryStart();
		retryFrameRef.current = window.requestAnimationFrame(() => {
			retryFrameRef.current = null;
			retry();
		});
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		"aria-busy": isRetrying,
		className: "curation-home__stream-error",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				"aria-atomic": "true",
				className: "curation-home__stream-error-title",
				role: "alert",
				children: [label, "暂时无法读取。"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "数据服务没有响应，可以重新读取当前内容。" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				"aria-live": "polite",
				className: "sr-only",
				role: "status",
				children: isRetrying ? `正在重新读取${label}` : ""
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				disabled: isRetrying,
				ref: buttonRef,
				type: "button",
				onClick: handleRetry,
				children: isRetrying ? "正在重新读取…" : "重新读取"
			})
		]
	});
}
var CaughtFeedErrorBoundary = class extends import_react.Component {
	state = { error: null };
	static getDerivedStateFromError(error) {
		return { error };
	}
	componentDidCatch(error, info) {
		console.error("[feed-error]", error, info.componentStack);
	}
	render() {
		const { error } = this.state;
		const { children, onRetry, ...fallbackProps } = this.props;
		if (error) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FeedErrorFallback, {
			...fallbackProps,
			error,
			retry: () => {
				onRetry?.();
				this.setState({ error: null });
			}
		});
		return children;
	}
};
function FeedErrorBoundary({ children, label, onRetry }) {
	const [retryPhase, setRetryPhase] = (0, import_react.useState)("idle");
	const onRetryStart = (0, import_react.useCallback)(() => setRetryPhase("retrying"), []);
	const onRetrySettled = (0, import_react.useCallback)(() => setRetryPhase("idle"), []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FeedRetryContext.Provider, {
		value: {
			onRetrySettled,
			retryPhase
		},
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CaughtFeedErrorBoundary, {
			label,
			onRetry,
			onRetrySettled,
			onRetryStart,
			retryPhase,
			children
		})
	});
}
function FeedRecoveryFocus({ children, onRetrySettled, retryPhase }) {
	const contentRef = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		if (retryPhase !== "retrying") return;
		const content = contentRef.current;
		(content?.querySelector("[data-content-id], a[href]") ?? content?.closest("[data-feed-recovery-root]"))?.focus({ preventScroll: true });
		onRetrySettled();
	}, [onRetrySettled, retryPhase]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "curation-home__feed-content",
		ref: contentRef,
		children
	});
}
function FeedRecoveryTarget({ children }) {
	const retryContext = (0, import_react.useContext)(FeedRetryContext);
	if (!retryContext) return children;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FeedRecoveryFocus, {
		...retryContext,
		children
	});
}
function HomePage() {
	const router = useRouter();
	const { feed } = Route$26.useLoaderData();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "curation-home curation-home--mobile-home",
		id: "site-main",
		tabIndex: -1,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SiteProfile, {
				animateOnFirstHomeVisit: true,
				mobileSection: "home"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SectionMotionLifecycle, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				"aria-label": "每日动态",
				className: "curation-home__feed site-section-motion",
				"data-feed-recovery-root": true,
				tabIndex: -1,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ContentSectionNavigation, { current: "ai-news" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FeedErrorBoundary, {
					label: "每日动态",
					onRetry: () => void router.invalidate(),
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react.Suspense, {
						fallback: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FeedSkeleton, { label: "每日动态" }),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FeedRecoveryTarget, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Await, {
							promise: feed,
							children: (aiNewsPage) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AiNewsStream, {
								initialHasMore: aiNewsPage.hasMore,
								initialItems: aiNewsPage.items
							})
						}) })
					})
				})]
			})
		]
	});
}
//#endregion
export { HomePage as component };
