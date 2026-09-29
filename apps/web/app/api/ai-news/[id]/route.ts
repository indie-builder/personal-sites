import { getAiNewsItem } from "@/lib/ai-news";

// 每日动态详情 JSON，与 /ai-news/[id] 页面共用 getAiNewsItem：条目发布后基本
// 不可变，用 CDN 缓存头对齐详情页 5 分钟的 ISR 频率（安卓 App 消费）。
const DETAIL_CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=600";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const item = await getAiNewsItem(id);
    if (!item) return Response.json({ error: "未找到这条每日动态。" }, { status: 404 });
    return Response.json({ item }, { headers: { "Cache-Control": DETAIL_CACHE_CONTROL } });
  } catch (error) {
    console.error("读取每日动态详情失败", error);
    return Response.json({ error: "暂时无法读取这条每日动态。" }, { status: 500 });
  }
}
