import { __toESM } from "../_runtime.mjs";
import { require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { require_jsx_runtime } from "../_libs/@openuidev/react-headless+[...].mjs";
import { ArrowDown, ArrowUp, ArrowUpRight, ChevronDown, CodeXml, CornerDownRight, Lightbulb, Search, Square, UserRound } from "../_libs/lucide-react.mjs";
import { motion } from "../_libs/motion.mjs";
import { ArraySchema, Boolean as Boolean$1, Literals, NullOr, String, Struct, acquireRelease, catch_, decodeUnknownSync, ensuring, fail, gen, mutable, optional, runPromise, scoped, sync, void_ } from "../_libs/effect.mjs";
import { ThemeProvider, clsx, openuiLibrary, safeOpenUrl } from "../_libs/@openuidev/react-ui+[...].mjs";
import { io } from "./open-source-DgxG6IN-.mjs";
import { STREAM_EASE, SpriteWalker, askIdPattern, useMediaQuery } from "./router-BKZi6fNy.mjs";
import { twMerge } from "../_libs/tailwind-merge.mjs";
import { er } from "../_libs/shadcn__react.mjs";
import { Renderer } from "../_libs/openuidev__react-lang.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ask-chat-CZOmI3zL.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
var buttonBase = "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-[color,background-color,border-color,opacity,transform,scale] duration-[180ms,180ms,180ms,180ms,120ms,120ms] ease-[ease,ease,ease,ease,cubic-bezier(.23,1,.32,1),cubic-bezier(.23,1,.32,1)] motion-reduce:transition-none outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-focus-visible:scale-[0.97] motion-reduce:active:scale-100 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";
var variants = {
	ghost: "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
	secondary: "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground"
};
var sizes = {
	"sm": "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
	"icon-sm": "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg"
};
function Button({ className, variant = "ghost", size = "sm", ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		"data-slot": "button",
		"data-variant": variant,
		"data-size": size,
		className: cn(buttonBase, variants[variant], sizes[size], className),
		...props
	});
}
var theme = {
	fontBody: "var(--font-sans)",
	fontHeading: "var(--font-sans)",
	fontLabel: "var(--font-sans)",
	textBodyDefault: "400 13px/1.65 var(--font-sans)",
	textBodySm: "400 13px/1.65 var(--font-sans)",
	textHeadingSm: "610 14px/1.45 var(--font-sans)",
	textHeadingMd: "610 14px/1.45 var(--font-sans)"
};
var AskAnswer = (0, import_react.memo)(function AskAnswer({ source, isStreaming, onContinue }) {
	const [invalid, setInvalid] = (0, import_react.useState)(false);
	const [hasRoot, setHasRoot] = (0, import_react.useState)(true);
	const onError = (0, import_react.useCallback)((errors) => setInvalid(errors.length > 0), []);
	const onParseResult = (0, import_react.useCallback)((result) => setHasRoot(Boolean(result?.root)), []);
	const onAction = (event) => {
		if (isStreaming) return;
		if (event.type === "open_url" && typeof event.params.url === "string") safeOpenUrl(event.params.url);
		if (event.type === "continue_conversation") {
			const question = event.humanFriendlyMessage.trim();
			if (question.length >= 2 && question.length <= 1e3) onContinue?.(question);
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "ask-openui",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ThemeProvider, {
			cssSelector: ".ask-openui",
			lightTheme: theme,
			mode: "light",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Renderer, {
				isStreaming,
				library: openuiLibrary,
				onAction,
				onError,
				onParseResult,
				publishObservability: false,
				response: source
			})
		}), !isStreaming && (invalid || !hasRoot) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			role: "alert",
			children: "回答未能完整显示，请重新提问。"
		}) : null]
	});
});
var ask_chat_module_default = {
	root: "_root_cpnwn_1",
	welcomeHeader: "_welcomeHeader_cpnwn_12",
	welcomeWalker: "_welcomeWalker_cpnwn_25",
	welcomeRise: "_welcomeRise_cpnwn_32",
	"assistant-rise": "_assistant-rise_cpnwn_1",
	scroller: "_scroller_cpnwn_45",
	viewport: "_viewport_cpnwn_55",
	messages: "_messages_cpnwn_86",
	emptyItem: "_emptyItem_cpnwn_93",
	empty: "_empty_cpnwn_93",
	emptyContent: "_emptyContent_cpnwn_112",
	suggestions: "_suggestions_cpnwn_120",
	followups: "_followups_cpnwn_137",
	message: "_message_cpnwn_86",
	messageContent: "_messageContent_cpnwn_152",
	messageItem: "_messageItem_cpnwn_164",
	bubbleFrame: "_bubbleFrame_cpnwn_171",
	bubbleContent: "_bubbleContent_cpnwn_187",
	userBubble: "_userBubble_cpnwn_208",
	assistantBubble: "_assistantBubble_cpnwn_212",
	status: "_status_cpnwn_216",
	statusIcon: "_statusIcon_cpnwn_229",
	statusContent: "_statusContent_cpnwn_238",
	scrollToLatest: "_scrollToLatest_cpnwn_243",
	sources: "_sources_cpnwn_256",
	sourcesSummary: "_sourcesSummary_cpnwn_266",
	citations: "_citations_cpnwn_299",
	citation: "_citation_cpnwn_299",
	interruption: "_interruption_cpnwn_365",
	form: "_form_cpnwn_456",
	drawerComposer: "_drawerComposer_cpnwn_462",
	drawerInput: "_drawerInput_cpnwn_473",
	drawerActions: "_drawerActions_cpnwn_494",
	drawerSend: "_drawerSend_cpnwn_499"
};
var MotionMessageScrollerItem = motion.create(er.Item);
var MotionSearch = motion.create(Search);
var MESSAGE_ENTER_DURATION = .24;
var AskMessageItem = (0, import_react.memo)(function AskMessageItem({ isStreamingPlaceholder, message, onContinue, onRetry, prefersReducedMotion }) {
	const isUser = message.role === "user";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MotionMessageScrollerItem, {
		animate: {
			opacity: 1,
			y: "0rem"
		},
		className: ask_chat_module_default.messageItem,
		"data-slot": "message-scroller-item",
		initial: prefersReducedMotion ? false : {
			opacity: 0,
			y: "0.4rem"
		},
		messageId: message.id,
		scrollAnchor: isUser,
		transition: {
			duration: MESSAGE_ENTER_DURATION,
			ease: STREAM_EASE
		},
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: `group/message ${ask_chat_module_default.message}`,
			"data-align": isUser ? "end" : "start",
			"data-slot": "message",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: ask_chat_module_default.messageContent,
				"data-slot": "message-content",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "sr-only",
						"data-slot": "message-header",
						children: isUser ? "你" : "归档助手"
					}),
					message.content ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: ask_chat_module_default.bubbleFrame,
						"data-align": isUser ? "end" : "start",
						"data-slot": "bubble",
						"data-variant": isUser ? "default" : "ghost",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							"aria-live": isUser ? void 0 : "polite",
							className: `${ask_chat_module_default.bubbleContent} ${isUser ? ask_chat_module_default.userBubble : ask_chat_module_default.assistantBubble}`,
							"data-slot": "bubble-content",
							children: !isUser ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AskAnswer, {
								isStreaming: !message.isComplete,
								onContinue,
								source: message.content
							}) : message.content
						})
					}) : isStreamingPlaceholder ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: ask_chat_module_default.status,
						"data-slot": "marker",
						role: "status",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							"aria-hidden": "true",
							className: ask_chat_module_default.statusIcon,
							"data-slot": "marker-icon",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MotionSearch, {
								animate: prefersReducedMotion ? { opacity: 1 } : { opacity: [
									1,
									.3,
									1
								] },
								initial: false,
								transition: prefersReducedMotion ? { duration: 0 } : {
									duration: 1.15,
									ease: "easeInOut",
									repeat: Infinity
								}
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: ask_chat_module_default.statusContent,
							"data-slot": "marker-content",
							children: "正在查找资料并整理回答…"
						})]
					}) : null,
					message.interruption ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: ask_chat_module_default.interruption,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							role: message.interruption.kind === "error" ? "alert" : "status",
							children: message.interruption.message
						}), message.interruption.kind === "error" && onRetry ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							onClick: onRetry,
							size: "sm",
							type: "button",
							variant: "ghost",
							children: "重新提问"
						}) : null]
					}) : null,
					message.role === "assistant" && message.isComplete && message.citations.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
						className: ask_chat_module_default.sources,
						"data-slot": "message-footer",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("summary", {
							className: ask_chat_module_default.sourcesSummary,
							onClick: (event) => {
								const details = event.currentTarget.parentElement;
								if (!(details instanceof HTMLElement)) return;
								if (event.detail === 0) details.dataset.instant = "";
								else delete details.dataset.instant;
							},
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
								"参考资料 · ",
								message.citations.length,
								" 篇"
							] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { "aria-hidden": "true" })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
							"aria-label": "回答来源",
							className: ask_chat_module_default.citations,
							children: message.citations.map((source, sourceIndex) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
								className: ask_chat_module_default.citation,
								href: source.sourceUrl,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
									"【",
									sourceIndex + 1,
									"】",
									source.title,
									source.section ? ` · ${source.section}` : ""
								] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUpRight, { "aria-hidden": "true" })]
							}) }, source.id))
						})]
					}) : null
				]
			})
		})
	});
});
var sourceSchema = Struct({
	content: String,
	id: String,
	publishedAt: NullOr(String),
	scope: Literals([
		"profile",
		"ai-news",
		"daily",
		"open-source"
	]),
	section: NullOr(String),
	sourceId: String,
	sourceUrl: String,
	title: String
});
var messageSchema = Struct({
	citations: ArraySchema(sourceSchema).pipe(mutable),
	content: String,
	id: String,
	isComplete: Boolean$1,
	role: Literals(["assistant", "user"]),
	interruption: optional(Struct({
		kind: Literals(["stopped", "error"]),
		message: String
	}))
});
var snapshotSchema = Struct({
	messages: ArraySchema(messageSchema).pipe(mutable),
	question: optional(String)
});
var ASK_CHAT_STORAGE_KEY = "personal-site:ask-chat";
var ASK_CHAT_DRAFT_STORAGE_KEY = "personal-site:ask-chat-draft";
function readDraft() {
	try {
		return window.sessionStorage.getItem(ASK_CHAT_DRAFT_STORAGE_KEY);
	} catch {
		return null;
	}
}
function writeAskChatDraft(question) {
	try {
		window.sessionStorage.setItem(ASK_CHAT_DRAFT_STORAGE_KEY, question);
	} catch {}
}
function readAskChatSnapshot() {
	const draft = readDraft();
	let messages = [];
	let legacyQuestion = null;
	try {
		const raw = window.sessionStorage.getItem(ASK_CHAT_STORAGE_KEY);
		if (raw) {
			const stored = JSON.parse(raw);
			const snapshot = decodeUnknownSync(snapshotSchema)(stored);
			messages = stored.format !== "openui" ? snapshot.messages.map((message) => message.role === "assistant" && message.content ? {
				...message,
				content: `root = Stack([TextContent(${JSON.stringify(message.content)})])`
			} : message) : snapshot.messages;
			legacyQuestion = snapshot.question ?? null;
		}
	} catch {}
	if (draft !== null) return {
		messages,
		question: draft
	};
	if (legacyQuestion === null) return {
		messages,
		question: ""
	};
	writeAskChatDraft(legacyQuestion);
	return {
		messages,
		question: legacyQuestion
	};
}
function writeAskChatMessages(messages) {
	try {
		if (window.sessionStorage.getItem("personal-site:ask-chat-draft") === null) {
			const raw = window.sessionStorage.getItem(ASK_CHAT_STORAGE_KEY);
			const legacy = raw ? JSON.parse(raw) : null;
			if (typeof legacy?.question === "string") window.sessionStorage.setItem(ASK_CHAT_DRAFT_STORAGE_KEY, legacy.question);
		}
		window.sessionStorage.setItem(ASK_CHAT_STORAGE_KEY, JSON.stringify({
			format: "openui",
			messages: messages.map((message) => message.isComplete ? message : {
				...message,
				isComplete: true,
				interruption: {
					kind: "stopped",
					message: "已停止生成。"
				}
			})
		}));
	} catch {}
}
/** 把 SSE 文本缓冲切分为完整事件，返回剩余的不完整尾巴留待下个数据块。 */
function parseEvents(buffer) {
	const chunks = buffer.split("\n\n");
	const remainder = chunks.pop() ?? "";
	return {
		events: chunks.flatMap((chunk) => {
			const event = /^event:\s*(.+)$/m.exec(chunk)?.[1];
			const data = /^data:\s*(.+)$/m.exec(chunk)?.[1];
			if (!event || !data) return [];
			try {
				return [{
					data: JSON.parse(data),
					event
				}];
			} catch {
				return [];
			}
		}),
		remainder
	};
}
function applyStreamEvent(message, event) {
	switch (event.event) {
		case "done": return {
			...message,
			isComplete: true
		};
		case "error": return {
			...message,
			interruption: {
				kind: "error",
				message: typeof event.data.message === "string" ? event.data.message : "回答暂时不可用，请稍后重试。"
			},
			isComplete: true
		};
		case "sources": return Array.isArray(event.data.sources) ? {
			...message,
			citations: event.data.sources
		} : message;
		case "text": return typeof event.data.delta === "string" ? {
			...message,
			content: `${message.content}${event.data.delta}`
		} : message;
		default: return message;
	}
}
function readOrCreateId(storageName, key) {
	const id = crypto.randomUUID();
	try {
		const storage = window[storageName];
		const stored = storage.getItem(key);
		if (stored && askIdPattern.test(stored)) return stored;
		storage.setItem(key, id);
	} catch {}
	return id;
}
function useAskConversation(onStarted) {
	const [messages, setMessages] = (0, import_react.useState)([]);
	const [question, setQuestion] = (0, import_react.useState)("");
	const [restored, setRestored] = (0, import_react.useState)(false);
	const [isStreaming, setIsStreaming] = (0, import_react.useState)(false);
	const requestController = (0, import_react.useRef)(null);
	const submitInFlight = (0, import_react.useRef)(false);
	const snapshotRead = (0, import_react.useRef)(false);
	const session = (0, import_react.useRef)(null);
	(0, import_react.useLayoutEffect)(() => {
		if (snapshotRead.current) return;
		snapshotRead.current = true;
		const snapshot = readAskChatSnapshot();
		setMessages(snapshot.messages);
		setQuestion(snapshot.question);
		setRestored(true);
	}, []);
	(0, import_react.useEffect)(() => {
		if (restored) writeAskChatMessages(messages);
	}, [messages, restored]);
	(0, import_react.useEffect)(() => {
		if (restored) writeAskChatDraft(question);
	}, [question, restored]);
	(0, import_react.useEffect)(() => () => requestController.current?.abort(), []);
	const updateAssistant = (0, import_react.useCallback)((id, update) => {
		setMessages((current) => current.map((message) => message.id === id ? update(message) : message));
	}, []);
	const submitQuestion = (0, import_react.useCallback)(async (rawQuestion, { preserveDraft = false } = {}) => {
		const trimmedQuestion = rawQuestion.trim();
		if (!trimmedQuestion || submitInFlight.current) return;
		submitInFlight.current = true;
		session.current ??= {
			conversationId: readOrCreateId("sessionStorage", "personal-site:ask-conversation-id"),
			visitorId: readOrCreateId("localStorage", "personal-site:ask-visitor-id")
		};
		const identity = session.current;
		const userId = crypto.randomUUID();
		const assistantId = crypto.randomUUID();
		onStarted();
		if (!preserveDraft) setQuestion("");
		setIsStreaming(true);
		const controller = new AbortController();
		requestController.current = controller;
		setMessages((current) => [
			...current,
			{
				citations: [],
				content: trimmedQuestion,
				id: userId,
				isComplete: true,
				role: "user"
			},
			{
				citations: [],
				content: "",
				id: assistantId,
				isComplete: false,
				role: "assistant"
			}
		]);
		try {
			await runPromise(scoped(gen(function* () {
				const response = yield* io("ask.request", (signal) => fetch("/api/ask", {
					body: JSON.stringify({
						conversationId: identity.conversationId,
						format: "openui",
						question: trimmedQuestion,
						scope: "all",
						visitorId: identity.visitorId
					}),
					headers: { "Content-Type": "application/json" },
					method: "POST",
					signal: AbortSignal.any([signal, controller.signal])
				}));
				if (!response.ok || !response.body) {
					const payload = yield* io("ask.error", () => response.json().catch(() => null));
					return yield* fail(new Error(typeof payload?.error === "string" ? payload.error : "回答暂时不可用，请稍后重试。"));
				}
				const reader = yield* acquireRelease(sync(() => response.body.getReader()), (reader) => io("ask.cancel", () => reader.cancel()).pipe(catch_(() => void_), ensuring(sync(() => reader.releaseLock()))));
				const decoder = new TextDecoder();
				let buffer = "";
				while (true) {
					const { done, value } = yield* io("ask.read", () => reader.read());
					buffer += decoder.decode(value ?? /* @__PURE__ */ new Uint8Array(), { stream: !done });
					const parsed = parseEvents(buffer);
					buffer = parsed.remainder;
					for (const item of parsed.events) updateAssistant(assistantId, (message) => applyStreamEvent(message, item));
					if (done) break;
				}
				updateAssistant(assistantId, (message) => ({
					...message,
					isComplete: true
				}));
			})), { signal: controller.signal });
		} catch (error) {
			const stopped = controller.signal.aborted;
			const message = stopped ? "已停止生成。" : error instanceof Error ? error.message : "回答暂时不可用，请稍后重试。";
			updateAssistant(assistantId, (current) => ({
				...current,
				interruption: {
					kind: stopped ? "stopped" : "error",
					message
				},
				isComplete: true
			}));
		} finally {
			submitInFlight.current = false;
			requestController.current = null;
			setIsStreaming(false);
		}
	}, [onStarted, updateAssistant]);
	const submit = (suggestion, options) => {
		return submitQuestion(suggestion ?? question, options);
	};
	return {
		isStreaming,
		messages,
		question,
		setQuestion,
		stop: () => requestController.current?.abort(),
		submit,
		submitQuestion
	};
}
var EMPTY_ENTER_DURATION = .32;
var suggestedQuestions = [
	"你的工程经历和目前关注的方向是什么？",
	"最近有哪些关于 Agent 长期运行的实践？",
	"哪些开源项目值得持续关注？",
	"最近的每日关注里提到了什么检索思路？"
];
var suggestionIcons = [
	UserRound,
	Lightbulb,
	CodeXml
];
function AssistantWelcome() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: ask_chat_module_default.welcomeHeader,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: ask_chat_module_default.welcomeWalker,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: ask_chat_module_default.welcomeRise,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SpriteWalker, {})
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "我是陈远的 AI 助手，想了解什么？" })]
	});
}
function AskChat() {
	const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
	const shouldFollowLatest = (0, import_react.useRef)(true);
	const isProgrammaticScroll = (0, import_react.useRef)(false);
	const textareaRef = (0, import_react.useRef)(null);
	const viewportRef = (0, import_react.useRef)(null);
	const { isStreaming, messages, question, setQuestion, stop, submit, submitQuestion } = useAskConversation((0, import_react.useCallback)(() => {
		shouldFollowLatest.current = true;
	}, []));
	const handleContinue = (0, import_react.useCallback)((nextQuestion) => {
		submitQuestion(nextQuestion, { preserveDraft: true });
	}, [submitQuestion]);
	const retryByMessageId = (0, import_react.useMemo)(() => {
		const retries = /* @__PURE__ */ new Map();
		messages.forEach((message, index) => {
			const previous = messages[index - 1];
			if (message.interruption?.kind !== "error" || previous?.role !== "user") return;
			retries.set(message.id, () => handleContinue(previous.content));
		});
		return retries;
	}, [messages, handleContinue]);
	(0, import_react.useEffect)(() => {
		const textarea = textareaRef.current;
		if (!textarea) return;
		const resize = () => {
			const minHeight = 22;
			const maxHeight = 112;
			textarea.style.height = "0px";
			const nextHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
			textarea.style.height = `${nextHeight}px`;
			textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
		};
		resize();
		let width = textarea.clientWidth;
		let resizeFrame = 0;
		const observer = new ResizeObserver(() => {
			if (textarea.clientWidth === width) return;
			width = textarea.clientWidth;
			window.cancelAnimationFrame(resizeFrame);
			resizeFrame = window.requestAnimationFrame(resize);
		});
		observer.observe(textarea);
		return () => {
			observer.disconnect();
			window.cancelAnimationFrame(resizeFrame);
		};
	}, [question]);
	(0, import_react.useEffect)(() => {
		const delay = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 450;
		const timer = setTimeout(() => textareaRef.current?.focus({ preventScroll: true }), delay);
		return () => clearTimeout(timer);
	}, []);
	const scrollToLatest = (0, import_react.useCallback)(() => {
		const viewport = viewportRef.current;
		if (!viewport || !shouldFollowLatest.current) return;
		isProgrammaticScroll.current = true;
		viewport.scrollTop = viewport.scrollHeight;
		window.requestAnimationFrame(() => {
			isProgrammaticScroll.current = false;
		});
	}, []);
	(0, import_react.useEffect)(() => {
		if (!shouldFollowLatest.current) return;
		const frame = window.requestAnimationFrame(scrollToLatest);
		return () => window.cancelAnimationFrame(frame);
	}, [messages, scrollToLatest]);
	const canSubmit = Boolean(question.trim() && !isStreaming);
	const lastMessage = messages[messages.length - 1];
	const followUpQuestions = suggestedQuestions.filter((item) => !messages.some((message) => message.role === "user" && message.content === item));
	const showFollowUps = !isStreaming && lastMessage?.role === "assistant" && lastMessage.isComplete && !lastMessage.interruption && Boolean(lastMessage.content) && followUpQuestions.length > 0;
	const inputProps = {
		"aria-label": "输入问题",
		onChange: (event) => setQuestion(event.target.value),
		onKeyDown: (event) => {
			if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) {
				event.preventDefault();
				submit();
			}
		},
		placeholder: "想问些什么…",
		ref: textareaRef,
		rows: 1,
		value: question
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		"aria-label": "问一问",
		className: ask_chat_module_default.root,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(er.Provider, {
			autoScroll: false,
			defaultScrollPosition: "end",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(er.Root, {
				className: ask_chat_module_default.scroller,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(er.Viewport, {
					"aria-label": "问答记录",
					className: ask_chat_module_default.viewport,
					"data-slot": "message-scroller-viewport",
					onKeyDown: (event) => {
						if ([
							"ArrowUp",
							"Home",
							"PageUp",
							" "
						].includes(event.key)) shouldFollowLatest.current = false;
					},
					onScroll: (event) => {
						if (isProgrammaticScroll.current) return;
						const viewport = event.currentTarget;
						shouldFollowLatest.current = viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop <= 24;
					},
					onTouchMove: () => {
						shouldFollowLatest.current = false;
					},
					onWheel: (event) => {
						if (event.deltaY < 0) shouldFollowLatest.current = false;
					},
					ref: viewportRef,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(er.Content, {
						"aria-busy": isStreaming,
						className: ask_chat_module_default.messages,
						children: [
							messages.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MotionMessageScrollerItem, {
								animate: { y: "0rem" },
								className: ask_chat_module_default.emptyItem,
								initial: prefersReducedMotion ? false : { y: "0.4rem" },
								messageId: "ask-empty-state",
								transition: {
									duration: EMPTY_ENTER_DURATION,
									ease: STREAM_EASE
								},
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: ask_chat_module_default.empty,
									"data-slot": "empty",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AssistantWelcome, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: `${ask_chat_module_default.emptyContent} ${ask_chat_module_default.suggestions}`,
										"data-slot": "empty-content",
										children: suggestedQuestions.slice(0, 3).map((suggestion, suggestionIndex) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(motion.span, {
											animate: { y: 0 },
											initial: prefersReducedMotion ? false : { y: "0.3rem" },
											transition: {
												delay: prefersReducedMotion ? 0 : .15 + suggestionIndex * .05,
												duration: .24,
												ease: STREAM_EASE
											},
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
												onClick: () => void submit(suggestion),
												size: "sm",
												type: "button",
												variant: "ghost",
												children: [(() => {
													const Icon = suggestionIcons[suggestionIndex];
													return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
														"aria-hidden": "true",
														"data-icon": "inline-start"
													});
												})(), suggestion]
											})
										}, suggestion))
									})]
								})
							}) : null,
							messages.map((message, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AskMessageItem, {
								isStreamingPlaceholder: isStreaming && index === messages.length - 1,
								message,
								onContinue: isStreaming ? void 0 : handleContinue,
								onRetry: message.interruption?.kind === "error" && !isStreaming ? retryByMessageId.get(message.id) : void 0,
								prefersReducedMotion
							}, message.id)),
							showFollowUps ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(motion.div, {
								animate: {
									opacity: 1,
									y: 0
								},
								className: ask_chat_module_default.followups,
								initial: prefersReducedMotion ? false : {
									opacity: 0,
									y: "0.3rem"
								},
								transition: {
									duration: .24,
									ease: STREAM_EASE
								},
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: ask_chat_module_default.suggestions,
									children: followUpQuestions.slice(0, 1).map((suggestion) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
										onClick: () => void submit(suggestion),
										size: "sm",
										type: "button",
										variant: "ghost",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CornerDownRight, {
											"aria-hidden": "true",
											"data-icon": "inline-start"
										}), suggestion]
									}, suggestion))
								})
							}) : null
						]
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(er.Button, {
					"aria-label": "回到最新消息",
					behavior: prefersReducedMotion ? "auto" : "smooth",
					className: ask_chat_module_default.scrollToLatest,
					"data-slot": "message-scroller-button",
					direction: "end",
					onClick: () => {
						shouldFollowLatest.current = true;
						window.requestAnimationFrame(scrollToLatest);
					},
					render: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "icon-sm",
						variant: "secondary"
					}),
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowDown, { "aria-hidden": "true" })
				})]
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("form", {
			className: ask_chat_module_default.form,
			onSubmit: (event) => {
				event.preventDefault();
				submit();
			},
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: ask_chat_module_default.drawerComposer,
				"data-ask-composer": true,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
					...inputProps,
					className: ask_chat_module_default.drawerInput
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: ask_chat_module_default.drawerActions,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						"aria-label": isStreaming ? "停止生成" : "发送问题",
						className: ask_chat_module_default.drawerSend,
						disabled: !isStreaming && !canSubmit,
						onClick: isStreaming ? stop : void 0,
						type: isStreaming ? "button" : "submit",
						children: isStreaming ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Square, {
							"aria-hidden": "true",
							size: 13,
							fill: "currentColor"
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUp, {
							"aria-hidden": "true",
							size: 15,
							strokeWidth: 3
						})
					})
				})]
			})
		})]
	});
}
//#endregion
export { AskChat };
