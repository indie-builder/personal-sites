import { createFileRoute } from "@tanstack/react-router";
import { Effect, Result, Schema } from "effect";

import { authorizeAiNewsCron, runAiNewsCron } from "@/lib/ai-news-sync.server";

const bodySchema = Schema.Struct({ backfill: Schema.Boolean.pipe(Schema.withDecodingDefaultType(Effect.sync(() => false))) });

export const Route = createFileRoute("/api/cron/ai-news")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authorization = request.headers.get("authorization");
        const secret = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
        try {
          if (!(await Effect.runPromise(authorizeAiNewsCron(secret)))) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
          }
          const body = Schema.decodeUnknownResult(bodySchema)(await request.json().catch(() => ({})));
          if (Result.isFailure(body)) return Response.json({ error: "请求参数无效。" }, { status: 400 });
          return Response.json(await Effect.runPromise(runAiNewsCron(body.success.backfill)), {
            headers: { "Cache-Control": "no-store" },
          });
        } catch (error) {
          console.error("每日动态 Cron 同步失败", error);
          return Response.json({ error: "每日动态同步失败。" }, { status: 500 });
        }
      },
    },
  },
});
