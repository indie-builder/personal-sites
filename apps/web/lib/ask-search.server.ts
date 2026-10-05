import { attempt } from "@site/effect";
import { Effect } from "effect";

import "server-only";

import { searchAiNewsDocuments } from "@/lib/ai-news";
import { getAskSearchFallbackTerms } from "@/lib/ask-search-terms";
import { searchLocalAskDocuments } from "@/lib/curation-search.server";
import type { AskScope, AskSource } from "@/lib/ask-types";

type SearchDocument = AskSource & { score: number };

type RankedBatch = { documents: SearchDocument[]; weight?: number };

function fuseAskSearchDocuments(batches: RankedBatch[], limit = 6): SearchDocument[] {
  const fused = new Map<string, { document: SearchDocument; matches: number; rawScore: number; score: number }>();
  for (const { documents, weight = 1 } of batches) {
    documents.forEach((document, index) => {
      const existing = fused.get(document.id) ?? { document, matches: 0, rawScore: 0, score: 0 };
      existing.matches += 1;
      existing.rawScore += document.score;
      existing.score += weight / (index + 1);
      fused.set(document.id, existing);
    });
  }
  return [...fused.values()]
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.matches - left.matches ||
        right.rawScore - left.rawScore ||
        (right.document.publishedAt ?? "").localeCompare(left.document.publishedAt ?? ""),
    )
    .slice(0, limit)
    .map(({ document, score }) => ({ ...document, score }));
}

function searchDocuments(query: string, scope: AskScope) {
  return Effect.gen(function* () {
    const localScopes =
      scope === "all" ? (["profile", "daily", "open-source"] as const) : scope === "ai-news" ? [] : [scope];
    const batches: RankedBatch[] = yield* attempt("ask.local-search", () =>
      localScopes.map((localScope) => ({
        documents: searchLocalAskDocuments(query, localScope),
      })),
    );
    const aiDocuments =
      scope === "all" || scope === "ai-news"
        ? (yield* searchAiNewsDocuments(query)).map((document) => ({
            ...document,
            scope: "ai-news" as const,
            section: null,
          }))
        : [];
    if (aiDocuments.length > 0) batches.push({ documents: aiDocuments });
    return fuseAskSearchDocuments(batches);
  });
}

function toAskSource(document: SearchDocument): AskSource {
  const { score: _, ...source } = document;
  return source;
}

export function searchAskDocuments(query: string, scope: AskScope) {
  return Effect.gen(function* () {
    const exactDocuments = yield* searchDocuments(query, scope);
    const fallbackTerms = getAskSearchFallbackTerms(query);
    if (fallbackTerms.length === 0) return exactDocuments.map(toAskSource);
    const fallbackDocuments = yield* Effect.forEach(fallbackTerms, (term) => searchDocuments(term, scope), {
      concurrency: 4,
    });
    return fuseAskSearchDocuments([
      { documents: exactDocuments, weight: 2 },
      ...fallbackDocuments.map((documents) => ({ documents })),
    ]).map(toAskSource);
  });
}
