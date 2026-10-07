import { UrlString } from "@site/effect/schema";
import { Schema } from "effect";

import { openSourceCategories, openSourceDimensions } from "@/lib/open-source-types";

export const openSourceEntrySchema = Schema.Struct({
  category: Schema.Literals(openSourceCategories.map(({ id }) => id).filter((id) => id !== "all")),
  dimensions: Schema.Array(Schema.Literals(openSourceDimensions.map(({ id }) => id))).pipe(Schema.mutable),
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
