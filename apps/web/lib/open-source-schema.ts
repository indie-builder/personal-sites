import { z } from "zod";

export const openSourceEntrySchema = z.object({
  category: z.enum(["skills", "agents", "context", "tools"]),
  caveats: z.array(z.string()),
  dimensions: z.array(z.enum([
    "agent-skills", "coding-agent", "agent-runtime", "long-running", "multi-agent",
    "agent-control", "agent-infra", "agent-context", "local-retrieval", "model-gateway", "ai-ingestion",
  ])),
  evidence: z.object({
    checkedAt: z.string(),
    kind: z.enum(["readme", "repository"]),
    label: z.string(),
    note: z.string(),
    url: z.string().url(),
  }),
  judgement: z.string(),
  nextStep: z.string(),
  parsedMarkdown: z.string().nullable().optional(),
  personalNote: z.string(),
  readingSource: z.enum(["official-zh-readme", "model-translation"]).optional(),
  readingSourcePath: z.string().nullable().optional(),
  repository: z.string(),
  repositoryDefaultBranch: z.string().nullable().optional(),
  repositoryUrl: z.string().url(),
  scenarios: z.array(z.string()),
  slug: z.string(),
  sourceMarkdown: z.string().nullable().optional(),
  sourceSummary: z.string(),
  sourceTitle: z.string().optional(),
  status: z.enum(["持续跟踪", "计划试用", "已提炼"]),
  type: z.string(),
  workflow: z.array(z.object({ description: z.string(), label: z.string() })),
});
