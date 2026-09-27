import { getGitHubRepositoryFile, repositoryResponse } from "@/lib/github-repository.server";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: Request, context: RouteContext) {
  const path = new URL(request.url).searchParams.get("path");
  if (!path) return Response.json({ error: "缺少文件路径。" }, { status: 400 });

  return repositoryResponse(async () => getGitHubRepositoryFile((await context.params).slug, path), "原始文件");
}
