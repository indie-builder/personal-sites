import { cleanup, render, screen } from "@testing-library/react";
import { Schema } from "effect";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(cleanup);

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, search }: { children: ReactNode; to: string; search?: { tag?: string } }) =>
    <a href={`${to}${search?.tag ? `?tag=${encodeURIComponent(search.tag)}` : ""}`}>{children}</a>,
}));
vi.mock("@/components/page-shell", () => ({
  DetailPage: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  DetailTopbar: ({ backHref, backLabel }: { backHref: string; backLabel: string }) => <a href={backHref}>{backLabel}</a>,
}));
vi.mock("@/components/article-markdown", () => ({ ArticleMarkdown: ({ source }: { source: string }) => <div>{source}</div> }));

import { CurationEntryView } from "@/components/curation-entry";
import { curationItemSchema } from "@/lib/curation-types";

const original = {
  analysis: "作者的解析与判断。",
  author: { handle: "prompt_author", name: "Prompt Author" },
  id: "prompt-fixture",
  links: [],
  media: [],
  publishedAt: null,
  quoteContext: null,
  source: { label: "X 原文", platform: "x", url: "https://x.com/prompt_author/status/1" },
  summary: "用于检查接口的提示词。",
  tags: ["提示词", "接口审查"],
  text: "Review the API.\nKeep {{input}} unchanged.",
  title: "接口审查提示词",
};
const prompt = {
  translation: "审查这个接口。\n保持 {{input}} 不变。",
  quoteTranslation: null,
  replies: [{
    id: "2",
    author: { handle: "case_author", name: "Case Author" },
    text: "Try it on a paginated endpoint.",
    translation: "可以用分页接口试一下。",
    reason: "补充了分页接口的测试案例。",
    url: "https://x.com/case_author/status/2",
    media: [],
  }],
};

describe("prompt source and translation", () => {
  it("retains original text and validates selected replies at the public boundary", () => {
    const item = Schema.decodeUnknownSync(curationItemSchema)({ ...original, prompt });
    expect(item.text).toBe(original.text);
    expect(item.prompt).toEqual(prompt);
    for (const url of ["javascript:alert(1)", "https://example.com/status/2", "https://x.com.attacker.example/case_author/status/2"]) {
      expect(() => Schema.decodeUnknownSync(curationItemSchema)({
        ...original, prompt: { ...prompt, replies: [{ ...prompt.replies[0], url }] },
      })).toThrow();
    }
    expect(() => Schema.decodeUnknownSync(curationItemSchema)({
      ...original, prompt: { ...prompt, replies: Array(6).fill(prompt.replies[0]) },
    })).toThrow();
  });

  it("renders original, translation, curation and linked reply as distinct sections", () => {
    const item = Schema.decodeUnknownSync(curationItemSchema)({ ...original, prompt });
    render(<CurationEntryView context="prompts" entry={{ item, neighbors: { newer: null, older: null } }} />);
    expect(screen.getByRole("region", { name: "原始内容" }).textContent).toContain(original.text);
    expect(screen.getByRole("region", { name: "中文译文" }).textContent).toContain(prompt.translation);
    expect(screen.getByRole("region", { name: "深度解析" }).textContent).toContain(original.analysis);
    const replies = screen.getByRole("region", { name: "精选追评与案例" });
    expect(replies.textContent).toContain(prompt.replies[0].text);
    expect(replies.textContent).not.toContain(`“${prompt.replies[0].text}”`);
    expect(replies.textContent).toContain(prompt.replies[0].translation);
    expect(replies.textContent).toContain(prompt.replies[0].reason);
    expect(screen.getByRole("link", { name: /查看追评/u }).getAttribute("href")).toBe(prompt.replies[0].url);
    expect(screen.getByRole("link", { name: "接口审查" }).getAttribute("href")).toBe("/prompts?tag=%E6%8E%A5%E5%8F%A3%E5%AE%A1%E6%9F%A5");
  });

  it("keeps reply case images attached to their source", () => {
    const item = Schema.decodeUnknownSync(curationItemSchema)({
      ...original,
      prompt: { ...prompt, replies: [{ ...prompt.replies[0], media: [{
        type: "photo", url: "https://pbs.twimg.com/media/public-case.jpg", previewUrl: null, height: 600, width: 800,
      }] }] },
    });
    render(<CurationEntryView context="prompts" entry={{ item, neighbors: { newer: null, older: null } }} />);
    const reply = screen.getByRole("region", { name: "精选追评与案例" });
    const image = reply.querySelector("img");
    expect(image?.getAttribute("src")).toBe("https://pbs.twimg.com/media/public-case.jpg");
    expect(image?.getAttribute("alt")).toContain("追评案例");
  });

  it("keeps a quoted source and its translation separate from the post", () => {
    const quote = "Use a failing test before changing code.";
    const translatedQuote = "修改代码前先写一个失败的测试。";
    const item = Schema.decodeUnknownSync(curationItemSchema)({
      ...original,
      quoteContext: { author: "quoted_author", authorName: "Quoted Author", text: quote },
      prompt: { ...prompt, quoteTranslation: translatedQuote },
    });
    render(<CurationEntryView context="prompts" entry={{ item, neighbors: { newer: null, older: null } }} />);
    const source = screen.getByRole("region", { name: "原始内容" });
    expect(source.textContent).toContain(quote);
    expect(source.textContent).not.toContain(translatedQuote);
    expect(screen.getByRole("region", { name: "中文译文" }).textContent).toContain(translatedQuote);
  });

  it("does not duplicate Chinese originals or show empty translation and reply sections", () => {
    const item = Schema.decodeUnknownSync(curationItemSchema)({ ...original, text: "检查接口。", prompt: { translation: null, quoteTranslation: null, replies: [] } });
    render(<CurationEntryView context="prompts" entry={{ item, neighbors: { newer: null, older: null } }} />);
    expect(screen.queryByRole("region", { name: "中文译文" })).toBeNull();
    expect(screen.queryByRole("region", { name: "精选追评与案例" })).toBeNull();
  });
});
