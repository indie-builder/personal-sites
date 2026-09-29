import { getGitHubRepositoryTree, repositoryResponse } from "@/lib/github-repository.server";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: RouteContext) {
  return repositoryResponse(async () => getGitHubRepositoryTree((await context.params).slug), "原始仓库");
}
