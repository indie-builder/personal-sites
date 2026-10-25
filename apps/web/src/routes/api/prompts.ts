import { createFileRoute } from "@tanstack/react-router";
import { Result, Schema } from "effect";

import { getPromptsCurationPage } from "@/lib/curation";
import { CURATION_PAGE_SIZE } from "@/lib/curation-types";
import { createPaginatedFeedRoute } from "@/lib/paginated-route";

// 与 /api/curation 同源，只收窄到带「提示词」标签的 X 条目；tag 可传任意已有标签。
export const Route = createFileRoute("/api/prompts")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const tag = Schema.decodeUnknownResult(Schema.NullOr(Schema.Trim.pipe(Schema.check(Schema.isMinLength(1)), Schema.check(Schema.isMaxLength(40)))))(
          new URL(request.url).searchParams.get("tag"),
        );
        if (Result.isFailure(tag)) return Response.json({ error: "分类参数无效。" }, { status: 400 });
        return createPaginatedFeedRoute({
          label: "提示词",
          maxLimit: 50,
          pageStep: CURATION_PAGE_SIZE,
          readPage: (offset, limit) => getPromptsCurationPage(offset, limit, tag.success),
        })(request);
      },
    },
  },
});
