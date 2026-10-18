import { describe, expect, test } from "bun:test";
import { markdown, markdownParts, type MarkdownBlock, type RichTextNode } from "../src/lib/markdown";

const walk = (nodes: RichTextNode[]): RichTextNode[] => nodes.flatMap((node) => node.type === "node" ? [node, ...walk(node.children)] : [node]);
const text = (nodes: RichTextNode[]): string => walk(nodes).flatMap((node) => node.type === "text" ? [node.text] : []).join("");
const names = (nodes: RichTextNode[]): string[] => walk(nodes).filter((node) => node.type === "node").map((node) => node.type === "node" ? node.name : "");
const blockText = (blocks: MarkdownBlock[]): string => blocks.map((block) =>
  block.kind === "rich"
    ? text(block.nodes)
    : block.runs.map((run) => "ref" in run ? `【${run.ref}】` : text(run.nodes)).join("")).join("\n");

describe("safe Markdown rich text", () => {
  test("renders headings, paragraphs, quotes, lists, emphasis and inline code", () => {
    const nodes = markdown("# 标题\n\n正文 **加粗** 与 `x < y`。\n\n> 引用\n> 第二行\n\n- 第一\n- 第二\n\n1. 有序\n2. 第二");
    expect(nodes.map((node) => node.type === "node" && node.name)).toEqual(["h1", "p", "blockquote", "ul", "div"]);
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
    expect(text(nodes)).toContain("example.com");
    expect(text(nodes)).not.toContain("javascript:");
    expect(JSON.stringify(nodes)).not.toContain('"href"');
  });

  test("preserves incomplete streamed Markdown visibly", () => {
    for (const value of ["**未完", "[链接", "`代码", "这是【1】与[2]", "<iframe>原文</iframe>"]) expect(text(markdown(value))).toBe(value);
  });

  test("renders ordered lists from their real starting number and tables, with italic and strike", () => {
    const nodes = markdown("3. 第三步\n4. 第四步");
    expect(text(nodes)).toContain("3. 第三步");
    expect(text(nodes)).toContain("4. 第四步");

    const table = markdown("| 项目 | 优势 |\n| --- | ---: |\n| 工具 A | 简单 |");
    expect(names(table)).toContain("table");
    expect(names(table)).toContain("tbody");
    expect(names(table).filter((name) => name === "th")).toHaveLength(2);
    expect(names(table).filter((name) => name === "td")).toHaveLength(2);
    expect(JSON.stringify(table)).toContain("text-align:right");
    expect(text(table)).toBe("项目优势工具 A简单");

    const inline = markdown("*强调* 与 ~~删除~~ 与 _另一处_ 与 snake_case_name");
    expect(names(inline)).toEqual(["p", "em", "del", "em"]);
    expect(text(inline)).toBe("强调 与 删除 与 另一处 与 snake_case_name");
  });

  test("code blocks scroll horizontally and links stay readable without an href", () => {
    const nodes = markdown("```\nconst value = 'a very long line that should scroll instead of wrapping forever';\n```\n\n[站内文章](https://default-coder.lovemyrmb.cn/posts/1)");
    const pre = walk(nodes).find((node) => node.type === "node" && node.name === "pre");
    expect(pre?.type === "node" && pre.attrs?.style).toContain("overflow-x:auto");
    expect(text(nodes)).toContain("站内文章（default-coder.lovemyrmb.cn）");
    expect(JSON.stringify(nodes)).not.toContain('"href"');
  });
});

describe("Ask Markdown parts with native refs", () => {
  test("splits citations into ordered refs and leaves code/link text alone", () => {
    const value = "结论【1】与[2]，重复【1】。\n\n```\n代码【1】\n[3](https://example.com)\n```\n\n`行内【2】`\n\n[链接](https://example.com/page)";
    const blocks = markdownParts(value, 2);
    expect(blockText(blocks)).toBe("结论【1】与【2】，重复【1】。\n代码【1】\n[3](https://example.com)\n行内【2】\n链接（example.com）");
    const refs = blocks.flatMap((block) => block.kind === "flow" ? block.runs.filter((run) => "ref" in run).map((run) => run) : []);
    expect(refs).toEqual([{ key: "r1", ref: 1, index: 0 }, { key: "r3", ref: 2, index: 1 }, { key: "r5", ref: 1, index: 0 }]);
  });

  test("drops refs beyond the known source count; late sources enable them", () => {
    const value = "先给结论【1】，第二处【2】，越界【9】";
    expect(blockText(markdownParts(value, 0))).toBe("先给结论【1】，第二处【2】，越界【9】");
    const one = markdownParts(value, 1);
    expect(JSON.stringify(one)).not.toContain('"ref":2');
    expect(blockText(one)).toBe("先给结论【1】，第二处【2】，越界【9】");
    const late = markdownParts(value, 2);
    expect(JSON.stringify(late)).toContain('"ref":2');
    expect(JSON.stringify(late)).not.toContain('"ref":9');
    expect(blockText(late)).toBe("先给结论【1】，第二处【2】，越界【9】");
  });

  test("keeps formatting wrappers and block styles for native rendering", () => {
    const blocks = markdownParts("## 标题【1】\n\n> 引用【2】\n\n3. 步骤【1】\n4. 下一步\n\n| A【1】 | B |\n| --- | --- |\n| 1 | 2 |", 2);
    expect(blocks.map((block) => block.kind)).toEqual(["flow", "flow", "flow", "flow", "rich", "flow"]);
    expect(blocks[0]?.kind === "flow" && blocks[0].style).toContain("font-weight:600");
    expect(blocks[2]?.kind === "flow" && blockText([blocks[2]])).toBe("3. 步骤【1】");
    expect(blockText([blocks[3]!])).toBe("4. 下一步");
    const first = blocks[0]!;
    expect(first.kind === "flow" && first.runs[0]?.key).toBe("r0");
  });

  test("table citations get matching controls after late sources while code stays literal", () => {
    const value = "| 依据 | 代码 |\n| --- | --- |\n| 结论【1】与【2】 | `代码【3】` |\n| 重复【1】 | 无 |";
    expect(markdownParts(value, 0)).toHaveLength(1);
    const blocks = markdownParts(value, 3);
    expect(blocks[0]?.kind).toBe("rich");
    const controls = blocks.flatMap(block => block.kind === "flow" ? block.runs.filter(run => "ref" in run).map(run => "ref" in run ? run.ref : 0) : []);
    expect(controls).toEqual([1, 2]);
    expect(blockText(blocks)).toContain("表格引用：【1】【2】");
  });

  test("handles hostile and partial input without inventing refs", () => {
    const blocks = markdownParts("<script>【1】</script> [x](javascript:alert(1)) **未完【1】", 1);
    expect(blocks.flatMap((block) => block.kind === "flow" ? block.runs : []).filter((run) => "ref" in run)).toHaveLength(2);
    expect(JSON.stringify(blocks)).not.toContain('"name":"script"');
    expect(JSON.stringify(blocks)).not.toContain("javascript:");
  });
});
