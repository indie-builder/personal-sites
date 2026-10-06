export const askScopes = ["all", "profile", "ai-news", "daily", "open-source"] as const;

/** 会话/访客标识的服务端与客户端共用契约（iOS AskClient.swift 文档了同一格式）。 */
export const askIdPattern = /^[A-Za-z0-9_-]{16,128}$/;

export type AskScope = (typeof askScopes)[number];
export type AskDocumentScope = Exclude<AskScope, "all">;

export type AskSource = {
  content: string;
  id: string;
  publishedAt: string | null;
  scope: AskDocumentScope;
  section: string | null;
  sourceId: string;
  sourceUrl: string;
  title: string;
};
