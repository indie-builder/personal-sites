import { Effect, Either, Schema } from "effect";

const PUBLIC_FEED_CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=600";

type PaginatedFeedConfig = {
  /** 每页固定档位（与客户端 PAGE_SIZE 一致）。 */
  pageStep: number;
  /** limit 参数的校验上限；实际出页始终用 pageStep。 */
  maxLimit: number;
  maxOffset?: number;
  /** 读取一页数据的实现，签名 (offset, limit)。 */
  readPage: (offset: number, limit: number) => Effect.Effect<unknown, Error>;
  /** 日志与 500 文案使用的板块名。 */
  label: string;
};

/**
 * 信息流分页接口的公共骨架：limit 钳到上限、offset 向下取整到步长的倍数，
 * 把 CDN 缓存键（s-maxage 响应头）收敛到有限档位，避免随机分页参数绕过
 * CDN 打穿数据源；错误响应统一为站内 { error } JSON。
 */
export function createPaginatedFeedRoute({
  pageStep,
  maxLimit,
  maxOffset = 10_000,
  readPage,
  label,
}: PaginatedFeedConfig) {
  const querySchema = Schema.Struct({
    limit: Schema.optionalWith(
      Schema.NumberFromString.pipe(Schema.int())
        .pipe(Schema.greaterThanOrEqualTo(1))
        .pipe(Schema.lessThanOrEqualTo(maxLimit)),
      { default: () => pageStep },
    ),
    offset: Schema.optionalWith(
      Schema.NumberFromString.pipe(Schema.int())
        .pipe(Schema.greaterThanOrEqualTo(0))
        .pipe(Schema.lessThanOrEqualTo(maxOffset)),
      { default: () => 0 },
    ),
  });

  return async function GET(request: Request) {
    const query = Schema.decodeUnknownEither(querySchema)(Object.fromEntries(new URL(request.url).searchParams));
    if (Either.isLeft(query)) return Response.json({ error: "分页参数无效。" }, { status: 400 });

    const offset = Math.floor(query.right.offset / pageStep) * pageStep;
    try {
      return Response.json(await Effect.runPromise(readPage(offset, pageStep), { signal: request.signal }), {
        headers: { "Cache-Control": PUBLIC_FEED_CACHE_CONTROL },
      });
    } catch (error) {
      console.error(`读取${label}分页失败`, error);
      return Response.json({ error: `暂时无法加载更多${label}。` }, { status: 500 });
    }
  };
}
