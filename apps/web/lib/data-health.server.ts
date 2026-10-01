import { Effect } from "effect";

import "server-only";

import { readAiNewsCronHealth } from "@/lib/ai-news-sync.server";
import { getPublicDatabase } from "@/lib/public-database";
import { readPublicDataHealth } from "@site/public-data/data-health/sqlite.mjs";
import { buildDataHealth } from "@site/public-data/data-health/status.mjs";

export function readDataHealth() {
  return Effect.gen(function* () {
    const database = getPublicDatabase();
    return buildDataHealth({
      aiNews: yield* readAiNewsCronHealth(),
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      publicData: readPublicDataHealth(database),
    });
  });
}
