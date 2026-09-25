import "server-only";

import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText, type ModelMessage } from "ai";
import { createHmac, randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import { requireAskApiKey, resolveAskModelConfig } from "@/lib/ask-model.mjs";
import type { AskSource } from "@/lib/ask-types";
import { getAdminSupabaseClient } from "@/lib/supabase.server";

const MAX_SOURCE_CHARACTERS = 2_400;
const MAX_HISTORY_TURNS = 4;
const SESSION_BUCKET = "ask-sessions";
const SESSION_DIRECTORY = path.join(process.cwd(), "var", "ask-sessions");
// ponytail: process-local lock; use transactional session rows if concurrent cross-instance turns become common.
const sessionLocks = new Map<string, Promise<void>>();
let lastCleanupAt = 0;

const turnSchema = z.object({ question: z.string(), answer: z.string() });
type Turn = z.infer<typeof turnSchema>;

const systemPrompt = `你是陈远的公开资料问答助手。使用中文，简洁、准确、可追溯。历史问答只用于理解指代；事实和引用只能依据本轮公开资料包，不能使用其他知识。资料不足或互相矛盾时，直接说明“现有公开资料不足以确认”。在相关断言后用【来源编号】标注依据。`;

function sessionKey(visitorId: string, conversationId: string) {
  const secret = process.env.ASK_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("缺少 ASK_SESSION_SECRET（至少 32 个字符）。");
  return `v2_${createHmac("sha256", secret).update(`${visitorId}:${conversationId}`).digest("hex")}.jsonl`;
}

function storage() {
  return getAdminSupabaseClient("无法持久保存公开问答会话。").storage.from(SESSION_BUCKET);
}

function parseTurns(text: string): Turn[] {
  return z.array(turnSchema).parse(text.split("\n").filter(Boolean).map((line) => JSON.parse(line)));
}

async function readTurns(key: string): Promise<Turn[]> {
  if (process.env.VERCEL === "1") {
    const { data, error } = await storage().download(key);
    if (error && String(error.statusCode) !== "404") throw new Error(`读取公开问答会话失败：${error.message}`);
    return data ? parseTurns(await data.text()).slice(-MAX_HISTORY_TURNS) : [];
  }
  try {
    return parseTurns(await readFile(path.join(SESSION_DIRECTORY, key), "utf8")).slice(-MAX_HISTORY_TURNS);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

async function writeTurns(key: string, turns: Turn[]) {
  const contents = `${turns.slice(-MAX_HISTORY_TURNS).map((turn) => JSON.stringify(turn)).join("\n")}\n`;
  if (process.env.VERCEL === "1") {
    const { error } = await storage().upload(key, contents, {
      cacheControl: "0",
      contentType: "application/x-ndjson",
      upsert: true,
    });
    if (error) throw new Error(`保存公开问答会话失败：${error.message}`);
    return;
  }
  await mkdir(SESSION_DIRECTORY, { recursive: true, mode: 0o700 });
  await chmod(SESSION_DIRECTORY, 0o700);
  const temporary = path.join(SESSION_DIRECTORY, `${key}.${randomUUID()}.tmp`);
  await writeFile(temporary, contents, { mode: 0o600 });
  await rename(temporary, path.join(SESSION_DIRECTORY, key));
}

async function cleanExpiredSessions() {
  const now = Date.now();
  if (now - lastCleanupAt < 60 * 60 * 1_000) return;
  lastCleanupAt = now;
  const hours = Number(process.env.ASK_SESSION_RETENTION_HOURS ?? 24);
  if (!Number.isFinite(hours) || hours <= 0) throw new Error("ASK_SESSION_RETENTION_HOURS 必须大于 0。");
  const expiresBefore = now - hours * 60 * 60 * 1_000;
  if (process.env.VERCEL === "1") {
    const { data, error } = await storage().list("", { limit: 1_000, sortBy: { column: "updated_at", order: "asc" } });
    if (error) throw new Error(`清理公开问答会话失败：${error.message}`);
    const expired = (data ?? []).filter((entry) => entry.name.endsWith(".jsonl") && Date.parse(entry.updated_at ?? "") < expiresBefore).map((entry) => entry.name);
    if (expired.length > 0) {
      const { error: removeError } = await storage().remove(expired);
      if (removeError) throw new Error(`清理公开问答会话失败：${removeError.message}`);
    }
    return;
  }
  const entries = await readdir(SESSION_DIRECTORY, { withFileTypes: true }).catch((error: unknown) => {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return [];
    throw error;
  });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".jsonl")) continue;
    const file = path.join(SESSION_DIRECTORY, entry.name);
    if ((await stat(file)).mtimeMs < expiresBefore) await rm(file, { force: true });
  }
}

async function withSessionLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const previous = sessionLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  const tail = previous.catch(() => undefined).then(() => current);
  sessionLocks.set(key, tail);
  await previous.catch(() => undefined);
  try {
    return await operation();
  } finally {
    release();
    void tail.finally(() => { if (sessionLocks.get(key) === tail) sessionLocks.delete(key); });
  }
}

function formatSources(sources: AskSource[]) {
  return sources.map((source, index) => [
    `【${index + 1}】${source.title}${source.section ? ` · ${source.section}` : ""}`,
    source.content.slice(0, MAX_SOURCE_CHARACTERS),
  ].join("\n")).join("\n\n");
}

export async function streamAskAnswer({
  conversationId,
  onText,
  question,
  signal,
  sources,
  visitorId,
}: {
  conversationId: string;
  onText: (text: string) => void;
  question: string;
  signal?: AbortSignal;
  sources: AskSource[];
  visitorId: string;
}) {
  const key = sessionKey(visitorId, conversationId);
  return withSessionLock(key, async () => {
    await cleanExpiredSessions();
    const history = await readTurns(key);
    const { baseUrl, model } = resolveAskModelConfig();
    const anthropic = createAnthropic({ baseURL: `${baseUrl}/v1`, apiKey: requireAskApiKey() });
    const messages: ModelMessage[] = [
      ...history.flatMap((turn): ModelMessage[] => [
        { role: "user", content: turn.question },
        { role: "assistant", content: turn.answer },
      ]),
      { role: "user", content: `本轮问题：${question}\n\n本轮公开资料包：\n${formatSources(sources)}` },
    ];
    let failure: unknown;
    let answer = "";
    const result = streamText({
      model: anthropic(model),
      system: systemPrompt,
      messages,
      maxOutputTokens: 8_192,
      providerOptions: { anthropic: { thinking: { type: "disabled" } } },
      abortSignal: signal,
      onError: ({ error }) => { failure = error; },
    });
    for await (const delta of result.textStream) {
      answer += delta;
      onText(delta);
    }
    if (failure) throw failure;
    if (!answer.trim() || (await result.finishReason) === "error") throw new Error("模型未生成有效回答。");
    if (signal?.aborted) return;
    try {
      await writeTurns(key, [...history, { question, answer }]);
    } catch (error) {
      // 已送达的回答仍有效；持久化失败不覆盖流式结果。
      console.error("Public ask session persistence failed", error);
    }
  });
}
