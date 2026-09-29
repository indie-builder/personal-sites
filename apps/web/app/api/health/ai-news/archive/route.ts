import { getAiNewsArchive } from "@/lib/ai-news-archive.server";
import { archiveMetadata } from "@site/public-data/ai-news/archive.mjs";

export const dynamic = "force-dynamic";

export function GET() {
  const metadata = archiveMetadata(getAiNewsArchive());
  return Response.json(metadata, { status: metadata ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
