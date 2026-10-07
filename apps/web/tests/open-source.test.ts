import { Schema } from "effect";
import { describe, expect, expectTypeOf, it } from "vitest";

import { openSourceEntrySchema } from "../lib/open-source-schema";
import { getOpenSourceCategoryLabel, type OpenSourceCategory } from "../lib/open-source-types";

import { openSourceEntries } from "../../../config/open-source-curation.mjs";
import { getOpenSourceDimensionLabel, openSourceCategories, toOpenSourceListEntry } from "../lib/open-source-types";
import { resolveGitHubReadmeAssetUrl, resolveGitHubReadmeUrl } from "../lib/github-readme-url";
import { buildGitHubRepositoryTree, githubRepositoryFileUrl, normalizeGitHubPath } from "../lib/github-repository-browser";

describe("open-source curation", () => {
  it("only exposes a curated public subset with stable, unique routes", () => {
    expect(openSourceEntries).toHaveLength(10);
    expect(new Set(openSourceEntries.map((entry) => entry.slug)).size).toBe(openSourceEntries.length);
    expect(openSourceEntries.every((entry) => entry.evidence.kind === "readme")).toBe(true);
    expect(openSourceEntries.every((entry) => entry.evidence.url.includes("/README"))).toBe(true);
  });

  it("keeps skills and agent systems as distinct primary categories", () => {
    expect(openSourceCategories.map((category) => category.id)).toEqual([
      "all",
      "skills",
      "agents",
      "context",
      "tools",
    ]);
    expect(openSourceEntries.some((entry) => entry.category === "skills")).toBe(true);
    expect(openSourceEntries.some((entry) => entry.category === "agents")).toBe(true);
    expect(getOpenSourceDimensionLabel("agent-control")).toBe("Agent 控制面");
    expect(openSourceEntries.some((entry) => entry.dimensions.includes("multi-agent"))).toBe(true);
  });

  it("decodes every public category and dimension without changing their labels", () => {
    expectTypeOf<typeof openSourceEntrySchema.Type.category>().toEqualTypeOf<Exclude<OpenSourceCategory, "all">>();
    expectTypeOf<typeof openSourceEntrySchema.Type.dimensions[number]>().toEqualTypeOf<Parameters<typeof getOpenSourceDimensionLabel>[0]>();
    const decode = Schema.decodeUnknownSync(openSourceEntrySchema);
    const curated = openSourceEntries[0];
    const entry = {
      category: curated.category,
      dimensions: curated.dimensions,
      evidence: curated.evidence,
      personalNote: curated.personalNote,
      repository: curated.repository,
      repositoryUrl: `https://github.com/${curated.repository}`,
      slug: curated.slug,
      sourceSummary: curated.sourceSummary,
      status: curated.status,
      type: curated.type,
    };
    const categories = ["skills", "agents", "context", "tools"] as const;
    const dimensions = [
      "agent-skills", "coding-agent", "agent-runtime", "long-running", "multi-agent",
      "agent-control", "agent-infra", "agent-context", "local-retrieval", "model-gateway", "ai-ingestion",
    ] as const;
    for (const category of categories) {
      const input = { ...entry, category, dimensions: [...dimensions] };
      expect(decode(input)).toEqual(input);
    }
    expect(categories.map(getOpenSourceCategoryLabel)).toEqual([
      "Skills 与工作流", "智能体系统", "智能体上下文", "AI 开发工具",
    ]);
    expect(dimensions.map(getOpenSourceDimensionLabel)).toEqual([
      "Agent Skills", "Coding Agent", "Agent 运行时", "长程 Agent", "多智能体协作",
      "Agent 控制面", "Agent 基础设施", "Agent 上下文", "本地检索", "模型网关", "AI 数据入口",
    ]);
    expect(() => decode({ ...entry, category: "all" })).toThrow();
    expect(() => decode({ ...entry, category: "unknown" })).toThrow();
    expect(() => decode({ ...entry, dimensions: ["unknown"] })).toThrow();
  });

  it("keeps the publish allowlist bounded even when the Star synchronizer has all repositories", () => {
    expect(openSourceEntries.find((entry) => entry.slug === "herdr")).toMatchObject({
      repository: "herdrdev/herdr",
      category: "agents",
    });
    expect(openSourceEntries.find((entry) => entry.slug === "not-starred")).toBeUndefined();
  });

  it("keeps long repository documents out of the client-side list projection", () => {
    const entry = openSourceEntries[0];
    const listEntry = toOpenSourceListEntry({
      ...entry,
      parsedMarkdown: "# 很长的中文阅读版",
      sourceMarkdown: "# Very long original README",
    });

    expect(listEntry).toEqual({
      category: entry.category,
      checkedAt: entry.evidence.checkedAt,
      dimensions: entry.dimensions,
      repository: entry.repository,
      slug: entry.slug,
      sourceSummary: entry.sourceSummary,
      status: entry.status,
      type: entry.type,
    });
    expect("parsedMarkdown" in listEntry).toBe(false);
    expect("sourceMarkdown" in listEntry).toBe(false);
  });

  it("resolves README-relative links against the repository instead of this site", () => {
    const sourceUrl = "https://github.com/jakubkrehel/skills/blob/main/README.md";
    expect(resolveGitHubReadmeUrl("skills/better-interface/SKILL.md", sourceUrl)).toBe(
      "https://github.com/jakubkrehel/skills/blob/main/skills/better-interface/SKILL.md",
    );
    expect(resolveGitHubReadmeUrl("https://interfaces.dev/", sourceUrl)).toBe("https://interfaces.dev/");
    expect(resolveGitHubReadmeUrl("#install", sourceUrl)).toBe("#install");
  });

  it("resolves README-relative images to raw GitHub assets and keeps external images intact", () => {
    const sourceUrl = "https://github.com/tobi/qmd/blob/main/README.md";
    expect(resolveGitHubReadmeAssetUrl("assets/qmd-architecture.png", sourceUrl)).toBe(
      "https://raw.githubusercontent.com/tobi/qmd/main/assets/qmd-architecture.png",
    );
    expect(resolveGitHubReadmeAssetUrl("https://example.com/diagram.png", sourceUrl)).toBe(
      "https://example.com/diagram.png",
    );
  });

  it("builds a safe navigable GitHub repository tree", () => {
    expect(normalizeGitHubPath("src/components/App.tsx")).toBe("src/components/App.tsx");
    expect(normalizeGitHubPath("../.env")).toBeNull();
    expect(normalizeGitHubPath("src//App.tsx")).toBeNull();
    expect(githubRepositoryFileUrl("https://github.com/example/repo", "main", "src/App.tsx")).toBe(
      "https://github.com/example/repo/blob/main/src/App.tsx",
    );

    expect(buildGitHubRepositoryTree([
      { path: "src/App.tsx", size: 120, type: "blob" },
      { path: "README.md", size: 20, type: "blob" },
      { path: "src", type: "tree" },
    ])).toMatchObject([
      { name: "src", type: "tree", children: [{ name: "App.tsx", path: "src/App.tsx", type: "blob" }] },
      { name: "README.md", type: "blob" },
    ]);
  });
});
