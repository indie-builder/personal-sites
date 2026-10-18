import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import { attempt, OperationError } from "@site/effect";
import { errorMessage, externalUrl, responseError, SITE_ORIGIN } from "./platform";
import { SseParser, Utf8Decoder, type SseFrame } from "./sse";

export type AskScope = "all" | "profile" | "ai-news" | "daily" | "open-source";
export const scopes: { id: AskScope; label: string }[] = [
  { id: "all", label: "全部资料" }, { id: "profile", label: "个人资料" },
  { id: "ai-news", label: "每日动态" }, { id: "daily", label: "每日关注" }, { id: "open-source", label: "开源内容" },
];
export type AskSource = {
  id: string; title: string; content: string; sourceUrl: string; scope: string;
  publishedAt?: string | null; section?: string | null; sourceId?: string;
};
export type AskMessage = {
  id: string; role: "question" | "answer"; text: string; sources: AskSource[];
  status: "streaming" | "complete" | "stopped" | "error"; scope: AskScope;
};
export type AskState = { draft: string; scope: AskScope; messages: AskMessage[]; streaming: boolean; error: string };
export type AskEvent = { type: "text"; delta: string } | { type: "sources"; sources: AskSource[] } | { type: "done" };

const Source = Schema.Struct({
  id: Schema.String, title: Schema.String, content: Schema.String, sourceUrl: Schema.String, scope: Schema.String,
  publishedAt: Schema.optionalKey(Schema.NullOr(Schema.String)), section: Schema.optionalKey(Schema.NullOr(Schema.String)), sourceId: Schema.optionalKey(Schema.String),
});
const TextData = Schema.Struct({ delta: Schema.String });
const SourcesData = Schema.Struct({ sources: Schema.Array(Source) });
const ErrorData = Schema.Struct({ message: Schema.String });
const DoneData = Schema.Struct({});
const malformed = () => new Error("引用或回答数据格式异常，请重试。");

export function parseAskFrame(frame: SseFrame): AskEvent | undefined {
  if (!["text", "sources", "done", "error"].includes(frame.event)) return undefined;
  let body: unknown;
  try { body = JSON.parse(frame.data); } catch { throw malformed(); }
  if (frame.event === "text") {
    const parsed = Schema.decodeUnknownResult(TextData)(body);
    if (Result.isFailure(parsed)) throw malformed();
    return { type: "text", delta: parsed.success.delta };
  }
  if (frame.event === "sources") {
    const parsed = Schema.decodeUnknownResult(SourcesData)(body);
    if (Result.isFailure(parsed)) throw malformed();
    return { type: "sources", sources: parsed.success.sources.map((source) => ({ ...source, sourceUrl: externalUrl(source.sourceUrl) })) };
  }
  if (frame.event === "error") {
    const parsed = Schema.decodeUnknownResult(ErrorData)(body);
    if (Result.isFailure(parsed)) throw malformed();
    throw new Error(parsed.success.message.trim() || "暂时无法回答，请稍后再试。");
  }
  const parsed = Schema.decodeUnknownResult(DoneData)(body);
  if (Result.isFailure(parsed)) throw malformed();
  return { type: "done" };
}

const identifier = /^[A-Za-z0-9_-]{16,128}$/;
const visitorKey = "chenyuan.ask.visitor.v1";
// These are non-authentication session identifiers; old clients without crypto use independent random bytes.
function fallbackId(): string {
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}
const newId = Effect.fn("Ask.identifier")(function* () {
  return yield* Effect.callback<string>((resume) => {
    if (typeof wx.getRandomValues !== "function") { resume(Effect.succeed(fallbackId())); return; }
    try {
      wx.getRandomValues({
        length: 16,
        success: ({ randomValues }) => {
          const bytes = new Uint8Array(randomValues);
          resume(Effect.succeed(bytes.length === 16 ? Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("") : fallbackId()));
        },
        fail: () => resume(Effect.succeed(fallbackId())),
      });
    } catch { resume(Effect.succeed(fallbackId())); }
  });
});

