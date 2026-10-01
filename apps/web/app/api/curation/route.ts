import { getCurationPage } from "@/lib/curation";
import { createPaginatedFeedRoute } from "@/lib/paginated-route";
import { Either, Schema } from "effect";

// 读随部署打包的本地 sqlite（不经 unstable_cache）；分页档位固定为客户端的
// PAGE_SIZE=20，与 /api/ai-news 的参数语义保持一致。客户端按 id 去重，
// 取整带来的重复条目会被丢弃。
export async function GET(request: Request) {
  const tag = Schema.decodeUnknownEither(Schema.NullOr(Schema.Trim.pipe(Schema.minLength(1), Schema.maxLength(40))))(
    new URL(request.url).searchParams.get("tag"),
  );
  if (Either.isLeft(tag)) return Response.json({ error: "分类参数无效。" }, { status: 400 });
  return createPaginatedFeedRoute({
    label: "策展内容",
    maxLimit: 50,
    pageStep: 20,
    readPage: (offset, limit) => getCurationPage(offset, limit, tag.right),
  })(request);
}
