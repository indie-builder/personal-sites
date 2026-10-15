import { createFileRoute } from "@tanstack/react-router";

import { getGitHubRepositoryFile, repositoryResponse } from "@/lib/github-repository.server";

export const Route = createFileRoute("/api/open-source/$slug/repository/file")({
  server: {
    handlers: {
      GET: ({ request, params }) => {
        const path = new URL(request.url).searchParams.get("path");
        if (!path) return Response.json({ error: "缺少文件路径。" }, { status: 400 });

        return repositoryResponse(Promise.resolve(params), (slug) => getGitHubRepositoryFile(slug, path), "原始文件", request.signal);
      },
    },
  },
});
