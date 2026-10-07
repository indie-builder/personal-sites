import { Effect } from "effect";
import { Result, Schema } from "effect";

import { checkAskRateLimit } from "@/lib/ask-limiter.server";
import { searchAskDocuments } from "@/lib/ask-search.server";
import { streamAskAnswer } from "@/lib/ask-session.server";
import { askIdPattern, askScopes } from "@/lib/ask-types";

const sessionSchema = Schema.Struct({
  conversationId: Schema.String.check(Schema.isPattern(askIdPattern)),
  visitorId: Schema.String.check(Schema.isPattern(askIdPattern)),
});

const requestSchema = Schema.Struct({
  ...sessionSchema.fields,
  format: Schema.optional(Schema.Literals(["text", "openui"])),
  question: Schema.Trim.check(Schema.isMinLength(2)).check(Schema.isMaxLength(1_000)),
  scope: Schema.Literals(askScopes),
});

// x-real-ip 由平台边缘按真实连接对端写入，客户端无法伪造；
// x-forwarded-for 的链首是请求方可以自行注入的部分，只取链尾（边缘追加的真实 IP）。
function getClientIp(request: Request) {
  return (
    request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || "local"
  );
}

function sseEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request) {
  // 限流只依赖 IP，提到请求体解析之前，被限的请求不必先读完整 body。
  let limit;
  try {
    limit = await Effect.runPromise(checkAskRateLimit(getClientIp(request)));
  } catch (error) {
    console.error("Public ask shared rate limit failed", error);
    return Response.json({ error: "问答服务暂时不可用，请稍后再试。" }, { status: 503 });
  }
  if (!limit.allowed) {
    return Response.json(
      { error: "提问过于频繁，请稍后再试。" },
      { headers: { "Retry-After": String(limit.retryAfterSeconds) }, status: 429 },
    );
  }

  const parsed = Schema.decodeUnknownResult(requestSchema)(await request.json().catch(() => null));
  if (Result.isFailure(parsed)) return Response.json({ error: "问题、范围或浏览器会话标识无效。" }, { status: 400 });

  const encoder = new TextEncoder();
  const cancellation = new AbortController();
  const signal = AbortSignal.any([request.signal, cancellation.signal]);
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (event: string, data: unknown) => controller.enqueue(encoder.encode(sseEvent(event, data)));
      try {
        const sources = await Effect.runPromise(searchAskDocuments(parsed.success.question, parsed.success.scope), {
          signal,
        });
        if (sources.length === 0) {
          const message = parsed.success.format === "openui"
            ? "现有公开资料不足以确认这个问题。你可以换一个更具体的关键词，或在问题里补充相关背景后再试。"
            : "现有公开资料不足以确认这个问题。你可以换一个更具体的关键词，或切换检索范围后再试。";
          write("text", { delta: parsed.success.format === "openui"
            ? `root = Stack([TextContent(${JSON.stringify(message)})])`
            : message });
          write("sources", { sources });
          write("done", {});
          return;
        }

        await Effect.runPromise(
          streamAskAnswer({
            conversationId: parsed.success.conversationId,
            format: parsed.success.format,
            onText: (delta) => write("text", { delta }),
            question: parsed.success.question,
            // 客户端断连即中止生成，不再为已离开的访客烧 token。
            signal,
            sources,
            visitorId: parsed.success.visitorId,
          }),
          { signal },
        );
        write("sources", { sources });
        write("done", {});
      } catch (error) {
        if (signal.aborted) return;
        console.error("Public ask request failed", error);
        write("error", { message: "回答暂时不可用，请稍后重试。" });
      } finally {
        if (!cancellation.signal.aborted) controller.close();
      }
    },
    cancel(reason) {
      cancellation.abort(reason);
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
