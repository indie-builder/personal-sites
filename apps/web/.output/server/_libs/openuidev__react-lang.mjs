import { __toESM } from "../_runtime.mjs";
import { require_react } from "./@floating-ui/react-dom+[...].mjs";
import { require_jsx_runtime } from "./@openuidev/react-headless+[...].mjs";
import { ACTION_STEPS, BuiltinActionType, ToolNotFoundError, createLibrary, createQueryManager, createStore, createStreamingParser, defineComponent, enrichErrors, evaluate, evaluateRoot, extractToolResult, markReactive, parseMessage, resolveStateField, validate } from "./openuidev__lang-core.mjs";
import { observability } from "./openuidev__observability.mjs";
//#region ../../node_modules/.bun/@openuidev+react-lang@1.0.0+e098bdefb5c01065/node_modules/@openuidev/react-lang/dist/exports-CLfR509v.mjs
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
function libraryKey(library) {
	return library.id ?? library.root ?? Object.keys(library.components).sort().join(",");
}
function defineComponent$1(config) {
	return defineComponent(config);
}
function createLibrary$1(input) {
	return published(createLibrary(input));
}
var extendCount = 0;
function published(library, key = libraryKey(library)) {
	const extend = library.extend;
	return Object.assign(library, { extend: ((ext) => published(extend(ext), `${key}:extend-${++extendCount}`)) });
}
var OpenUIContext = (0, import_react.createContext)(null);
/**
* Access the full OpenUI context. Throws if used outside a <Renderer />.
*/
function useOpenUI() {
	const ctx = (0, import_react.useContext)(OpenUIContext);
	if (!ctx) throw new Error("useOpenUI must be used within a <Renderer /> component.");
	return ctx;
}
/**
* Get the renderNode function for rendering nested component values.
*/
function useRenderNode() {
	return useOpenUI().renderNode;
}
/**
* Get the triggerAction function for firing structured action events.
*
* @example
* ```tsx
* const triggerAction = useTriggerAction();
* <button onClick={() => triggerAction("Submit", "myForm")}>
* ```
*/
function useTriggerAction() {
	return useOpenUI().triggerAction;
}
/**
* Whether the LLM is currently streaming content.
*/
function useIsStreaming() {
	return useOpenUI().isStreaming;
}
/**
* Whether any Query is currently fetching data.
* Useful for showing skeleton/loading states in data-driven components.
*/
function useIsQueryLoading() {
	return useOpenUI().isQueryLoading;
}
/**
* Get a form field value from the form state context.
*
* @example
* ```tsx
* const getFieldValue = useGetFieldValue();
* const name = getFieldValue("contactForm", "name");
* ```
*/
function useGetFieldValue() {
	return useOpenUI().getFieldValue;
}
/**
* Get the setFieldValue function for updating form field values.
*
* @example
* ```tsx
* const setFieldValue = useSetFieldValue();
* <input onChange={(e) => setFieldValue("contactForm", "Input", "name", e.target.value, false)} />
* ```
*/
function useSetFieldValue() {
	return useOpenUI().setFieldValue;
}
var FormNameContext = (0, import_react.createContext)(void 0);
/**
* Get the current form name (set by the nearest parent Form component).
* Returns undefined if not inside a Form.
*/
function useFormName() {
	return (0, import_react.useContext)(FormNameContext);
}
var SCRIPTS = "]]>openui:scripts";
var CONTENT_LINE = /^\]\]>openui:content(?:\?.*)?\r?$(\n?)/m;
var BARE_SCRIPTS = /^\]\]>openui:scripts(?=\?|\r?$)/gm;
function markerIndex(text) {
	let quote = "";
	let escaped = false;
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (quote) {
			if (escaped) escaped = false;
			else if (c === "\\") escaped = true;
			else if (c === quote) quote = "";
		} else if (c === "#" || c === "/" && text[i + 1] === "/") {
			const newline = text.indexOf("\n", i);
			if (newline < 0) return -1;
			i = newline;
		} else if (c === "\"" || c === "'") quote = c;
		else if (text.startsWith("]]>", i)) return i;
	}
	return -1;
}
function readScripts(header, payload) {
	try {
		const { count } = JSON.parse(header);
		const values = JSON.parse(payload);
		if (!Array.isArray(values) || !Number.isSafeInteger(count) || count !== values.length) return null;
		const names = /* @__PURE__ */ new Set();
		for (const script of values) {
			if (!script || typeof script.name !== "string" || !script.name || typeof script.code !== "string" || names.has(script.name)) return null;
			names.add(script.name);
		}
		return {
			names,
			revision: JSON.stringify(values.map((script) => ({
				name: script.name,
				code: script.code
			})).sort((a, b) => a.name.localeCompare(b.name)))
		};
	} catch {
		return null;
	}
}
/** Reads an OpenUI Cloud response: a stored message (see parseMessage) plus its scripts section. */
function parseResponseBundle(response, streaming) {
	const text = response ?? "";
	const line = CONTENT_LINE.exec(text);
	const framed = !!line && (!streaming || line[1] === "\n");
	const { content, attributes, end } = parseMessage(text.replace(BARE_SCRIPTS, "$& "), { streaming });
	let program = content;
	let section = false;
	let scripts = null;
	const at = markerIndex(program);
	if (at >= 0 && program.startsWith(SCRIPTS, at)) {
		section = true;
		const newline = program.indexOf("\n", at);
		let to = program.length;
		if (newline >= 0) {
			const next = markerIndex(program.slice(newline + 1));
			if (next >= 0) to = newline + 1 + next;
			scripts = readScripts(program.slice(at + 17, newline), program.slice(newline + 1, to));
		}
		const before = at > 0 ? program.slice(0, at).replace(/\r?\n$/, "") : "";
		const after = program.slice(to);
		program = after ? `${before}\n${after}` : before;
	}
	const metadata = {};
	if (!framed && !section && !end) return {
		program,
		metadata,
		scripts: /* @__PURE__ */ new Set(),
		complete: true,
		isBundle: false,
		error: void 0
	};
	if (framed && attributes.name !== void 0) metadata.name = attributes.name;
	const error = section && !scripts ? "Invalid scripts bundle" : void 0;
	return {
		program,
		metadata,
		scripts: scripts?.names ?? /* @__PURE__ */ new Set(),
		complete: !error && (end || !streaming || !framed),
		isBundle: true,
		error: streaming ? void 0 : error,
		...scripts?.names.size ? { scriptRevision: scripts.revision } : {}
	};
}
/** Aggregates Renderer errors and owns the public onError callback behavior. */
function useOpenUIErrors({ response, isStreaming, result, evaluatedResult, library, querySnapshot, parseExceptionRef, runtimeErrorsRef, renderErrorsRef, onError }) {
	const errorsRef = (0, import_react.useRef)([]);
	const [errorRevision, setErrorRevision] = (0, import_react.useState)(0);
	const lastErrorKeyRef = (0, import_react.useRef)("");
	const onErrorRef = (0, import_react.useRef)(onError);
	onErrorRef.current = onError;
	(0, import_react.useEffect)(() => {
		if (isStreaming) {
			errorsRef.current = [];
			if (lastErrorKeyRef.current !== "") {
				lastErrorKeyRef.current = "";
				onErrorRef.current?.([]);
			}
			return;
		}
		const errors = [];
		if (parseExceptionRef.current) errors.push(parseExceptionRef.current);
		if (response && !result?.meta.statementCount && !parseExceptionRef.current) errors.push({
			source: "parser",
			code: "parse-failed",
			message: "Response could not be parsed as valid openui-lang",
			hint: `The entire response must be valid openui-lang code starting with root = ${library.root ?? "Root"}(...)`
		});
		if (result?.meta.errors.length) errors.push(...enrichErrors(result.meta.errors, library.toJSONSchema(), Object.keys(library.components)));
		errors.push(...runtimeErrorsRef.current);
		errors.push(...renderErrorsRef.current);
		renderErrorsRef.current = [];
		errors.push(...querySnapshot.__openui_errors ?? []);
		errorsRef.current = errors;
		const errorKey = JSON.stringify(errors);
		if (errorKey === lastErrorKeyRef.current) return;
		lastErrorKeyRef.current = errorKey;
		setErrorRevision((revision) => revision + 1);
		if (onErrorRef.current) onErrorRef.current(errors);
		else if (errors.length > 0) for (const error of errors) console.warn(`[openui] ${error.source}/${error.code}: ${error.message}`);
	}, [
		isStreaming,
		response,
		result,
		evaluatedResult,
		querySnapshot,
		library,
		parseExceptionRef,
		runtimeErrorsRef,
		renderErrorsRef
	]);
	return {
		errorsRef,
		errorRevision
	};
}
/**
* Producer-side contract for the stream lifecycle events this package emits on
* `@openuidev/observability`. Intentionally duplicated (not imported) in
* `@openuidev/observability-cloud` (src/events/stream.ts), which consumes these
* events; the two packages have no dependency on each other. Keep the string
* constants and the settled detail shape in sync when changing either side.
*/
var STREAM_EVENT_KIND = "react-lang:stream";
var STREAM_PHASE_STREAMING = "streaming";
var STREAM_PHASE_SETTLED = "settled";
var fallbackId = 0;
function createStreamId() {
	if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
	fallbackId += 1;
	return `openui-lang-${Date.now().toString(36)}-${fallbackId.toString(36)}`;
}
function createStreamingObservabilityState() {
	return {
		id: null,
		updateIndex: 0,
		lastResponse: null,
		hasPublishedStreamingSnapshot: false,
		settled: false,
		lastSettledErrorKey: null,
		startedAt: null,
		durationMs: null
	};
}
function captureStreamTiming(state, now = Date.now()) {
	state.startedAt ??= now;
	if (state.settled) state.durationMs ??= Math.max(0, now - state.startedAt);
	const elapsedMs = state.durationMs ?? Math.max(0, now - state.startedAt);
	return {
		startedAt: state.startedAt,
		elapsedMs,
		...state.durationMs != null ? { durationMs: state.durationMs } : {}
	};
}
/** Advances a Renderer through successive stream lifecycles. */
function advanceStreamingObservability(state, isStreaming, response, settledErrorKey = null, idFactory = createStreamId) {
	if (isStreaming) {
		if (state.settled) Object.assign(state, createStreamingObservabilityState());
		state.id ??= idFactory();
		if (state.hasPublishedStreamingSnapshot && state.lastResponse === response) return null;
		state.hasPublishedStreamingSnapshot = true;
		state.lastResponse = response;
		state.updateIndex += 1;
		return {
			id: state.id,
			phase: STREAM_PHASE_STREAMING,
			updateIndex: state.updateIndex
		};
	}
	if (!state.id) return null;
	if (state.settled && (settledErrorKey === null || state.lastSettledErrorKey === settledErrorKey)) return null;
	state.updateIndex += 1;
	state.settled = true;
	state.lastSettledErrorKey = settledErrorKey;
	return {
		id: state.id,
		phase: STREAM_PHASE_SETTLED,
		updateIndex: state.updateIndex
	};
}
function parserMetadata(result) {
	if (!result) return void 0;
	return {
		incomplete: result.meta.incomplete,
		unresolved: result.meta.unresolved,
		orphaned: result.meta.orphaned,
		statementCount: result.meta.statementCount
	};
}
/**
* Publishes the incremental OpenUI Lang stream lifecycle. The stable id is
* created only after this Renderer instance has actually entered streaming.
*/
function useStreamingObservability({ response, isStreaming, result, errorsRef, errorRevision, publish = true, __libraryId }) {
	const streamRef = (0, import_react.useRef)(createStreamingObservabilityState());
	(0, import_react.useEffect)(() => {
		if (!publish) return;
		const errors = errorsRef.current;
		const settledErrorKey = isStreaming ? null : JSON.stringify(errors);
		const update = advanceStreamingObservability(streamRef.current, isStreaming, response, settledErrorKey);
		const libraryIdFields = __libraryId !== void 0 ? { __libraryId } : {};
		if (isStreaming) {
			if (update) observability.info({
				id: update.id,
				kind: STREAM_EVENT_KIND,
				phase: update.phase,
				updateIndex: update.updateIndex,
				response,
				responseLength: response?.length ?? 0,
				parser: parserMetadata(result),
				...captureStreamTiming(streamRef.current),
				...libraryIdFields,
				message: "OpenUI Lang is streaming"
			});
			return;
		}
		if (update?.phase === "settled") observability(errors.length > 0 ? "error" : "info", {
			id: update.id,
			kind: STREAM_EVENT_KIND,
			phase: STREAM_PHASE_SETTLED,
			updateIndex: update.updateIndex,
			response,
			responseLength: response?.length ?? 0,
			parser: parserMetadata(result),
			errors,
			errorCount: errors.length,
			...captureStreamTiming(streamRef.current),
			...libraryIdFields,
			message: errors.length > 0 ? `OpenUI Lang settled with ${errors.length} error${errors.length === 1 ? "" : "s"}` : "OpenUI Lang settled"
		});
	}, [
		publish,
		isStreaming,
		response,
		result,
		errorsRef,
		errorRevision,
		__libraryId
	]);
}
/** Unwrap { value, componentType } wrapper from form field entries. Returns raw value. */
function unwrapFieldValue(v) {
	if (v && typeof v === "object" && !Array.isArray(v) && "value" in v) return v.value;
	return v;
}
/**
* Core state hook — extracts all form state, action handling, parser
* management, and context assembly out of the Renderer component.
*
* Store holds everything: $bindings as top-level keys, form fields nested
* under formName as plain values.
*/
function useOpenUIState({ response: raw, library, isStreaming, onAction, onStateUpdate, initialState, toolProvider, onError, publishObservability }, renderDeep) {
	const bundle = (0, import_react.useMemo)(() => parseResponseBundle(raw, isStreaming), [raw, isStreaming]);
	const blocked = isStreaming || !bundle.complete || !!bundle.error;
	const bundleBlocked = bundle.isBundle && blocked;
	const settledScripts = (0, import_react.useRef)({
		revision: null,
		names: /* @__PURE__ */ new Set()
	});
	if (!blocked) settledScripts.current = {
		revision: "scriptRevision" in bundle ? bundle.scriptRevision ?? null : null,
		names: bundle.scripts
	};
	const scriptRevision = settledScripts.current.revision;
	const scriptNames = settledScripts.current.names;
	const schema = (0, import_react.useMemo)(() => library.toJSONSchema(), [library]);
	const sp = (0, import_react.useMemo)(() => createStreamingParser(schema, library.root), [schema, library.root]);
	const functions = (0, import_react.useMemo)(() => Object.fromEntries(Object.entries(schema.functions ?? {}).flatMap(([name, s]) => {
		const fn = library.functions?.[name]?.fn;
		return fn ? [[name, {
			...s,
			fn
		}]] : [];
	})), [schema, library.functions]);
	const parseExceptionRef = (0, import_react.useRef)(null);
	const result = (0, import_react.useMemo)(() => {
		parseExceptionRef.current = bundle.error ? {
			source: "parser",
			code: "parse-failed",
			message: bundle.error
		} : null;
		if (!bundle.program) return null;
		try {
			return sp.set(bundle.program, !isStreaming);
		} catch (e) {
			parseExceptionRef.current = {
				source: "parser",
				code: "parse-exception",
				message: `Parser crashed: ${e instanceof Error ? e.message : String(e)}`,
				hint: "The response may contain syntax the parser cannot handle"
			};
			return null;
		}
	}, [
		sp,
		bundle.program,
		bundle.error,
		isStreaming
	]);
	const store = (0, import_react.useMemo)(() => createStore(), []);
	const queryManager = (0, import_react.useMemo)(() => createQueryManager(toolProvider ?? null), [toolProvider]);
	(0, import_react.useEffect)(() => {
		queryManager.activate();
		return () => queryManager.dispose();
	}, [queryManager]);
	const initializingRef = (0, import_react.useRef)(false);
	const storeInitKeyRef = (0, import_react.useRef)(Symbol());
	(0, import_react.useEffect)(() => {
		if (!result?.stateDeclarations && !initialState) return;
		const key = `${JSON.stringify(result?.stateDeclarations)}::${JSON.stringify(initialState)}`;
		if (storeInitKeyRef.current === key) return;
		storeInitKeyRef.current = key;
		const bindingDefaults = {};
		if (initialState) for (const [key, value] of Object.entries(initialState)) if (key.startsWith("$")) bindingDefaults[key] = value;
		else store.set(key, value);
		initializingRef.current = true;
		store.initialize(result?.stateDeclarations ?? {}, bindingDefaults);
		initializingRef.current = false;
	}, [
		result?.stateDeclarations,
		store,
		initialState
	]);
	const storeSnapshot = (0, import_react.useSyncExternalStore)(store.subscribe, store.getSnapshot, store.getSnapshot);
	const querySnapshot = (0, import_react.useSyncExternalStore)(queryManager.subscribe, queryManager.getSnapshot, queryManager.getSnapshot);
	const evaluationContext = (0, import_react.useMemo)(() => ({
		getState: (name) => unwrapFieldValue(store.get(name)),
		resolveRef: (name) => {
			const mutResult = queryManager.getMutationResult(name);
			if (mutResult) return mutResult;
			return queryManager.getResult(name);
		},
		functions,
		actions: schema.actions
	}), [
		store,
		queryManager,
		functions,
		schema.actions
	]);
	(0, import_react.useEffect)(() => {
		if (blocked) return;
		const evaluatedNodes = (result?.queryStatements ?? []).map((qn) => {
			const relevantDeps = {};
			const toolName = qn.toolAST ? evaluate(qn.toolAST, evaluationContext) : "";
			if (qn.deps) for (const ref of qn.deps) relevantDeps[ref] = storeSnapshot[ref];
			if (scriptNames.has(toolName)) relevantDeps.__openuiScriptRevision = scriptRevision;
			return {
				statementId: qn.statementId,
				toolName,
				args: qn.argsAST ? evaluate(qn.argsAST, evaluationContext) : null,
				defaults: qn.defaultsAST ? evaluate(qn.defaultsAST, evaluationContext) : null,
				refreshInterval: qn.refreshAST ? evaluate(qn.refreshAST, evaluationContext) : void 0,
				deps: Object.keys(relevantDeps).length > 0 ? relevantDeps : void 0,
				complete: qn.complete
			};
		});
		queryManager.evaluateQueries(evaluatedNodes);
	}, [
		blocked,
		result?.queryStatements,
		evaluationContext,
		queryManager,
		storeSnapshot,
		scriptRevision,
		scriptNames
	]);
	(0, import_react.useEffect)(() => {
		if (blocked) return;
		const nodes = (result?.mutationStatements ?? []).map((mn) => ({
			statementId: mn.statementId,
			toolName: mn.toolAST ? evaluate(mn.toolAST, evaluationContext) : ""
		}));
		queryManager.registerMutations(nodes);
	}, [
		blocked,
		result?.mutationStatements,
		evaluationContext,
		queryManager
	]);
	const propsRef = (0, import_react.useRef)({
		onAction,
		onStateUpdate
	});
	propsRef.current = {
		onAction,
		onStateUpdate
	};
	const resultRef = (0, import_react.useRef)(result);
	resultRef.current = result;
	const lastInitSnapshotRef = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		lastInitSnapshotRef.current = store.getSnapshot();
		return store.subscribe(() => {
			const currentSnapshot = store.getSnapshot();
			if (initializingRef.current || currentSnapshot === lastInitSnapshotRef.current) return;
			lastInitSnapshotRef.current = null;
			propsRef.current.onStateUpdate?.(currentSnapshot);
		});
	}, [store]);
	const getFieldValue = (0, import_react.useCallback)((formName, name) => {
		if (!formName) return unwrapFieldValue(store.get(name));
		const formData = store.get(formName);
		if (!formData || typeof formData !== "object" || Array.isArray(formData)) return void 0;
		return unwrapFieldValue(formData[name]);
	}, [store]);
	const setFieldValue = (0, import_react.useCallback)((formName, componentType, name, value, shouldTriggerSaveCallback = true) => {
		const wrapped = {
			value,
			componentType
		};
		if (!formName) store.set(name, wrapped);
		else {
			const raw = store.get(formName);
			const formData = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
			store.set(formName, {
				...formData,
				[name]: wrapped
			});
		}
		if (shouldTriggerSaveCallback) propsRef.current.onStateUpdate?.(store.getSnapshot());
	}, [store]);
	const getFormPayload = (0, import_react.useCallback)((formName) => {
		if (formName) {
			const raw = store.get(formName);
			if (raw && typeof raw === "object" && !Array.isArray(raw)) return { [formName]: raw };
		}
		return store.getSnapshot();
	}, [store]);
	const triggerAction = (0, import_react.useCallback)(async (userMessage, formName, action) => {
		if (bundleBlocked) return;
		const { onAction: handler } = propsRef.current;
		if (action && !("steps" in action)) {
			const formPayload = getFormPayload(formName);
			const actionType = action.type || BuiltinActionType.ContinueConversation;
			if (schema.actions && Object.prototype.hasOwnProperty.call(schema.actions, actionType)) return;
			const params = { ...action.params || {} };
			if (action.url) params.url = action.url;
			if (action.context) params.context = action.context;
			handler?.({
				type: actionType,
				params,
				humanFriendlyMessage: userMessage,
				formState: formPayload,
				formName
			});
			return;
		}
		const actionPlan = action;
		if (actionPlan?.steps) {
			for (const step of actionPlan.steps) switch (step.type) {
				case ACTION_STEPS.Run:
					if (step.refType === "mutation") {
						const mn = resultRef.current?.mutationStatements?.find((m) => m.statementId === step.statementId);
						const evaluatedArgs = mn?.argsAST ? evaluate(mn.argsAST, evaluationContext) : {};
						if (!await queryManager.fireMutation(step.statementId, evaluatedArgs)) return;
					} else queryManager.invalidate([step.statementId]);
					break;
				case ACTION_STEPS.ToAssistant:
					handler?.({
						type: BuiltinActionType.ContinueConversation,
						params: step.context !== void 0 ? { context: step.context } : {},
						humanFriendlyMessage: step.message,
						formState: getFormPayload(formName),
						formName
					});
					break;
				case ACTION_STEPS.OpenUrl:
					handler?.({
						type: BuiltinActionType.OpenUrl,
						params: { url: step.url },
						humanFriendlyMessage: "",
						formState: getFormPayload(formName),
						formName
					});
					break;
				case "custom_action":
					handler?.({
						type: step.name,
						params: step.params,
						humanFriendlyMessage: "",
						formState: getFormPayload(formName),
						formName
					});
					break;
				case ACTION_STEPS.Set: {
					if (!step.valueAST) {
						console.warn(`[openui] Set action for ${step.target} has no valueAST — skipping`);
						break;
					}
					const value = evaluate(step.valueAST, evaluationContext);
					store.set(step.target, value);
					break;
				}
				case ACTION_STEPS.Reset: {
					const decls = resultRef.current?.stateDeclarations ?? {};
					for (const target of step.targets) store.set(target, decls[target] ?? null, { pristine: true });
					break;
				}
			}
			return;
		}
		handler?.({
			type: BuiltinActionType.ContinueConversation,
			params: {},
			humanFriendlyMessage: userMessage,
			formState: getFormPayload(formName),
			formName
		});
	}, [
		bundleBlocked,
		queryManager,
		evaluationContext,
		getFormPayload,
		store,
		schema.actions
	]);
	const renderErrorsRef = (0, import_react.useRef)([]);
	const isStreamingRef = (0, import_react.useRef)(isStreaming);
	isStreamingRef.current = isStreaming;
	const reportError = (0, import_react.useCallback)((error) => {
		if (isStreamingRef.current) return;
		renderErrorsRef.current.push(error);
	}, []);
	const isQueryLoading = querySnapshot.__openui_loading.length > 0 || isStreaming && bundleBlocked && (result?.queryStatements.length ?? 0) > 0;
	const queryErrors = (0, import_react.useMemo)(() => querySnapshot.__openui_errors.filter((error) => error.source === "query"), [querySnapshot]);
	const retryQueries = (0, import_react.useCallback)(() => {
		if (bundleBlocked) return;
		queryManager.invalidate(queryErrors.map((error) => error.statementId));
	}, [
		bundleBlocked,
		queryManager,
		queryErrors
	]);
	const runtimeErrorsRef = (0, import_react.useRef)([]);
	const evaluatedResult = (0, import_react.useMemo)(() => {
		if (!result?.root && !result?.rootExpression) return result;
		const errors = [];
		const evalCtx = {
			ctx: evaluationContext,
			library,
			store,
			errors
		};
		try {
			const evaluatedRoot = evaluateRoot(result, evalCtx);
			runtimeErrorsRef.current = errors;
			return {
				...result,
				root: evaluatedRoot
			};
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			errors.push({
				source: "runtime",
				code: "runtime-error",
				message: `Prop evaluation failed: ${msg}`
			});
			runtimeErrorsRef.current = errors;
			return result;
		}
	}, [
		result,
		evaluationContext,
		library,
		store,
		storeSnapshot,
		querySnapshot
	]);
	const contextValue = (0, import_react.useMemo)(() => ({
		library,
		renderNode: renderDeep,
		triggerAction,
		isStreaming: blocked,
		getFieldValue,
		setFieldValue,
		store,
		evaluationContext,
		reportError,
		isQueryLoading
	}), [
		library,
		renderDeep,
		blocked,
		isQueryLoading,
		triggerAction,
		getFieldValue,
		setFieldValue,
		store,
		evaluationContext,
		reportError
	]);
	const { errorsRef, errorRevision } = useOpenUIErrors({
		response: bundle.program,
		isStreaming,
		result,
		evaluatedResult,
		library,
		querySnapshot,
		parseExceptionRef,
		runtimeErrorsRef,
		renderErrorsRef,
		onError
	});
	useStreamingObservability({
		response: bundle.program,
		isStreaming,
		result,
		errorsRef,
		errorRevision,
		publish: publishObservability,
		__libraryId: library.__libraryId
	});
	return {
		result: evaluatedResult,
		parseResult: result,
		contextValue,
		isQueryLoading,
		queryErrors,
		retryQueries
	};
}
/**
* Error boundary that intentionally shows the last successfully rendered
* children when a render error occurs. This "show last good state" behavior
* prevents the UI from going blank during streaming or transient evaluation
* errors, and auto-recovers when new valid children arrive.
*/
var ElementErrorBoundary = class extends import_react.Component {
	lastValidChildren = null;
	constructor(props) {
		super(props);
		this.state = { hasError: false };
	}
	static getDerivedStateFromError() {
		return { hasError: true };
	}
	componentDidMount() {
		if (!this.state.hasError) this.lastValidChildren = this.props.children;
	}
	componentDidUpdate(prevProps) {
		if (!this.state.hasError) this.lastValidChildren = this.props.children;
		if (this.state.hasError && prevProps.children !== this.props.children) this.setState({ hasError: false });
	}
	componentDidCatch(error) {
		const name = this.props.componentName ?? "Unknown";
		this.props.onError?.({
			source: "runtime",
			code: "render-error",
			component: name,
			message: `Component ${name} render failed: ${error.message}`
		});
	}
	render() {
		if (this.state.hasError) return this.lastValidChildren;
		return this.props.children;
	}
};
/**
* Recursively renders a parsed value (element, array, primitive)
* into React nodes.
*/
function renderDeep(value) {
	if (value == null) return null;
	if (typeof value === "string") return value;
	if (typeof value === "number") return String(value);
	if (typeof value === "boolean") return String(value);
	if (Array.isArray(value)) return value.map((v, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react.Fragment, { children: renderDeep(v) }, i));
	if (typeof value === "object" && value !== null) {
		const obj = value;
		if (obj.type === "element") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RenderNode, { node: obj });
	}
	return null;
}
/**
* Renders a single ElementNode.
*/
function RenderNode({ node }) {
	const { library, reportError } = useOpenUI();
	const Comp = library.components[node.typeName]?.component;
	if (!Comp) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ElementErrorBoundary, {
		componentName: node.typeName,
		onError: reportError,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RenderNodeInner, {
			el: node,
			Comp
		})
	});
}
/**
* Renders a resolved element using its renderer.
* Props are already evaluated by evaluate-tree — no AST awareness needed.
*/
function RenderNodeInner({ el, Comp }) {
	const renderNode = useRenderNode();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Comp, {
		props: el.props,
		renderNode,
		statementId: el.statementId
	});
}
var loadingStyleInjected = false;
function ensureLoadingStyle() {
	if (loadingStyleInjected || typeof document === "undefined") return;
	loadingStyleInjected = true;
	const style = document.createElement("style");
	style.textContent = `@keyframes openui-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
	document.head.appendChild(style);
}
var DefaultQueryLoader = () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
	role: "status",
	"aria-label": "Loading data",
	style: {
		position: "absolute",
		top: 8,
		right: 8,
		width: 16,
		height: 16,
		border: "2px solid #e5e7eb",
		borderTopColor: "#3b82f6",
		borderRadius: "50%",
		animation: "openui-spin 0.6s linear infinite",
		zIndex: 10
	}
});
function RendererRoot({ response, library, isStreaming = false, onAction, onStateUpdate, initialState, onParseResult, toolProvider, queryLoader, children, onError, publishObservability }) {
	(0, import_react.useInsertionEffect)(() => {
		ensureLoadingStyle();
	}, []);
	const onParseResultRef = (0, import_react.useRef)(onParseResult);
	onParseResultRef.current = onParseResult;
	const toolProviderInputRef = (0, import_react.useRef)(toolProvider);
	toolProviderInputRef.current = toolProvider;
	const stableToolProvider = (0, import_react.useRef)({ async callTool(toolName, args) {
		const current = toolProviderInputRef.current ?? null;
		if (current == null) throw new Error("[openui] toolProvider is null");
		if (typeof current.callTool === "function") return extractToolResult(await current.callTool({
			name: toolName,
			arguments: args
		}));
		const map = current;
		const fn = map[toolName];
		if (!fn) throw new ToolNotFoundError(toolName, Object.keys(map));
		return fn(args);
	} });
	const { result, parseResult, contextValue, isQueryLoading, queryErrors, retryQueries } = useOpenUIState({
		response,
		library,
		isStreaming,
		onAction,
		onStateUpdate,
		initialState,
		toolProvider: toolProvider != null ? stableToolProvider.current : null,
		onError,
		publishObservability
	}, renderDeep);
	(0, import_react.useEffect)(() => {
		onParseResultRef.current?.(parseResult);
	}, [parseResult]);
	const query = (0, import_react.useMemo)(() => ({
		isLoading: isQueryLoading,
		errors: queryErrors,
		retry: retryQueries,
		isRetrying: queryErrors.length > 0 && isQueryLoading
	}), [
		isQueryLoading,
		queryErrors,
		retryQueries
	]);
	const value = {
		root: result?.root ?? null,
		query,
		queryLoader
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OpenUIContext.Provider, {
		value: contextValue,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RendererContext.Provider, {
			value,
			children
		})
	});
}
var RendererContext = (0, import_react.createContext)(null);
function useRendererContext() {
	const context = (0, import_react.useContext)(RendererContext);
	if (!context) throw new Error("Renderer slots must be used within Renderer.Root or Renderer.");
	return context;
}
/** Access query loading, failures, and retry within the nearest Renderer root. */
function useRendererQuery() {
	return useRendererContext().query;
}
/** Displays generated content, preserving mounted components while queries load or fail. */
function RendererContent({ style, hidden, ...props }) {
	const { root, query } = useRendererContext();
	if (!root) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		...props,
		"aria-busy": query.isLoading,
		hidden: hidden || query.errors.length > 0,
		style: {
			opacity: query.isLoading ? .7 : 1,
			transition: "opacity 0.2s ease",
			...style
		},
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RenderNode, { node: root })
	});
}
/** Shows query loading feedback, except while a query failure is being displayed. */
function RendererQueryLoading({ children }) {
	const { query: { isLoading, errors }, queryLoader } = useRendererContext();
	if (!isLoading || errors.length > 0) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: children === void 0 ? queryLoader ?? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DefaultQueryLoader, {}) : children });
}
/** Shows the supplied content when queries fail; renders nothing without children. */
function RendererQueryError({ children }) {
	const { errors } = useRendererQuery();
	if (errors.length === 0) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
}
function RendererRetry({ children, onClick, disabled, ...props }) {
	const { retry, isLoading, errors } = useRendererQuery();
	const isDisabled = disabled || isLoading || errors.length === 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		...props,
		disabled: isDisabled,
		onClick: (event) => {
			if (isDisabled || event.defaultPrevented) return;
			onClick?.(event);
			if (!event.defaultPrevented) retry();
		},
		children
	});
}
function DefaultRendererContent() {
	const { root, query, queryLoader } = useRendererContext();
	if (!root) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		"aria-busy": query.isLoading,
		style: { position: "relative" },
		children: [query.isLoading && (queryLoader ?? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DefaultQueryLoader, {})), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			style: {
				opacity: query.isLoading ? .7 : 1,
				transition: "opacity 0.2s ease"
			},
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RenderNode, { node: root })
		})]
	});
}
function DefaultRenderer({ children, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RendererRoot, {
		...props,
		children: children === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DefaultRendererContent, {}) : children
	});
}
/** Render with the default presentation, or compose slots around one shared runtime. */
var Renderer = Object.assign(DefaultRenderer, {
	Root: RendererRoot,
	Content: RendererContent,
	QueryLoading: RendererQueryLoading,
	QueryError: RendererQueryError,
	Retry: RendererRetry
});
/**
* Mark a schema prop as reactive so runtime evaluation can preserve $bindings.
*
* The widened return type carries the eventual value shape into helpers like
* `useStateField()`. The actual bound value is still resolved at render time.
*/
function reactive(schema) {
	markReactive(schema);
	return schema;
}
function useStateField(name, value) {
	const ctx = useOpenUI();
	const formName = useFormName();
	return resolveStateField(name, value, ctx.store ?? null, ctx.evaluationContext ?? null, (fieldName) => ctx.getFieldValue(formName, fieldName), (fieldName, nextValue) => ctx.setFieldValue(formName, void 0, fieldName, nextValue));
}
var FormValidationContext = (0, import_react.createContext)(null);
function useFormValidation() {
	return (0, import_react.useContext)(FormValidationContext);
}
function useCreateFormValidation() {
	const [errors, setErrors] = (0, import_react.useState)({});
	const errorsRef = (0, import_react.useRef)(errors);
	errorsRef.current = errors;
	const fieldsRef = (0, import_react.useRef)({});
	const getFieldError = (0, import_react.useCallback)((name) => errorsRef.current[name], []);
	const validateField = (0, import_react.useCallback)((name, value, rules) => {
		const error = validate(value, rules);
		setErrors((prev) => {
			if (prev[name] === error) return prev;
			return {
				...prev,
				[name]: error
			};
		});
		return !error;
	}, []);
	const registerField = (0, import_react.useCallback)((name, rules, getValue) => {
		fieldsRef.current[name] = {
			rules,
			getValue
		};
	}, []);
	const unregisterField = (0, import_react.useCallback)((name) => {
		delete fieldsRef.current[name];
	}, []);
	const validateForm = (0, import_react.useCallback)(() => {
		let allValid = true;
		const newErrors = {};
		for (const [name, reg] of Object.entries(fieldsRef.current)) {
			let value = reg.getValue();
			if (value != null && typeof value === "object" && "value" in value && "componentType" in value) value = value.value;
			const error = validate(value, reg.rules);
			newErrors[name] = error;
			if (error) allValid = false;
		}
		setErrors(newErrors);
		return allValid;
	}, []);
	const clearFieldError = (0, import_react.useCallback)((name) => {
		setErrors((prev) => {
			if (prev[name] === void 0) return prev;
			return {
				...prev,
				[name]: void 0
			};
		});
	}, []);
	return (0, import_react.useMemo)(() => ({
		errors,
		getFieldError,
		validateField,
		registerField,
		unregisterField,
		validateForm,
		clearFieldError
	}), [
		errors,
		getFieldError,
		validateField,
		registerField,
		unregisterField,
		validateForm,
		clearFieldError
	]);
}
var PreviewContext = (0, import_react.createContext)(null);
function usePreviewContext() {
	const context = (0, import_react.useContext)(PreviewContext);
	if (!context) throw new Error("Preview slots must be used within WithPreviewRenderer.Root or WithPreviewRenderer.");
	return context;
}
/** Read metadata and control the nearest preview. Available even while its content is closed. */
function useRendererPreview() {
	return usePreviewContext().state;
}
function PreviewRoot({ open: controlledOpen, defaultOpen = false, onOpenChange, onMetadata, children, ...rendererProps }) {
	const [internalOpen, setInternalOpen] = (0, import_react.useState)(defaultOpen);
	const isOpen = controlledOpen ?? internalOpen;
	const isStreaming = rendererProps.isStreaming === true;
	const contentId = (0, import_react.useId)();
	const metadataName = (0, import_react.useMemo)(() => parseResponseBundle(rendererProps.response, isStreaming), [rendererProps.response, isStreaming]).metadata.name;
	const metadata = (0, import_react.useMemo)(() => metadataName === void 0 ? {} : { name: metadataName }, [metadataName]);
	const metadataCallback = (0, import_react.useRef)(onMetadata);
	metadataCallback.current = onMetadata;
	(0, import_react.useEffect)(() => {
		metadataCallback.current?.(metadata);
	}, [metadata]);
	const setOpen = (0, import_react.useCallback)((next) => {
		if (next === isOpen) return;
		if (controlledOpen === void 0) setInternalOpen(next);
		onOpenChange?.(next);
	}, [
		controlledOpen,
		isOpen,
		onOpenChange
	]);
	const open = (0, import_react.useCallback)(() => setOpen(true), [setOpen]);
	const close = (0, import_react.useCallback)(() => setOpen(false), [setOpen]);
	const state = (0, import_react.useMemo)(() => ({
		metadata,
		isOpen,
		isStreaming,
		contentId,
		open,
		close
	}), [
		metadata,
		isOpen,
		isStreaming,
		contentId,
		open,
		close
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreviewContext.Provider, {
		value: {
			state,
			rendererProps
		},
		children
	});
}
function PreviewTrigger({ children, onClick, disabled, ...props }) {
	const { metadata, isOpen, isStreaming, contentId, open, close } = useRendererPreview();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		...props,
		disabled,
		"aria-expanded": isOpen,
		"aria-controls": isOpen ? contentId : void 0,
		onClick: (event) => {
			if (disabled || event.defaultPrevented) return;
			onClick?.(event);
			if (!event.defaultPrevented) (isOpen ? close : open)();
		},
		children: children === void 0 ? `${metadata.name || "Untitled artifact"}${isStreaming ? " (generating…)" : ""}` : children
	});
}
function PreviewClose({ children, onClick, disabled, ...props }) {
	const { metadata, close } = useRendererPreview();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		...props,
		disabled,
		onClick: (event) => {
			if (disabled || event.defaultPrevented) return;
			onClick?.(event);
			if (!event.defaultPrevented) close();
		},
		children: children === void 0 ? `Close ${metadata.name || "Untitled artifact"}` : children
	});
}
/** Mount one content slot per preview. Query hooks and Renderer slots belong inside it. */
function PreviewContent({ children, style, ...props }) {
	const { state, rendererProps } = usePreviewContext();
	if (!state.isOpen) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
		"aria-label": state.metadata.name || "Untitled artifact",
		...props,
		id: state.contentId,
		style: {
			position: "relative",
			...style
		},
		children: children === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreviewClose, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Renderer, { ...rendererProps })] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Renderer, {
			...rendererProps,
			children
		})
	});
}
function DefaultWithPreviewRenderer({ children, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreviewRoot, {
		...props,
		children: children === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreviewTrigger, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreviewContent, {})] }) : children
	});
}
Object.assign(DefaultWithPreviewRenderer, {
	Root: PreviewRoot,
	Trigger: PreviewTrigger,
	Content: PreviewContent,
	Close: PreviewClose
});
//#endregion
export { FormNameContext, FormValidationContext, Renderer, createLibrary$1, defineComponent$1, reactive, useCreateFormValidation, useFormName, useFormValidation, useGetFieldValue, useIsQueryLoading, useIsStreaming, useSetFieldValue, useStateField, useTriggerAction };
