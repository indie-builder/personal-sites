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

const snapshotSchema = Schema.Struct({
  messages: Schema.Array(messageSchema).pipe(Schema.mutable),
  question: Schema.String,
});

type AskChatSnapshot = typeof snapshotSchema.Type;
export const ASK_CHAT_STORAGE_KEY = "personal-site:ask-chat";

export function readAskChatSnapshot(): AskChatSnapshot | null {
  try {
    const raw = window.sessionStorage.getItem(ASK_CHAT_STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw);
    const snapshot = Schema.decodeUnknownSync(snapshotSchema)(stored);
    // 一次性迁移已有文字回答；界面始终只走 OpenUI，保留旧会话和草稿。
    if (stored.format !== "openui") {
      return { ...snapshot, messages: snapshot.messages.map((message) => message.role === "assistant" && message.content
        ? { ...message, content: `root = Stack([TextContent(${JSON.stringify(message.content)})])` }
        : message) };
    }
    return snapshot;
  } catch {
    return null;
  }
}

export function writeAskChatSnapshot(snapshot: AskChatSnapshot) {
  try {
    if (!snapshot.messages.length && !snapshot.question) {
      window.sessionStorage.removeItem(ASK_CHAT_STORAGE_KEY);
      return;
    }
    window.sessionStorage.setItem(
      ASK_CHAT_STORAGE_KEY,
      JSON.stringify({
        ...snapshot,
        format: "openui",
        // 快照不是后台生成任务；离开页面后回来，已有部分正文可读且不再显示转圈。
        messages: snapshot.messages.map((message) =>
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
