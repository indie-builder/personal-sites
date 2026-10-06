import { getGitHubRepositoryTree, repositoryResponse } from "@/lib/github-repository.server";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: Request, context: RouteContext) {
  return repositoryResponse(context.params, getGitHubRepositoryTree, "原始仓库", request.signal);
}
