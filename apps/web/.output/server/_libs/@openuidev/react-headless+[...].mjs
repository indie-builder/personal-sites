import { __commonJSMin, __toESM } from "../../_runtime.mjs";
import { require_react } from "../@floating-ui/react-dom+[...].mjs";
import { observability } from "../openuidev__observability.mjs";
import { EventType } from "../ag-ui__core+zod.mjs";
//#region ../../node_modules/.bun/react@19.3.0/node_modules/react/cjs/react-jsx-runtime.production.js
/**
* @license React
* react-jsx-runtime.production.js
*
* Copyright (c) Meta Platforms, Inc. and affiliates.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/
var require_react_jsx_runtime_production = /* @__PURE__ */ __commonJSMin(((exports) => {
	var REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element");
	var REACT_FRAGMENT_TYPE = Symbol.for("react.fragment");
	function jsxProd(type, config, maybeKey) {
		var key = null;
		void 0 !== maybeKey && (key = "" + maybeKey);
		void 0 !== config.key && (key = "" + config.key);
		if ("key" in config) {
			maybeKey = {};
			for (var propName in config) "key" !== propName && (maybeKey[propName] = config[propName]);
		} else maybeKey = config;
		config = maybeKey.ref;
		return {
			$$typeof: REACT_ELEMENT_TYPE,
			type,
			key,
			ref: void 0 !== config ? config : null,
			props: maybeKey
		};
	}
	exports.Fragment = REACT_FRAGMENT_TYPE;
	exports.jsx = jsxProd;
	exports.jsxs = jsxProd;
}));
//#endregion
//#region ../../node_modules/.bun/react@19.3.0/node_modules/react/jsx-runtime.js
var require_jsx_runtime = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = require_react_jsx_runtime_production();
}));
//#endregion
//#region ../../node_modules/.bun/use-sync-external-store@1.7.0+62547eec5a2188e3/node_modules/use-sync-external-store/cjs/use-sync-external-store-shim.production.js
/**
* @license React
* use-sync-external-store-shim.production.js
*
* Copyright (c) Meta Platforms, Inc. and affiliates.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/
var require_use_sync_external_store_shim_production = /* @__PURE__ */ __commonJSMin(((exports) => {
	var React = require_react();
	function is(x, y) {
		return x === y && (0 !== x || 1 / x === 1 / y) || x !== x && y !== y;
	}
	var objectIs = "function" === typeof Object.is ? Object.is : is;
	var useState = React.useState;
	var useEffect = React.useEffect;
	var useLayoutEffect = React.useLayoutEffect;
	var useDebugValue = React.useDebugValue;
	function useSyncExternalStore$2(subscribe, getSnapshot) {
		var value = getSnapshot(), _useState = useState({ inst: {
			value,
			getSnapshot
		} }), inst = _useState[0].inst, forceUpdate = _useState[1];
		useLayoutEffect(function() {
			inst.value = value;
			inst.getSnapshot = getSnapshot;
			checkIfSnapshotChanged(inst) && forceUpdate({ inst });
		}, [
			subscribe,
			value,
			getSnapshot
		]);
		useEffect(function() {
			checkIfSnapshotChanged(inst) && forceUpdate({ inst });
			return subscribe(function() {
				checkIfSnapshotChanged(inst) && forceUpdate({ inst });
			});
		}, [subscribe]);
		useDebugValue(value);
		return value;
	}
	function checkIfSnapshotChanged(inst) {
		var latestGetSnapshot = inst.getSnapshot;
		inst = inst.value;
		try {
			var nextValue = latestGetSnapshot();
			return !objectIs(inst, nextValue);
		} catch (error) {
			return !0;
		}
	}
	function useSyncExternalStore$1(subscribe, getSnapshot) {
		return getSnapshot();
	}
	var shim = "undefined" === typeof window || "undefined" === typeof window.document || "undefined" === typeof window.document.createElement ? useSyncExternalStore$1 : useSyncExternalStore$2;
	exports.useSyncExternalStore = void 0 !== React.useSyncExternalStore ? React.useSyncExternalStore : shim;
}));
//#endregion
//#region ../../node_modules/.bun/use-sync-external-store@1.7.0+62547eec5a2188e3/node_modules/use-sync-external-store/shim/index.js
var require_shim = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = require_use_sync_external_store_shim_production();
}));
//#endregion
//#region ../../node_modules/.bun/use-sync-external-store@1.7.0+62547eec5a2188e3/node_modules/use-sync-external-store/cjs/use-sync-external-store-shim/with-selector.production.js
/**
* @license React
* use-sync-external-store-shim/with-selector.production.js
*
* Copyright (c) Meta Platforms, Inc. and affiliates.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/
var require_with_selector_production = /* @__PURE__ */ __commonJSMin(((exports) => {
	var React = require_react();
	var shim = require_shim();
	function is(x, y) {
		return x === y && (0 !== x || 1 / x === 1 / y) || x !== x && y !== y;
	}
	var objectIs = "function" === typeof Object.is ? Object.is : is;
	var useSyncExternalStore = shim.useSyncExternalStore;
	var useRef = React.useRef;
	var useEffect = React.useEffect;
	var useMemo = React.useMemo;
	var useDebugValue = React.useDebugValue;
	exports.useSyncExternalStoreWithSelector = function(subscribe, getSnapshot, getServerSnapshot, selector, isEqual) {
		var instRef = useRef(null);
		if (null === instRef.current) {
			var inst = {
				hasValue: !1,
				value: null
			};
			instRef.current = inst;
		} else inst = instRef.current;
		instRef = useMemo(function() {
			function memoizedSelector(nextSnapshot) {
				if (!hasMemo) {
					hasMemo = !0;
					memoizedSnapshot = nextSnapshot;
					nextSnapshot = selector(nextSnapshot);
					if (void 0 !== isEqual && inst.hasValue) {
						var currentSelection = inst.value;
						if (isEqual(currentSelection, nextSnapshot)) return memoizedSelection = currentSelection;
					}
					return memoizedSelection = nextSnapshot;
				}
				currentSelection = memoizedSelection;
				if (objectIs(memoizedSnapshot, nextSnapshot)) return currentSelection;
				var nextSelection = selector(nextSnapshot);
				if (void 0 !== isEqual && isEqual(currentSelection, nextSelection)) return memoizedSnapshot = nextSnapshot, currentSelection;
				memoizedSnapshot = nextSnapshot;
				return memoizedSelection = nextSelection;
			}
			var hasMemo = !1, memoizedSnapshot, memoizedSelection, maybeGetServerSnapshot = void 0 === getServerSnapshot ? null : getServerSnapshot;
			return [function() {
				return memoizedSelector(getSnapshot());
			}, null === maybeGetServerSnapshot ? void 0 : function() {
				return memoizedSelector(maybeGetServerSnapshot());
			}];
		}, [
			getSnapshot,
			getServerSnapshot,
			selector,
			isEqual
		]);
		var value = useSyncExternalStore(subscribe, instRef[0], instRef[1]);
		useEffect(function() {
			inst.hasValue = !0;
			inst.value = value;
		}, [value]);
		useDebugValue(value);
		return value;
	};
}));
//#endregion
//#region ../../node_modules/.bun/use-sync-external-store@1.7.0+62547eec5a2188e3/node_modules/use-sync-external-store/shim/with-selector.js
var require_with_selector = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = require_with_selector_production();
}));
//#endregion
//#region ../../node_modules/.bun/zustand@4.5.7+0ac650c021fb1b59/node_modules/zustand/esm/vanilla.mjs
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var createStoreImpl = (createState) => {
	let state;
	const listeners = /* @__PURE__ */ new Set();
	const setState = (partial, replace) => {
		const nextState = typeof partial === "function" ? partial(state) : partial;
		if (!Object.is(nextState, state)) {
			const previousState = state;
			state = (replace != null ? replace : typeof nextState !== "object" || nextState === null) ? nextState : Object.assign({}, state, nextState);
			listeners.forEach((listener) => listener(state, previousState));
		}
	};
	const getState = () => state;
	const getInitialState = () => initialState;
	const subscribe = (listener) => {
		listeners.add(listener);
		return () => listeners.delete(listener);
	};
	const destroy = () => {
		listeners.clear();
	};
	const api = {
		setState,
		getState,
		getInitialState,
		subscribe,
		destroy
	};
	const initialState = state = createState(setState, getState, api);
	return api;
};
var createStore = (createState) => createState ? createStoreImpl(createState) : createStoreImpl;
//#endregion
//#region ../../node_modules/.bun/zustand@4.5.7+0ac650c021fb1b59/node_modules/zustand/esm/index.mjs
var import_with_selector = /* @__PURE__ */ __toESM(require_with_selector(), 1);
var { useDebugValue } = import_react.default;
var { useSyncExternalStoreWithSelector } = import_with_selector.default;
var identity = (arg) => arg;
function useStore(api, selector = identity, equalityFn) {
	const slice = useSyncExternalStoreWithSelector(api.subscribe, api.getState, api.getServerState || api.getInitialState, selector, equalityFn);
	useDebugValue(slice);
	return slice;
}
var createImpl = (createState) => {
	const api = typeof createState === "function" ? createStore(createState) : createState;
	const useBoundStore = (selector, equalityFn) => useStore(api, selector, equalityFn);
	Object.assign(useBoundStore, api);
	return useBoundStore;
};
var create = (createState) => createState ? createImpl(createState) : createImpl;
//#endregion
//#region ../../node_modules/.bun/zustand@4.5.7+0ac650c021fb1b59/node_modules/zustand/esm/react/shallow.mjs
function shallow(objA, objB) {
	if (Object.is(objA, objB)) return true;
	if (typeof objA !== "object" || objA === null || typeof objB !== "object" || objB === null) return false;
	if (objA instanceof Map && objB instanceof Map) {
		if (objA.size !== objB.size) return false;
		for (const [key, value] of objA) if (!Object.is(value, objB.get(key))) return false;
		return true;
	}
	if (objA instanceof Set && objB instanceof Set) {
		if (objA.size !== objB.size) return false;
		for (const value of objA) if (!objB.has(value)) return false;
		return true;
	}
	const keysA = Object.keys(objA);
	if (keysA.length !== Object.keys(objB).length) return false;
	for (const keyA of keysA) if (!Object.prototype.hasOwnProperty.call(objB, keyA) || !Object.is(objA[keyA], objB[keyA])) return false;
	return true;
}
var { useRef: useRef$1 } = import_react.default;
function useShallow(selector) {
	const prev = useRef$1();
	return (state) => {
		const next = selector(state);
		return shallow(prev.current, next) ? prev.current : prev.current = next;
	};
}
//#endregion
//#region ../../node_modules/.bun/zustand@4.5.7+0ac650c021fb1b59/node_modules/zustand/esm/middleware.mjs
var import_jsx_runtime = require_jsx_runtime();
var subscribeWithSelectorImpl = (fn) => (set, get, api) => {
	const origSubscribe = api.subscribe;
	api.subscribe = (selector, optListener, options) => {
		let listener = selector;
		if (optListener) {
			const equalityFn = (options == null ? void 0 : options.equalityFn) || Object.is;
			let currentSlice = selector(api.getState());
			listener = (state) => {
				const nextSlice = selector(state);
				if (!equalityFn(currentSlice, nextSlice)) {
					const previousSlice = currentSlice;
					optListener(currentSlice = nextSlice, previousSlice);
				}
			};
			if (options == null ? void 0 : options.fireImmediately) optListener(currentSlice, currentSlice);
		}
		return origSubscribe(listener);
	};
	return fn(set, get, api);
};
var subscribeWithSelector = subscribeWithSelectorImpl;
//#endregion
//#region ../../node_modules/.bun/@openuidev+react-headless@0.17.1+663a30d24d84d2f4/node_modules/@openuidev/react-headless/dist/index.mjs
/** @internal React context holding the detailed-view Zustand store. Provided by `ChatProvider`. */
var DetailedViewContext = (0, import_react.createContext)(null);
/**
* Returns the raw detailed-view Zustand store for advanced use cases.
*
* Prefer {@link useDetailedView} or {@link useActiveDetailedView} for most cases —
* this hook is an escape hatch when you need direct store access.
*
* @category Hooks
* @returns The Zustand `StoreApi<DetailedViewStore>` instance
* @throws Error if called outside a `<ChatProvider>`
*/
var useDetailedViewStore = () => {
	const store = (0, import_react.useContext)(DetailedViewContext);
	if (!store) throw new Error("useDetailedViewStore must be used within a <ChatProvider>");
	return store;
};
/**
* Returns global detailed-view activation state — whether *any* view is open,
* and a close action that dismisses it.
*
* Use this in layout components that react to detailed-view presence (resizing
* panels, showing overlays) without needing to know *which* view is active.
* For per-view state and actions, use {@link useDetailedView} instead.
*
* Must be called within a `<ChatProvider>`.
*
* @category Hooks
* @returns {@link UseActiveDetailedViewReturn}
*/
function useActiveDetailedView() {
	const store = useDetailedViewStore();
	const activeDetailedViewId = useStore(store, (s) => s.activeDetailedViewId);
	return {
		isDetailedViewActive: activeDetailedViewId !== null,
		activeDetailedViewId,
		closeDetailedView: (0, import_react.useCallback)(() => {
			if (store.getState().activeDetailedViewId !== null) store.getState().setActiveDetailedView(null);
		}, [store])
	};
}
/** @internal React context holding the ThreadContext Zustand store. Provided by `ChatProvider`. */
var ThreadContextContext = (0, import_react.createContext)(null);
/**
* Returns the raw ThreadContext Zustand store for advanced use cases.
*
* Prefer {@link useDetailedView}, {@link useActiveDetailedView}, {@link useAppList},
* or {@link useArtifactList} for most cases — this hook is an escape hatch when you
* need direct store access.
*
* @category Hooks
* @returns The Zustand `StoreApi<ThreadContextStore>` instance
* @throws Error if called outside a `<ChatProvider>`
*/
var useThreadContextStore = () => {
	const store = (0, import_react.useContext)(ThreadContextContext);
	if (!store) throw new Error("useThreadContextStore must be used within a <ChatProvider>");
	return store;
};
/**
* Returns artifacts registered in the active thread, grouped by `id` and
* sorted ascending by `version`. The latest version of each artifact is the
* last element.
*
* Pass a filter to restrict by artifact `type` — e.g. the types from an
* `ArtifactCategory` to build category-grouped workspace sections.
*
* Must be called within a `<ChatProvider>`.
*
* @category Hooks
* @returns Map of artifact id → ordered version list
*
* @example
* ```tsx
* function WorkspaceSection({ category }: { category: ArtifactCategory }) {
*   const artifacts = useArtifactList({ type: category.filter.type });
*   const latest = Object.values(artifacts).map((v) => v[v.length - 1]);
*   return (
*     <ul>
*       {latest.map((a) => (
*         <li key={a.id}>{a.heading}</li>
*       ))}
*     </ul>
*   );
* }
* ```
*/
function useArtifactList(filter) {
	const artifacts = useStore(useThreadContextStore(), (s) => s.artifacts);
	const typeKey = filter?.type?.join(" ");
	return (0, import_react.useMemo)(() => {
		if (typeKey === void 0) return artifacts;
		const allowed = new Set(typeKey.split(" "));
		const result = {};
		for (const [id, versions] of Object.entries(artifacts)) {
			const latest = versions[versions.length - 1];
			if (latest && allowed.has(latest.type)) result[id] = versions;
		}
		return result;
	}, [artifacts, typeKey]);
}
var isDev$1 = () => typeof process !== "undefined" && false;
/**
* Builds an {@link ArtifactRendererRegistry} from a list of configs.
*
* First-wins on duplicate `toolName` or `type`: subsequent registrations are
* ignored with a dev-mode warning so the user can reorder their array
* (custom renderers should come *before* SDK defaults).
*
* @internal
*/
function buildArtifactRendererRegistry(configs) {
	const byToolName = /* @__PURE__ */ new Map();
	const byType = /* @__PURE__ */ new Map();
	for (const config of configs) {
		const toolNames = Array.isArray(config.toolName) ? config.toolName : [config.toolName];
		for (const name of toolNames) {
			if (byToolName.has(name)) {
				if (isDev$1()) console.warn(`[OpenUI] Artifact renderer for toolName "${name}" was ignored (already registered earlier in the array).`);
				continue;
			}
			byToolName.set(name, config);
		}
		if (byType.has(config.type)) {
			if (isDev$1()) console.warn(`[OpenUI] Artifact renderer for type "${config.type}" was ignored for type-based lookup (already registered earlier in the array).`);
			continue;
		}
		byType.set(config.type, config);
	}
	return {
		byToolName,
		byType
	};
}
/** Resolves the renderer matching a tool name, or `null`. @internal */
function lookupArtifactRenderer(registry, toolName) {
	return registry.byToolName.get(toolName) ?? null;
}
/** Resolves the renderer matching an artifact type, or `null`. @internal */
function lookupArtifactRendererByType(registry, type) {
	return registry.byType.get(type) ?? null;
}
/** @internal React context holding the renderer registry. Provided by `ChatProvider`. */
var ArtifactRenderersContext = (0, import_react.createContext)(null);
/**
* Returns the raw artifact-renderer registry for advanced use cases.
*
* Prefer {@link useArtifactRenderer} for resolving a specific tool name —
* this hook is an escape hatch for custom dispatching.
*
* Returns `null` if no `artifactRenderers` were provided to the `<ChatProvider>` —
* this is not an error since renderers are optional.
*
* @category Hooks
*/
var useArtifactRendererRegistry = () => {
	return (0, import_react.useContext)(ArtifactRenderersContext);
};
/**
* Resolves the artifact-renderer config matching a given `toolName`, or `null`
* if none match.
*
* Thin React wrapper over {@link lookupArtifactRenderer}: reads the registry
* from `<ChatProvider>` context and runs the lookup.
*
* Returns `null` if no `artifactRenderers` were supplied to the provider —
* callers should fall back to default rendering in that case.
*
* @category Hooks
*/
function useArtifactRenderer(toolName) {
	const registry = useArtifactRendererRegistry();
	if (!registry) return null;
	return lookupArtifactRenderer(registry, toolName);
}
/**
* Binds a component to a specific detailed view by id, providing activation
* state and actions (open, close, toggle).
*
* Only one detailed view is active at a time across all kinds (apps, artifacts,
* and custom consumers). The `viewId` format is renderer-defined. The built-in
* App and Artifact renderers use `"${id}:${version}"`; custom consumers may
* pick any unique string.
*
* Must be called within a `<ChatProvider>`.
*
* @category Hooks
* @param viewId - Unique identifier for the detailed view
* @returns {@link UseDetailedViewReturn}
*
* @example
* ```tsx
* function PreviewButton({ viewId }: { viewId: string }) {
*   const { isActive, toggle } = useDetailedView(viewId);
*   return (
*     <button onClick={toggle}>
*       {isActive ? "Hide" : "Show"} Preview
*     </button>
*   );
* }
* ```
*/
function useDetailedView(viewId) {
	const store = useDetailedViewStore();
	return {
		isActive: useStore(store, (s) => s.activeDetailedViewId === viewId),
		open: (0, import_react.useCallback)(() => {
			store.getState().setActiveDetailedView(viewId);
		}, [store, viewId]),
		close: (0, import_react.useCallback)(() => {
			if (store.getState().activeDetailedViewId === viewId) store.getState().setActiveDetailedView(null);
		}, [store, viewId]),
		toggle: (0, import_react.useCallback)(() => {
			const state = store.getState();
			if (state.activeDetailedViewId === viewId) state.setActiveDetailedView(null);
			else state.setActiveDetailedView(viewId);
		}, [store, viewId])
	};
}
/**
* Provides access to the detailed-view portal target DOM node.
*
* This hook serves two roles:
* - **Registering a portal target:** Call `setNode` from a ref callback to
*   designate a DOM element as the render target for detailed-view content.
*   Only one target should be registered at a time.
* - **Reading the portal target:** Read `node` to get the current target
*   element for use with `createPortal()`.
*
* Must be called within a `<ChatProvider>`.
*
* @category Hooks
* @returns `{ setNode, node }` — setter for registration, getter for portal rendering
*
* @example
* ```tsx
* // Registering a portal target
* function MyPortalTarget() {
*   const { setNode } = useDetailedViewPortalTarget();
*   return <div ref={setNode} />;
* }
*
* // Building a custom detailed-view panel
* function MyDetailedViewPanel({ viewId, children }) {
*   const { isActive } = useDetailedView(viewId);
*   const { node } = useDetailedViewPortalTarget();
*   if (!isActive || !node) return null;
*   return createPortal(<div>{children}</div>, node);
* }
* ```
*/
function useDetailedViewPortalTarget() {
	const store = useDetailedViewStore();
	const node = useStore(store, (s) => s._detailedViewPanelNode);
	return {
		setNode: (0, import_react.useCallback)((node) => {
			store.getState()._setDetailedViewPanelNode(node);
		}, [store]),
		node
	};
}
/**
* @category Contexts
*/
var MessageContext = (0, import_react.createContext)(null);
/**
* @category Components
*/
var MessageProvider = ({ message, children }) => {
	const ctxValue = useShallow((_s) => ({ message }))();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageContext.Provider, {
		value: ctxValue,
		children
	});
};
var ChatContext = (0, import_react.createContext)(null);
var useChatStore = () => {
	const store = (0, import_react.useContext)(ChatContext);
	if (!store) throw new Error("useChatStore must be used within a <ChatProvider>");
	return store;
};
var threadSelector = (s) => ({
	messages: s.messages,
	isRunning: s.isRunning,
	isLoadingMessages: s.isLoadingMessages,
	threadError: s.threadError,
	executingToolCallIds: s.executingToolCallIds,
	processMessage: s.processMessage,
	appendMessages: s.appendMessages,
	updateMessage: s.updateMessage,
	setMessages: s.setMessages,
	deleteMessage: s.deleteMessage,
	cancelMessage: s.cancelMessage
});
var threadListSelector = (s) => ({
	threads: s.threads,
	isLoadingThreads: s.isLoadingThreads,
	threadListError: s.threadListError,
	selectedThreadId: s.selectedThreadId,
	hasMoreThreads: s.hasMoreThreads,
	loadThreads: s.loadThreads,
	loadMoreThreads: s.loadMoreThreads,
	switchToNewThread: s.switchToNewThread,
	createThread: s.createThread,
	selectThread: s.selectThread,
	updateThread: s.updateThread,
	deleteThread: s.deleteThread
});
function useThread(selector) {
	const store = useChatStore();
	if (selector) return useStore(store, (s) => selector(threadSelector(s)));
	return useStore(store, useShallow(threadSelector));
}
function useThreadList(selector) {
	const store = useChatStore();
	if (selector) return useStore(store, (s) => selector(threadListSelector(s)));
	return useStore(store, useShallow(threadListSelector));
}
var isDev = () => typeof process !== "undefined" && false;
/**
* Closes dangling brackets/quotes for a partial (mid-stream) JSON string so it
* can be parsed for a best-effort snapshot. Conservative: only trims a trailing
* object key that is provably awaiting a value (signalled by a trailing colon),
* leaving complete array/values intact.
*/
function balanceOpenJSON(raw) {
	const closers = [];
	let inString = false;
	let escaped = false;
	for (let i = 0; i < raw.length; i++) {
		const ch = raw[i];
		if (inString) {
			if (escaped) escaped = false;
			else if (ch === "\\") escaped = true;
			else if (ch === "\"") inString = false;
			continue;
		}
		if (ch === "\"") inString = true;
		else if (ch === "{") closers.push("}");
		else if (ch === "[") closers.push("]");
		else if (ch === "}" || ch === "]") closers.pop();
	}
	let out = raw;
	if (inString) {
		if (escaped) out = out.slice(0, -1);
		out += "\"";
	}
	out = out.replace(/(?:,\s*)?"(?:[^"\\]|\\.)*"\s*:\s*$/, "");
	out = out.replace(/,\s*$/, "");
	for (let i = closers.length - 1; i >= 0; i--) out += closers[i];
	return out;
}
/**
* Tolerant single-pass JSON parse for streamed tool arguments. Tries a straight
* parse, then a bracket-balanced parse for partial input. **Never throws** —
* returns `{}` when nothing parseable can be recovered.
*
* @category Utilities
*/
function partialJSONParse(raw) {
	if (!raw) return {};
	try {
		return JSON.parse(raw);
	} catch {}
	try {
		return JSON.parse(balanceOpenJSON(raw));
	} catch {
		return {};
	}
}
var warnedTitle = false;
/**
* Maps the deprecated `_title` tool-arg key onto a typed `statusMessage` for one
* minor release (with a one-time dev warning). Prefer a renderer-owned typed
* field going forward.
*/
function readStatusMessage(input) {
	if (input && typeof input === "object" && "_title" in input) {
		const value = input["_title"];
		if (typeof value === "string") {
			if (isDev() && !warnedTitle) {
				warnedTitle = true;
				console.warn("[OpenUI] The `_title` tool-arg key is deprecated and will be removed; the renderer now exposes a typed `statusMessage` on ToolActivity instead.");
			}
			return value;
		}
	}
}
/**
* Pairs every tool call on an assistant message with its result message **by
* `toolCallId`** (id-keyed, no positional `break`), producing a typed
* {@link ToolActivity} per call. Turn-safe even when tool messages trail or
* interleave with other messages.
*
* @param message       The assistant message owning the tool calls.
* @param allMessages   The full thread message list (scanned for tool results).
* @param executingIds  Tool-call ids whose args have closed but whose result
*                      hasn't landed (the store's `executingToolCallIds`).
*
* @category Utilities
*/
function pairToolActivity(message, allMessages, executingIds = /* @__PURE__ */ new Set()) {
	const byCallId = /* @__PURE__ */ new Map();
	const ownedCallIds = /* @__PURE__ */ new Set();
	for (const m of allMessages) if (m.role === "tool") {
		const tm = m;
		if (tm.toolCallId) byCallId.set(tm.toolCallId, tm);
	} else if (m.role === "assistant") for (const tc of m.toolCalls ?? []) ownedCallIds.add(tc.id);
	const activities = (message.toolCalls ?? []).map((toolCall) => {
		const toolMessage = byCallId.get(toolCall.id) ?? null;
		const input = partialJSONParse(toolCall.function.arguments);
		const statusMessage = readStatusMessage(input);
		const base = {
			id: toolCall.id,
			toolName: toolCall.function.name,
			toolCall,
			statusMessage
		};
		if (toolMessage) return toolMessage.error ? {
			...base,
			status: "error",
			toolMessage,
			input,
			result: toolMessage.content,
			isError: true,
			errorText: toolMessage.error
		} : {
			...base,
			status: "complete",
			toolMessage,
			input,
			result: toolMessage.content,
			isError: false
		};
		return executingIds.has(toolCall.id) ? {
			...base,
			status: "executing",
			toolMessage: null,
			input,
			isError: false
		} : {
			...base,
			status: "streaming",
			toolMessage: null,
			input,
			isError: false
		};
	});
	const msgIndex = allMessages.findIndex((m) => m.id === message.id);
	if (msgIndex !== -1) for (let i = msgIndex + 1; i < allMessages.length; i++) {
		const m = allMessages[i];
		if (!m || m.role !== "tool") break;
		const tm = m;
		if (!tm.toolCallId || ownedCallIds.has(tm.toolCallId)) continue;
		const orphanCall = {
			id: tm.toolCallId,
			type: "function",
			function: {
				name: "",
				arguments: ""
			}
		};
		const base = {
			id: tm.id,
			toolName: "",
			toolCall: orphanCall
		};
		activities.push(tm.error ? {
			...base,
			status: "error",
			toolMessage: tm,
			input: {},
			result: tm.content,
			isError: true,
			errorText: tm.error
		} : {
			...base,
			status: "complete",
			toolMessage: tm,
			input: {},
			result: tm.content,
			isError: false
		});
	}
	return activities;
}
/**
* Memoized view of an assistant message's tool calls paired with their results,
* as a typed {@link ToolActivity} array.
*
* Wraps {@link pairToolActivity}, re-pairing only when something that affects
* the result actually changes: an argument string grows, a tool result lands or
* changes length/error, or the store's executing set changes. Keying on both
* args length **and** result length matters — a result can arrive after args
* are already closed, and vice versa.
*
* @category Hooks
*/
function useToolActivities(message, allMessages) {
	const executingIds = useThread((s) => s.executingToolCallIds);
	const argsKey = (message.toolCalls ?? []).map((t) => `${t.id}:${t.function.arguments.length}`).join("|");
	const resultKey = allMessages.filter((m) => m.role === "tool").map((m) => `${m.toolCallId}:${m.content?.length ?? 0}:${m.error ? 1 : 0}`).join("|");
	return (0, import_react.useMemo)(() => pairToolActivity(message, allMessages, executingIds), [
		message.id,
		argsKey,
		resultKey,
		executingIds
	]);
}
/** @internal Provided by `ChatProvider` from the `artifactCategories` prop. */
var ArtifactCategoriesContext = (0, import_react.createContext)([]);
/**
* Returns the global artifact categories configured on `<ChatProvider>`.
* Empty array when none were provided.
*
* Categories drive the sidebar Artifacts split, the artifact browser's
* pre-applied filters, and category-grouped workspace sections.
*
* @category Hooks
*/
var useArtifactCategories = () => (0, import_react.useContext)(ArtifactCategoriesContext);
/** @internal Provided by `ChatProvider` from `storage.artifact`. */
var ArtifactStorageContext = (0, import_react.createContext)(null);
/**
* Returns the configured global {@link ArtifactStorage} channel, or `null`
* when the storage adapter doesn't provide one.
*
* Renderer implementations use this to lazily fetch (`get`) or persist
* (`update`) artifact content; the artifact browser uses it for `list`.
*
* @category Hooks
*/
var useArtifactStorage = () => (0, import_react.useContext)(ArtifactStorageContext);
/**
* Builds the detailed-view id for an artifact version. This is the contract
* between everything that opens artifact panels (auto-open watcher, workspace
* rail) and the renderer that registers them — always build/read the id
* through these helpers, never hand-roll the string.
*/
function artifactViewId(id, version) {
	return `${id}:${version}`;
}
/**
* Splits a detailed-view id back into artifact id + version. Returns null
* when the string isn't an artifact view id (e.g. a useId fallback).
*/
function parseArtifactViewId(viewId) {
	const sep = viewId.lastIndexOf(":");
	if (sep <= 0) return null;
	const versionPart = viewId.slice(sep + 1);
	if (!/^\d+$/.test(versionPart)) return null;
	return {
		id: viewId.slice(0, sep),
		version: Number(versionPart)
	};
}
/**
* Internal default storage — in-memory, no persistence across reload.
* Used by `<ChatProvider>` when no `storage` prop is provided. Not exported
* from the package; callers who want explicit in-memory behavior should
* construct their own adapter object.
*/
function createDefaultInMemoryStorage() {
	let threads = [];
	const messagesByThread = /* @__PURE__ */ new Map();
	return { thread: {
		async listThreads() {
			return { threads };
		},
		async createThread(firstMessage) {
			const thread = {
				id: crypto.randomUUID(),
				title: typeof firstMessage.content === "string" ? firstMessage.content.slice(0, 40) || "New thread" : "New thread",
				createdAt: (/* @__PURE__ */ new Date()).toISOString()
			};
			threads = [thread, ...threads];
			messagesByThread.set(thread.id, [{
				...firstMessage,
				id: firstMessage.id ?? crypto.randomUUID()
			}]);
			return thread;
		},
		async getMessages(threadId) {
			return messagesByThread.get(threadId) ?? [];
		},
		async updateThread(thread) {
			threads = threads.map((t) => t.id === thread.id ? thread : t);
			return thread;
		},
		async deleteThread(id) {
			threads = threads.filter((t) => t.id !== id);
			messagesByThread.delete(id);
		}
	} };
}
/**
* One pass over every artifact registered in the thread. Each artifact
* version (`id:version`) gets a single chance to auto-open — recorded in
* `claimedIds` the first time we see it, whether or not it opens — so an
* edit's new version qualifies again. Returns true when a panel opened.
*/
function evaluateRegisteredArtifacts(artifacts, mayOpen, claimedIds, detailedViewStore) {
	let opened = false;
	const artifactsWithVersions = Object.values(artifacts);
	for (let i = 0; i < artifactsWithVersions.length; i++) {
		const versions = artifactsWithVersions[i];
		if (!versions) continue;
		const latest = versions[versions.length - 1];
		if (!latest) continue;
		const key = artifactViewId(latest.id, latest.version);
		if (claimedIds.has(key)) continue;
		claimedIds.add(key);
		if (!mayOpen || opened) continue;
		detailedViewStore.getState().setActiveDetailedView(key);
		opened = true;
	}
	return opened;
}
/**
* Runs inside ChatProvider: re-evaluates whenever an artifact registers in
* the thread context, opening at most one artifact per stream.
*/
function useArtifactAutoOpenWatcher(artifactAutoOpen, chatStore, threadContextStore, detailedViewStore) {
	const openedThisRunRef = (0, import_react.useRef)(false);
	const claimedIdsRef = (0, import_react.useRef)(/* @__PURE__ */ new Set());
	(0, import_react.useEffect)(() => {
		if (!artifactAutoOpen) return;
		const unsubscribeThread = chatStore.subscribe((s) => s.selectedThreadId, () => {
			claimedIdsRef.current.clear();
			openedThisRunRef.current = false;
		});
		const unsubscribeRun = chatStore.subscribe((s) => s.isRunning, (isRunning) => {
			if (isRunning) openedThisRunRef.current = false;
		});
		const unsubscribeArtifacts = threadContextStore.subscribe((s) => s.artifacts, (artifacts) => {
			if (evaluateRegisteredArtifacts(artifacts, chatStore.getState().isRunning && !openedThisRunRef.current, claimedIdsRef.current, detailedViewStore)) openedThisRunRef.current = true;
		}, { fireImmediately: true });
		return () => {
			unsubscribeThread();
			unsubscribeRun();
			unsubscribeArtifacts();
		};
	}, [
		artifactAutoOpen,
		chatStore,
		threadContextStore,
		detailedViewStore
	]);
}
async function getResponseErrorMessage(response) {
	try {
		const data = await response.clone().json();
		const message = typeof data.error === "string" ? data.error : typeof data.error?.message === "string" ? data.error.message : typeof data.message === "string" ? data.message : null;
		if (message?.trim()) return message;
	} catch {}
	return `Request failed: ${response.status} ${response.statusText}`.trim();
}
/**
* Shared line iterator for streamed HTTP responses.
*
* Buffers the leftover partial line between network chunks so an SSE event (or
* NDJSON record) split across two `reader.read()` results is reassembled rather
* than silently dropped. The reference implementation lived in
* `openai-readable-stream.ts`; this extracts it so `ag-ui.ts` and
* `openai-completions.ts` share the same correct buffering.
*
* Yields each complete line verbatim (caller strips any `data: ` SSE prefix);
* blank lines are skipped. The trailing buffered line is flushed on stream end.
*
* @internal
*/
async function* sseLineIterator(response) {
	const reader = response.body?.getReader();
	if (!reader) throw new Error("No response body");
	const decoder = new TextDecoder();
	let buffer = "";
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split("\n");
		buffer = lines.pop() ?? "";
		for (const line of lines) if (line.trim()) yield line;
	}
	if (buffer.trim()) yield buffer;
}
var agUIAdapter = () => ({ async *parse(response) {
	for await (const line of sseLineIterator(response)) {
		if (!line.startsWith("data: ")) continue;
		const data = line.slice(6).trim();
		if (!data || data === "[DONE]") continue;
		try {
			yield JSON.parse(data);
		} catch (e) {
			console.error("Failed to parse SSE event", e);
		}
	}
} });
/**
* @category Utilities
*/
var processStreamedMessage = async ({ response, createMessage, updateMessage, markToolExecuting = () => {}, clearToolExecuting = () => {}, adapter = agUIAdapter() }) => {
	let currentMessage = {
		id: crypto.randomUUID(),
		role: "assistant",
		content: "",
		toolCalls: []
	};
	let isFirst = true;
	let currentTextItemId = null;
	const toolMessagesByCallId = /* @__PURE__ */ new Map();
	const inFlightToolCallIds = /* @__PURE__ */ new Set();
	let rafId = null;
	const debouncedUpdate = (msg) => {
		if (rafId !== null) cancelAnimationFrame(rafId);
		rafId = requestAnimationFrame(() => {
			updateMessage(msg);
			rafId = null;
		});
	};
	/** Flush the open assistant and start a fresh one (interleaved segments). */
	const startNewAssistantSegment = () => {
		if (rafId !== null) {
			cancelAnimationFrame(rafId);
			rafId = null;
			if (!isFirst) updateMessage(currentMessage);
		}
		currentMessage = {
			id: crypto.randomUUID(),
			role: "assistant",
			content: "",
			toolCalls: []
		};
		isFirst = true;
		currentTextItemId = null;
	};
	const messageHasBody = (msg) => (msg.content?.length ?? 0) > 0 || (msg.toolCalls?.length ?? 0) > 0;
	/** Publish the open assistant only once it has text or tool calls — never an empty shell. */
	const commitCurrentMessage = () => {
		if (isFirst) {
			if (!messageHasBody(currentMessage)) return;
			createMessage(currentMessage);
			isFirst = false;
		} else debouncedUpdate(currentMessage);
	};
	for await (const event of adapter.parse(response)) {
		switch (event.type) {
			case EventType.TEXT_MESSAGE_CHUNK:
			case EventType.TEXT_MESSAGE_CONTENT:
				if (!event.delta) break;
				if ((currentMessage.toolCalls?.length ?? 0) > 0) startNewAssistantSegment();
				currentMessage = {
					...currentMessage,
					content: (currentMessage.content || "") + event.delta
				};
				break;
			case EventType.TOOL_CALL_START:
				inFlightToolCallIds.add(event.toolCallId);
				currentMessage = {
					...currentMessage,
					toolCalls: [...currentMessage.toolCalls || [], {
						id: event.toolCallId,
						type: "function",
						function: {
							name: event.toolCallName,
							arguments: ""
						}
					}]
				};
				break;
			case EventType.TOOL_CALL_END:
				markToolExecuting(event.toolCallId);
				break;
			case EventType.TOOL_CALL_ARGS:
				if (currentMessage.toolCalls) {
					const toolCalls = [...currentMessage.toolCalls];
					const toolCallIndex = toolCalls.findIndex((tc) => tc.id === event.toolCallId);
					if (toolCallIndex !== -1) {
						const currentToolCall = toolCalls[toolCallIndex];
						if (currentToolCall) {
							toolCalls[toolCallIndex] = {
								id: currentToolCall.id,
								type: "function",
								function: {
									name: currentToolCall.function.name,
									arguments: currentToolCall.function.arguments + event.delta
								}
							};
							currentMessage = {
								...currentMessage,
								toolCalls
							};
						}
					}
				}
				break;
			case EventType.TOOL_CALL_CHUNK: {
				const id = event.toolCallId;
				if (!id) break;
				const toolCalls = [...currentMessage.toolCalls || []];
				let index = toolCalls.findIndex((tc) => tc.id === id);
				if (index === -1) {
					inFlightToolCallIds.add(id);
					toolCalls.push({
						id,
						type: "function",
						function: {
							name: event.toolCallName ?? "",
							arguments: ""
						}
					});
					index = toolCalls.length - 1;
				}
				const existing = toolCalls[index];
				if (existing) {
					toolCalls[index] = {
						id: existing.id,
						type: "function",
						function: {
							name: existing.function.name || event.toolCallName || "",
							arguments: existing.function.arguments + (event.delta ?? "")
						}
					};
					currentMessage = {
						...currentMessage,
						toolCalls
					};
				}
				break;
			}
			case EventType.TEXT_MESSAGE_START: {
				const startId = event.messageId ?? null;
				if (((currentMessage.content?.length ?? 0) > 0 || (currentMessage.toolCalls?.length ?? 0) > 0) && startId !== currentTextItemId) startNewAssistantSegment();
				currentTextItemId = startId;
				break;
			}
			case EventType.TOOL_CALL_RESULT: {
				clearToolExecuting(event.toolCallId);
				inFlightToolCallIds.delete(event.toolCallId);
				const failed = event;
				const errorText = failed.isError === true || typeof failed.error === "string" && failed.error.length > 0 ? failed.error ?? event.content : void 0;
				const existing = toolMessagesByCallId.get(event.toolCallId);
				if (existing) {
					const updated = {
						...existing,
						content: event.content,
						...errorText ? { error: errorText } : {}
					};
					toolMessagesByCallId.set(event.toolCallId, updated);
					updateMessage(updated);
				} else {
					const toolMessage = {
						id: crypto.randomUUID(),
						role: "tool",
						toolCallId: event.toolCallId,
						content: event.content,
						...errorText ? { error: errorText } : {}
					};
					toolMessagesByCallId.set(event.toolCallId, toolMessage);
					createMessage(toolMessage);
				}
				continue;
			}
			case EventType.RUN_ERROR: {
				const raw = event.message || event.error || "Stream error";
				const errorText = typeof raw === "string" ? raw : JSON.stringify(raw);
				for (const toolCallId of inFlightToolCallIds) clearToolExecuting(toolCallId);
				inFlightToolCallIds.clear();
				throw new Error(errorText);
			}
		}
		commitCurrentMessage();
	}
	if (rafId !== null) {
		cancelAnimationFrame(rafId);
		updateMessage(currentMessage);
	} else if (isFirst && messageHasBody(currentMessage)) createMessage(currentMessage);
	return currentMessage;
};
async function buildObservabilityErrorDetail(response) {
	if (response.ok) return {};
	try {
		const res = await response.clone().json();
		return {
			error: res?.error,
			...!res?.message ? { message: await getResponseErrorMessage(response) } : { message: res.message }
		};
	} catch {
		return { message: await getResponseErrorMessage(response) };
	}
}
function levelForStatus(status) {
	return status >= 400 ? "error" : "info";
}
var mergeThreadList = (existing, incoming) => Array.from(new Map([...existing, ...incoming].map((t) => [t.id, t])).values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
var createChatStore = (configRef) => {
	const { storage } = configRef.current;
	const { thread: threadStorage } = storage;
	return createStore()(subscribeWithSelector((set, get) => ({
		threads: [],
		isLoadingThreads: false,
		threadListError: null,
		selectedThreadId: null,
		hasMoreThreads: false,
		_nextCursor: void 0,
		messages: [],
		isRunning: false,
		isLoadingMessages: false,
		threadError: null,
		executingToolCallIds: /* @__PURE__ */ new Set(),
		_abortController: null,
		loadThreads: () => {
			set({
				isLoadingThreads: true,
				threadListError: null
			});
			threadStorage.listThreads(void 0).then(({ threads = [], nextCursor }) => {
				set({
					threads,
					isLoadingThreads: false,
					_nextCursor: nextCursor,
					hasMoreThreads: nextCursor !== void 0
				});
			}).catch((e) => {
				set({
					isLoadingThreads: false,
					threadListError: e
				});
			});
		},
		loadMoreThreads: () => {
			const cursor = get()._nextCursor;
			if (cursor === void 0) return;
			threadStorage.listThreads(cursor).then(({ threads = [], nextCursor }) => {
				set((s) => ({
					threads: mergeThreadList(s.threads, threads),
					_nextCursor: nextCursor,
					hasMoreThreads: nextCursor !== void 0
				}));
			}).catch((e) => {
				set({ threadListError: e });
			});
		},
		switchToNewThread: () => {
			get().cancelMessage();
			set({
				selectedThreadId: null,
				messages: [],
				threadError: null,
				executingToolCallIds: /* @__PURE__ */ new Set()
			});
		},
		createThread: async (firstMessage) => {
			const thread = await threadStorage.createThread(firstMessage);
			set((s) => ({ threads: mergeThreadList(s.threads, [thread]) }));
			return thread;
		},
		selectThread: (threadId) => {
			if (get().selectedThreadId === threadId) return;
			get().cancelMessage();
			set({
				selectedThreadId: threadId,
				messages: [],
				isLoadingMessages: true,
				threadError: null,
				executingToolCallIds: /* @__PURE__ */ new Set()
			});
			threadStorage.getMessages(threadId).then((messages) => set({
				messages,
				isLoadingMessages: false
			})).catch((e) => set({
				threadError: e,
				isLoadingMessages: false
			}));
		},
		updateThread: (thread) => {
			const setPending = (id, isPending) => set((s) => ({ threads: s.threads.map((t) => t.id === id ? {
				...t,
				isPending
			} : t) }));
			setPending(thread.id, true);
			threadStorage.updateThread(thread).then((updated) => {
				set((s) => ({ threads: s.threads.map((t) => t.id === updated.id ? updated : t) }));
			}).catch(() => setPending(thread.id, false));
		},
		deleteThread: (threadId) => {
			const setPending = (id, isPending) => set((s) => ({ threads: s.threads.map((t) => t.id === id ? {
				...t,
				isPending
			} : t) }));
			setPending(threadId, true);
			threadStorage.deleteThread(threadId).then(() => {
				const state = get();
				set({ threads: state.threads.filter((t) => t.id !== threadId) });
				if (state.selectedThreadId === threadId) state.switchToNewThread();
			}).catch(() => setPending(threadId, false));
		},
		processMessage: async (message) => {
			if (get().isRunning) return;
			const abortController = new AbortController();
			const optimisticMessage = {
				...message,
				id: crypto.randomUUID(),
				role: "user"
			};
			set({
				_abortController: abortController,
				isRunning: true,
				threadError: null,
				executingToolCallIds: /* @__PURE__ */ new Set()
			});
			set((s) => ({ messages: [...s.messages, optimisticMessage] }));
			abortController.signal.addEventListener("abort", () => {
				set({
					_abortController: null,
					isRunning: false
				});
			});
			try {
				let threadId = get().selectedThreadId;
				if (!threadId) {
					threadId = (await get().createThread(optimisticMessage)).id;
					set({ selectedThreadId: threadId });
				}
				const runId = crypto.randomUUID();
				observability.info({
					kind: "LLM:request",
					threadId,
					runId,
					userMessage: optimisticMessage
				});
				let response = null;
				try {
					response = await configRef.current.llm.send({
						threadId,
						messages: get().messages,
						signal: abortController.signal
					});
					observability(levelForStatus(response.status), {
						kind: response.ok ? "LLM:response" : "LLM:error",
						threadId,
						status: response.status,
						ok: response.ok,
						runId,
						...await buildObservabilityErrorDetail(response)
					});
					if (!response.ok) throw new Error(await getResponseErrorMessage(response));
				} catch (e) {
					observability.error({
						kind: "LLM:error",
						threadId,
						runId,
						error: e instanceof Error ? e : new Error(String(e))
					});
					throw e;
				}
				await processStreamedMessage({
					response,
					createMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
					updateMessage: (msg) => set((s) => ({ messages: s.messages.map((m) => m.id === msg.id ? msg : m) })),
					markToolExecuting: (id) => set((s) => s.executingToolCallIds.has(id) ? s : { executingToolCallIds: new Set(s.executingToolCallIds).add(id) }),
					clearToolExecuting: (id) => set((s) => {
						if (!s.executingToolCallIds.has(id)) return s;
						const next = new Set(s.executingToolCallIds);
						next.delete(id);
						return { executingToolCallIds: next };
					}),
					adapter: configRef.current.llm.streamProtocol
				});
			} catch (e) {
				if (!abortController.signal.aborted) set({ threadError: e instanceof Error ? e : new Error(String(e)) });
			} finally {
				set({
					_abortController: null,
					isRunning: false,
					executingToolCallIds: /* @__PURE__ */ new Set()
				});
			}
		},
		appendMessages: (...newMessages) => {
			set((s) => ({ messages: [...s.messages, ...newMessages] }));
		},
		updateMessage: (message) => {
			set((s) => ({ messages: s.messages.map((m) => m.id === message.id ? message : m) }));
		},
		setMessages: (messages) => {
			set({ messages });
		},
		deleteMessage: (messageId) => {
			set((s) => ({ messages: s.messages.filter((m) => m.id !== messageId) }));
		},
		cancelMessage: () => {
			get()._abortController?.abort();
		}
	})));
};
/**
* Creates a Zustand store managing detailed-view state.
* Instantiated once by `ChatProvider` — consumers should not call this directly.
*
* @internal
*/
var createDetailedViewStore = () => {
	return createStore()(subscribeWithSelector((set, get) => ({
		activeDetailedViewId: null,
		setActiveDetailedView: (id) => {
			set({ activeDetailedViewId: id });
		},
		reset: () => {
			set({ activeDetailedViewId: null });
		},
		_detailedViewPanelNode: null,
		_setDetailedViewPanelNode: (node) => {
			set({ _detailedViewPanelNode: node });
		}
	})));
};
var entriesEqual = (a, b) => a.heading === b.heading && a.type === b.type;
var upsertVersion = (registry, entry) => {
	const existing = registry[entry.id] ?? [];
	const sameVersionIdx = existing.findIndex((e) => e.version === entry.version);
	if (sameVersionIdx !== -1) {
		const current = existing[sameVersionIdx];
		if (entriesEqual(current, entry)) return registry;
		const next = existing.slice();
		next[sameVersionIdx] = entry;
		return {
			...registry,
			[entry.id]: next
		};
	}
	const insertIdx = existing.findIndex((e) => e.version > entry.version);
	const next = insertIdx === -1 ? [...existing, entry] : [
		...existing.slice(0, insertIdx),
		entry,
		...existing.slice(insertIdx)
	];
	return {
		...registry,
		[entry.id]: next
	};
};
var removeVersion = (registry, id, version) => {
	const existing = registry[id];
	if (!existing) return registry;
	const idx = existing.findIndex((e) => e.version === version);
	if (idx === -1) return registry;
	if (existing.length === 1) {
		const { [id]: _removed, ...rest } = registry;
		return rest;
	}
	const next = existing.slice();
	next.splice(idx, 1);
	return {
		...registry,
		[id]: next
	};
};
/**
* Creates a Zustand store managing the per-thread artifact registry.
*
* Active detailed-view state lives in a separate store
* (see {@link useDetailedView} / {@link useActiveDetailedView}) — TC tracks
* what's *attached* to the thread; detailed-view state tracks what's *visible*.
*
* Instantiated once by `ChatProvider` — consumers should not call this directly.
*
* @internal
*/
var createThreadContextStore = () => {
	return createStore()(subscribeWithSelector((set) => ({
		artifacts: {},
		registerArtifact: (entry) => {
			set((s) => ({ artifacts: upsertVersion(s.artifacts, entry) }));
		},
		unregisterArtifact: (id, version) => {
			set((s) => ({ artifacts: removeVersion(s.artifacts, id, version) }));
		},
		reset: () => {
			set({ artifacts: {} });
		}
	})));
};
var EMPTY_CATEGORIES = [];
var ChatProvider = ({ children, storage, llm, artifactRenderers, artifactCategories, artifactAutoOpen }) => {
	const [resolvedStorage] = (0, import_react.useState)(() => storage ?? createDefaultInMemoryStorage());
	const config = (0, import_react.useRef)({
		storage: resolvedStorage,
		llm
	});
	config.current.llm = llm;
	const [chatStore] = (0, import_react.useState)(() => createChatStore(config));
	const [detailedViewStore] = (0, import_react.useState)(() => createDetailedViewStore());
	const [threadContextStore] = (0, import_react.useState)(() => createThreadContextStore());
	const [artifactRendererRegistry] = (0, import_react.useState)(() => buildArtifactRendererRegistry(artifactRenderers ?? []));
	(0, import_react.useRef)(artifactRenderers);
	(0, import_react.useRef)(false);
	(0, import_react.useEffect)(() => {}, [artifactRenderers]);
	(0, import_react.useEffect)(() => {
		return chatStore.subscribe((state) => state.selectedThreadId, () => {
			detailedViewStore.getState().reset();
			threadContextStore.getState().reset();
		});
	}, [
		chatStore,
		detailedViewStore,
		threadContextStore
	]);
	useArtifactAutoOpenWatcher(artifactAutoOpen ?? true, chatStore, threadContextStore, detailedViewStore);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChatContext.Provider, {
		value: chatStore,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DetailedViewContext.Provider, {
			value: detailedViewStore,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ThreadContextContext.Provider, {
				value: threadContextStore,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArtifactRenderersContext.Provider, {
					value: artifactRendererRegistry,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArtifactStorageContext.Provider, {
						value: resolvedStorage.artifact ?? null,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArtifactCategoriesContext.Provider, {
							value: artifactCategories ?? EMPTY_CATEGORIES,
							children
						})
					})
				})
			})
		})
	});
};
//#endregion
export { ChatProvider, MessageProvider, artifactViewId, create, lookupArtifactRenderer, lookupArtifactRendererByType, parseArtifactViewId, require_jsx_runtime, require_with_selector, useActiveDetailedView, useArtifactCategories, useArtifactList, useArtifactRenderer, useArtifactRendererRegistry, useArtifactStorage, useDetailedView, useDetailedViewPortalTarget, useDetailedViewStore, useShallow, useThread, useThreadContextStore, useThreadList, useToolActivities };
