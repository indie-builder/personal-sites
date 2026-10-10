import { Schema } from "effect";

import type { AskSource } from "@/lib/ask-types";

const sourceSchema: Schema.Codec<AskSource> = Schema.Struct({
  content: Schema.String,
  id: Schema.String,
  publishedAt: Schema.NullOr(Schema.String),
  scope: Schema.Literals(["profile", "ai-news", "daily", "open-source"]),
  section: Schema.NullOr(Schema.String),
  sourceId: Schema.String,
  sourceUrl: Schema.String,
  title: Schema.String,
});

const messageSchema = Schema.Struct({
  citations: Schema.Array(sourceSchema).pipe(Schema.mutable),
  content: Schema.String,
  id: Schema.String,
  isComplete: Schema.Boolean,
  role: Schema.Literals(["assistant", "user"]),
  interruption: Schema.optional(Schema.Struct({ kind: Schema.Literals(["stopped", "error"]), message: Schema.String })),
});

export type ChatMessage = typeof messageSchema.Type;

// 旧合并快照把草稿内联在 question 字段里；新写入只存 messages，草稿走独立键。
const snapshotSchema = Schema.Struct({
  messages: Schema.Array(messageSchema).pipe(Schema.mutable),
  question: Schema.optional(Schema.String),
});

export const ASK_CHAT_STORAGE_KEY = "personal-site:ask-chat";
export const ASK_CHAT_DRAFT_STORAGE_KEY = "personal-site:ask-chat-draft";

function readDraft(): string | null {
  try {
    return window.sessionStorage.getItem(ASK_CHAT_DRAFT_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeAskChatDraft(question: string) {
  try {
    // 空草稿也写成存在的键：键在即代表草稿已迁移，旧快照里的陈旧草稿不再复活。
    window.sessionStorage.setItem(ASK_CHAT_DRAFT_STORAGE_KEY, question);
  } catch {
    // 存储被禁用或配额已满时，当前页面仍可继续提问。
  }
}

export function readAskChatSnapshot(): { messages: ChatMessage[]; question: string } {
  const draft = readDraft();
  let messages: ChatMessage[] = [];
  let legacyQuestion: string | null = null;
  try {
    const raw = window.sessionStorage.getItem(ASK_CHAT_STORAGE_KEY);
    if (raw) {
      const stored = JSON.parse(raw);
      const snapshot = Schema.decodeUnknownSync(snapshotSchema)(stored);
      // 一次性迁移已有文字回答；界面始终只走 OpenUI，保留旧会话和草稿。
      messages = stored.format !== "openui"
        ? snapshot.messages.map((message) => message.role === "assistant" && message.content
          ? { ...message, content: `root = Stack([TextContent(${JSON.stringify(message.content)})])` }
          : message)
        : snapshot.messages;
      legacyQuestion = snapshot.question ?? null;
    }
  } catch {
    // 损坏的快照当作空会话，草稿仍从独立键恢复。
  }
  if (draft !== null) return { messages, question: draft };
  if (legacyQuestion === null) return { messages, question: "" };
  // 一次性迁移旧合并快照的草稿；写入失败时旧内容原样保留，下次打开重试。
  writeAskChatDraft(legacyQuestion);
  return { messages, question: legacyQuestion };
}

export function writeAskChatMessages(messages: ChatMessage[]) {
  try {
    if (window.sessionStorage.getItem(ASK_CHAT_DRAFT_STORAGE_KEY) === null) {
      const raw = window.sessionStorage.getItem(ASK_CHAT_STORAGE_KEY);
      const legacy = raw ? JSON.parse(raw) : null;
      if (typeof legacy?.question === "string") {
        // 草稿写入失败必须中止消息覆盖，否则会删掉唯一的旧草稿副本。
        window.sessionStorage.setItem(ASK_CHAT_DRAFT_STORAGE_KEY, legacy.question);
      }
    }
    window.sessionStorage.setItem(
      ASK_CHAT_STORAGE_KEY,
      JSON.stringify({
        format: "openui",
        // 快照不是后台生成任务；离开页面后回来，已有部分正文可读且不再显示转圈。
        messages: messages.map((message) =>
          message.isComplete
            ? message
            : {
                ...message,
                isComplete: true,
                interruption: { kind: "stopped", message: "已停止生成。" },
              },
        ),
      }),
    );
  } catch {
    // 存储被禁用或配额已满时，当前页面仍可继续提问。
  }
}
