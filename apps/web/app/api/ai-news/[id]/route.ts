import { Effect } from "effect";
import { getAiNewsItem } from "@/lib/ai-news";
import { PUBLIC_FEED_CACHE_CONTROL } from "@/lib/paginated-route";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const item = await Effect.runPromise(getAiNewsItem(id));
    if (!item) return Response.json({ error: "未找到这条每日动态。" }, { status: 404 });
    return Response.json({ item }, { headers: { "Cache-Control": PUBLIC_FEED_CACHE_CONTROL } });
  } catch (error) {
    console.error("读取每日动态详情失败", error);
    return Response.json({ error: "暂时无法读取这条每日动态。" }, { status: 500 });
  }
}