const visitorIdentifier = Effect.fn("Ask.visitor")(function* (isCurrent: () => boolean) {
  const stored: unknown = yield* attempt("ask.storage.read", () => wx.getStorageSync(visitorKey));
  if (typeof stored === "string" && identifier.test(stored)) return stored;
  const id = yield* newId();
  if (isCurrent()) yield* attempt("ask.storage.write", () => wx.setStorageSync(visitorKey, id));
  return id;
});

type AskPayload = { question: string; scope: AskScope; visitorId: string; conversationId: string; format: "text" };

const streamAnswer = (payload: AskPayload, onEvent: (event: AskEvent) => void, registerCancel: (cancel: () => void) => void): Effect.Effect<void, OperationError> =>
  Effect.callback<void, OperationError>((resume) => {
    let task: WechatMiniprogram.RequestTask | undefined;
    let active = true;
    let status = 0;
    let received = false;
    let protocol: "unknown" | "sse" | "json" = "unknown";
    let body = "";
    const decoder = new Utf8Decoder();
    const detach = () => {
      task?.offChunkReceived(chunk);
      task?.offHeadersReceived(headers);
    };
    const fail = (cause: unknown) => {
      if (!active) return;
      active = false;
      detach();
      task?.abort();
      resume(Effect.fail(new OperationError("ask.stream", cause)));
    };
    const parser = new SseParser((frame) => {
      if (!active) return;
      const event = parseAskFrame(frame);
      if (!event) return;
      onEvent(event);
      if (event.type === "done") {
        active = false;
        detach();
        task?.abort();
        resume(Effect.void);
      }
    });
    const consume = (text: string) => {
      if (!active) return;
      if (status && (status < 200 || status >= 300)) {
        body = (body + text).slice(0, 65_536);
        return;
      }
      if (protocol === "unknown") {
        body += text;
        const first = body.trimStart()[0];
        if (!first) return;
        protocol = first === "{" || first === "[" ? "json" : "sse";
        if (protocol === "sse") { const buffered = body; body = ""; parser.push(buffered); }
      } else if (protocol === "json") body = (body + text).slice(0, 65_536);
      else parser.push(text);
    };
    const chunk = ({ data }: { data: ArrayBuffer }) => {
      if (!active) return;
      received = true;
      try { consume(decoder.decode(new Uint8Array(data))); } catch (cause) { fail(cause); }
    };
    const headers: WechatMiniprogram.RequestTaskOnHeadersReceivedCallback = (response) => { status = response.statusCode || 0; };
    const cancel = () => {
      if (!active) return;
      active = false;
      detach();
      task?.abort();
      resume(Effect.interrupt);
    };
    try {
      task = wx.request({
        url: `${SITE_ORIGIN}/api/ask`, method: "POST", timeout: 120_000,
        header: { Accept: "text/event-stream", "Content-Type": "application/json; charset=utf-8" },
        data: payload, enableChunked: true, dataType: "text", responseType: "arraybuffer",
        success: (response) => {
          if (!active) return;
          status = response.statusCode;
          if (status < 200 || status >= 300) {
            const errorBody = response.data instanceof ArrayBuffer && response.data.byteLength === 0 || response.data === "" ? body : response.data;
            fail(new Error(responseError(status, errorBody, true)));
            return;
          }
          try {
            if (!received) {
              if (typeof response.data === "string") consume(response.data);
              else if (response.data instanceof ArrayBuffer) consume(decoder.decode(new Uint8Array(response.data)));
              else { fail(new Error("回答数据格式异常，请重试。")); return; }
            }
            consume(decoder.decode(undefined, true));
            if (!active) return;
            if (protocol === "json") { fail(new Error(responseError(status, body, true))); return; }
            parser.finish();
            if (active) fail(new Error("连接提前结束了，请重试。"));
          } catch (cause) { fail(cause); }
        },
        fail: (error) => fail(new Error(error.errMsg.includes("timeout") ? "回答超时了，请稍后再试。" : "网络不可用，请检查连接后重试。")),
      });
      task.onHeadersReceived(headers);
      task.onChunkReceived(chunk);
      registerCancel(cancel);
    } catch { fail(new Error("网络请求无法启动，请重试。")); }
    return Effect.sync(cancel);
  });

