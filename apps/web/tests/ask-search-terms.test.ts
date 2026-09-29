import { describe, expect, it } from "vitest";

import { getAskSearchFallbackTerms } from "@/lib/ask-search-terms";

describe("getAskSearchFallbackTerms", () => {
  it("keeps the site owner's name intact when Chinese segmentation splits it", () => {
    expect(getAskSearchFallbackTerms("陈远是谁？")).toContain("陈远");
    expect(getAskSearchFallbackTerms("介绍一下陈远")).toContain("陈远");
    expect(getAskSearchFallbackTerms("indie-builder 是谁")).toContain("indie-builder");
  });
  it("drops question filler while retaining technical and Chinese search terms", () => {
    expect(getAskSearchFallbackTerms("最近有哪些关于 Agent 长期运行的实践？"))
      .toEqual(["Agent", "长期", "运行"]);
  });

  it("keeps a named technical term from an informal query", () => {
    expect(getAskSearchFallbackTerms("给我查一下那个 Codex 相关的内容"))
      .toEqual(["Codex"]);
  });
});
