import { createFileRoute } from "@tanstack/react-router";

import { getGitHubRepositoryTree, repositoryResponse } from "@/lib/github-repository.server";

export const Route = createFileRoute("/api/open-source/$slug/repository/tree")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        repositoryResponse(Promise.resolve(params), getGitHubRepositoryTree, "原始仓库", request.signal),
    },
  },
});
