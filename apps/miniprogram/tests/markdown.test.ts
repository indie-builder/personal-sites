import { describe, expect, test } from "bun:test";
import { markdown, type RichTextNode } from "../src/lib/markdown";

const walk = (nodes: RichTextNode[]): RichTextNode[] => nodes.flatMap((node) => node.type === "node" ? [node, ...walk(node.children)] : [node]);
const text = (nodes: RichTextNode[]): string => walk(nodes).flatMap((node) => node.type === "text" ? [node.text] : []).join("");

describe("safe Markdown rich text", () => {
  test("renders headings, paragraphs, quotes, lists, emphasis and inline code", () => {
    const nodes = markdown("# 标题\n\n正文 **加粗** 与 `x < y`。\n\n> 引用\n> 第二行\n\n- 第一\n- 第二\n\n1. 有序\n2. 第二");
    expect(nodes.map((node) => node.type === "node" && node.name)).toEqual(["h1", "p", "blockquote", "ul", "ol"]);
    expect(walk(nodes).some((node) => node.type === "node" && node.name === "strong")).toBe(true);
    expect(text(nodes)).toContain("x < y");
    expect(text(nodes)).toContain("引用\n第二行");
  });

  test("keeps fenced code verbatim, including hostile HTML, Markdown and unfinished fences", () => {
    const code = '<script>alert("x")</script>\n**literal**\n[link](javascript:alert(1))\n中😀';
    const nodes = markdown(`\`\`\`ts\n${code}\n\`\`\``);
    expect(text(nodes)).toBe(code);
    expect(walk(nodes).filter((node) => node.type === "node").map((node) => node.type === "node" && node.name)).toEqual(["pre", "code"]);
    expect(text(markdown("```\nunfinished\n最后一行"))).toBe("unfinished\n最后一行");
  });

  test("never passes raw HTML or executable URLs into rich text attributes", () => {
    const nodes = markdown('<img src=x onerror="alert(1)"><script>evil()</script>\n[bad](javascript:alert(1)) ![bad](data:image/svg+xml,evil)\n[site](https://example.com/a) ![safe](https://example.com/image.png)');
    expect(text(nodes)).toContain('<img src=x onerror="alert(1)"><script>evil()</script>');
    const elements = walk(nodes).filter((node) => node.type === "node");
    expect(elements.every((node) => !["script", "a", "iframe"].includes(node.name))).toBe(true);
    expect(elements.filter((node) => node.name === "img").map((node) => node.attrs?.src)).toEqual(["https://example.com/image.png"]);
    expect(text(nodes)).toContain("https://example.com/a");
    expect(JSON.stringify(nodes)).not.toContain('"href"');
  });

  test("preserves incomplete streamed Markdown visibly", () => {
    for (const value of ["**未完", "[链接", "`代码", "这是【1】与[2]", "<iframe>原文</iframe>"]) expect(text(markdown(value))).toBe(value);
  });
});
