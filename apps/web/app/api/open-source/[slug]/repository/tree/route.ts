import { Effect } from "effect";
import { io } from "@site/effect";
import { getGitHubRepositoryTree, repositoryResponse } from "@/lib/github-repository.server";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: Request, context: RouteContext) {
  return repositoryResponse(
    () => io("route.params", () => context.params).pipe(Effect.flatMap(({ slug }) => getGitHubRepositoryTree(slug))),
    "原始仓库",
    request.signal,
  );
}