export function createAsk(onChange: (state: AskState) => void) {
  let state: AskState = { draft: "", scope: "all", messages: [], streaming: false, error: "" };
  let conversationId = "";
  let visitorId = "";
  let generation = 0;
  let messageId = 0;
  let cancelRequest: (() => void) | undefined;
  const patch = (changes: Partial<AskState>) => { state = { ...state, ...changes }; onChange(state); };
  const finish = (status: AskMessage["status"], error = "") => {
    patch({ streaming: false, error, messages: state.messages.map((message) => message.status === "streaming" ? { ...message, status } : message) });
  };
  const stop = () => {
    generation++;
    const cancel = cancelRequest;
    cancelRequest = undefined;
    if (state.streaming) finish("stopped");
    cancel?.();
  };
  const send = Effect.fn("Ask.send")(function* (question = state.draft, scope = state.scope) {
    if (state.streaming) return;
    const trimmed = question.trim();
    if (trimmed.length < 2 || trimmed.length > 1000 || !scopes.some((item) => item.id === scope)) {
      patch({ error: "请输入 2–1000 字的问题，并选择资料范围。" });
      return;
    }
    const token = ++generation;
    const answerId = String(++messageId);
    patch({ draft: "", streaming: true, error: "", messages: [...state.messages,
      { id: String(++messageId), role: "question", text: trimmed, sources: [], status: "complete", scope },
      { id: answerId, role: "answer", text: "", sources: [], status: "streaming", scope },
    ] });
    yield* Effect.gen(function* () {
      const visitor = visitorId || (yield* visitorIdentifier(() => token === generation));
      if (token !== generation) return;
      visitorId = visitor;
      const conversation = conversationId || (yield* newId());
      if (token !== generation) return;
      conversationId = conversation;
      yield* streamAnswer({ question: trimmed, scope, visitorId: visitor, conversationId: conversation, format: "text" }, (event) => {
        if (token !== generation) return;
        patch({ messages: state.messages.map((message) => {
          if (message.id !== answerId) return message;
          if (event.type === "text") return { ...message, text: message.text + event.delta };
          if (event.type === "sources") return { ...message, sources: event.sources };
          return { ...message, text: message.text || "（这次没有可回答的内容，换个问法试试。）", status: "complete" };
        }) });
      }, (cancel) => { cancelRequest = cancel; });
      if (token === generation) finish("complete");
    }).pipe(
      Effect.catch((error) => Effect.sync(() => {
        if (token === generation) finish("error", error instanceof OperationError && error.operation.startsWith("ask.storage") ? "本地会话无法保存，请检查存储权限后重试。" : errorMessage(error));
      })),
      Effect.ensuring(Effect.sync(() => {
        if (token === generation) { cancelRequest = undefined; if (state.streaming) finish("stopped"); }
      })),
    );
  });
  return {
    get state() { return state; },
    setDraft(text: string) { patch({ draft: text }); },
    setScope(scope: AskScope) { if (scopes.some((item) => item.id === scope)) patch({ scope }); },
    send,
    retry: Effect.fn("Ask.retry")(function* () {
      if (state.streaming || state.messages.length < 2) return;
      const question = state.messages[state.messages.length - 2];
      if (question?.role !== "question" || state.messages[state.messages.length - 1]?.role !== "answer") return;
      patch({ messages: state.messages.slice(0, -2) });
      yield* send(question.text, question.scope);
    }),
    stop,
    reset() { stop(); conversationId = ""; patch({ draft: "", scope: "all", messages: [], streaming: false, error: "" }); },
  };
}
