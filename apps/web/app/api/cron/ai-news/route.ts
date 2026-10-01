import { Effect } from "effect";
import { Either, Schema } from "effect";

import { authorizeAiNewsCron, runAiNewsCron } from "@/lib/ai-news-sync.server";

export const maxDuration = 60;
export const runtime = "nodejs";

const bodySchema = Schema.Struct({ backfill: Schema.optionalWith(Schema.Boolean, { default: () => false }) });

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  const secret = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  try {
    if (!(await Effect.runPromise(authorizeAiNewsCron(secret)))) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = Schema.decodeUnknownEither(bodySchema)(await request.json().catch(() => ({})));
    if (Either.isLeft(body)) return Response.json({ error: "请求参数无效。" }, { status: 400 });
    return Response.json(await Effect.runPromise(runAiNewsCron(body.right.backfill)), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("每日动态 Cron 同步失败", error);
    return Response.json({ error: "每日动态同步失败。" }, { status: 500 });
  }
}
