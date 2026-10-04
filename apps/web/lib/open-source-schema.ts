import { UrlString } from "@site/effect/schema";
import { Schema } from "effect";

export const openSourceEntrySchema = Schema.Struct({
  category: Schema.Literals(["skills", "agents", "context", "tools"]),
  dimensions: Schema.Array(
    Schema.Literals([
      "agent-skills",
      "coding-agent",
      "agent-runtime",
      "long-running",
      "multi-agent",
      "agent-control",
      "agent-infra",
      "agent-context",
      "local-retrieval",
      "model-gateway",
      "ai-ingestion",
    ]),
  ).pipe(Schema.mutable),
  evidence: Schema.Struct({
    checkedAt: Schema.String,
    kind: Schema.Literals(["readme", "repository"]),
    label: Schema.String,
    note: Schema.String,
    url: UrlString,
  }),
  parsedMarkdown: Schema.optional(Schema.NullOr(Schema.String)),
  personalNote: Schema.String,
  readingSource: Schema.optional(Schema.Literals(["official-zh-readme", "model-translation"])),
  readingSourcePath: Schema.optional(Schema.NullOr(Schema.String)),
  repository: Schema.String,
  repositoryDefaultBranch: Schema.optional(Schema.NullOr(Schema.String)),
  repositoryUrl: UrlString,
  slug: Schema.String,
  sourceMarkdown: Schema.optional(Schema.NullOr(Schema.String)),
  sourceSummary: Schema.String,
  status: Schema.Literals(["持续跟踪", "计划试用", "已提炼"]),
  type: Schema.String,
});
