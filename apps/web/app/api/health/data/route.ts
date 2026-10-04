import { Effect } from "effect";
import { readAiNewsCronHealth } from "@/lib/ai-news-sync.server";
import { getPublicDatabase } from "@/lib/public-database";
import { readPublicDataHealth } from "@site/public-data/data-health/sqlite.mjs";
import { buildDataHealth } from "@site/public-data/data-health/status.mjs";

export const runtime = "nodejs";

export async function GET() {
  try {
    const health = await Effect.runPromise(Effect.gen(function* () {
      const database = getPublicDatabase();
      return buildDataHealth({
        aiNews: yield* readAiNewsCronHealth(),
        commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
        publicData: readPublicDataHealth(database),
      });
    }));
    return Response.json(health, {
      headers: { "Cache-Control": "no-store" },
      status: health.healthy ? 200 : 503,
    });
  } catch (error) {
    console.error("读取统一数据健康状态失败", error);
    return Response.json({ healthy: false }, { headers: { "Cache-Control": "no-store" }, status: 503 });
  }
}
