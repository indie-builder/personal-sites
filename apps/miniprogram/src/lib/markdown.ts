import { externalUrl } from "./platform";

export type RichTextNode = { type: "text"; text: string } | {
  type: "node";
  name: string;
  attrs?: Record<string, string>;
  children: RichTextNode[];
};
/** A rich run or a native citation ref, so refs can receive tap events outside rich-text. */
export type MarkdownRun = ({ nodes: RichTextNode[] } | { ref: number; index: number }) & { key: string };
export type MarkdownBlock = ({ kind: "rich"; nodes: RichTextNode[] } | { kind: "flow"; style: string; runs: MarkdownRun[] }) & { key: string };

const textNode = (text: string): RichTextNode => ({ type: "text", text });
const node = (name: string, children: RichTextNode[], style = "", attrs?: Record<string, string>): RichTextNode => ({
  type: "node",
  name,
  children,
  ...(style || attrs ? { attrs: { ...(style ? { style } : {}), ...attrs } } : {}),
});

const codeStyle = "display:block;white-space:pre;overflow-x:auto;font-family:monospace;font-size:13px;line-height:1.6;padding:12px;margin:0 0 16px;background:rgba(128,128,128,.12);border-radius:8px";
const inlineCodeStyle = "font-family:monospace;white-space:pre-wrap;padding:1px 4px;border-radius:4px;background:rgba(128,128,128,.12)";
const paragraphStyle = "white-space:pre-wrap;margin:0 0 16px";
const quoteStyle = "white-space:pre-wrap;border-left:2px solid #999;padding-left:12px;margin:0 0 16px";
const headingStyle = "font-weight:600;line-height:1.5;margin:20px 0 12px";
const tableStyle = "border-collapse:collapse;table-layout:fixed;width:100%;margin:0 0 16px;font-size:13px";
const cellStyle = "border:1px solid rgba(128,128,128,.35);padding:6px 8px;vertical-align:top";

const linkHost = (url: string): string => (/^https?:\/\/([^/?#]+)/i.exec(url)?.[1] ?? "").replace(/^www\./i, "");

function inline(text: string, depth = 0): RichTextNode[] {
  if (depth > 4) return [textNode(text)];
  const tokens = /(`+)([^`]*?)\1|\*\*([^*]+?)\*\*|__([^_]+?)__|~~([^~]+?)~~|\*([^*\n]+?)\*|(?<![A-Za-z0-9])_([^_\n]+?)_(?![A-Za-z0-9])|(!?)\[([^\]]*)\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g;
  const result: RichTextNode[] = [];
  let start = 0;
  for (const match of text.matchAll(tokens)) {
    if (match.index > start) result.push(textNode(text.slice(start, match.index)));
    if (match[1]) result.push(node("code", [textNode(match[2] ?? "")], inlineCodeStyle));
    else if (match[3] || match[4]) result.push(node("strong", inline(match[3] ?? match[4] ?? "", depth + 1)));
    else if (match[5]) result.push(node("del", inline(match[5], depth + 1)));
    else if (match[6] || match[7]) result.push(node("em", inline(match[6] ?? match[7] ?? "", depth + 1)));
    else {
      const label = match[9] ?? "";
      const url = externalUrl(match[10] ?? "");
      const host = url ? linkHost(url) : "";
      if (match[8] === "!") {
        if (url) result.push({ type: "node", name: "img", attrs: { src: url, alt: label, style: "max-width:100%;height:auto;border-radius:8px" }, children: [] });
        else result.push(textNode(label ? `[图片：${label}]` : "[图片不可用]"));
      } else if (url) {
        result.push(node("span", [...inline(label || host, depth + 1), ...(host ? [textNode(`（${host}）`)] : [])]));
      } else {
        result.push(textNode(label || "链接"));
      }
    }
    start = match.index + match[0].length;
  }
  if (start < text.length) result.push(textNode(text.slice(start)));
  return result;
}

type ParsedBlock =
  | { kind: "inline"; name: string; content: string; style: string }
  | { kind: "list"; ordered: boolean; start: number; items: string[] }
  | { kind: "rich"; nodes: RichTextNode[] };

const splitRow = (line: string): string[] => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
const isSeparator = (line: string): boolean => {
  const cells = splitRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
};
const isTableStart = (lines: string[], index: number): boolean =>
  (lines[index] ?? "").includes("|") && isSeparator(lines[index + 1] ?? "");
const cellAlign = (cell: string): "left" | "center" | "right" => {
  if (cell.startsWith(":") && cell.endsWith(":")) return "center";
  return cell.endsWith(":") ? "right" : "left";
};
const cellNode = (name: "th" | "td", content: string, align: string): RichTextNode =>
  node(name, inline(content), `${cellStyle};text-align:${align}${name === "th" ? ";font-weight:600;background:rgba(128,128,128,.08)" : ""}`);

function parseBlocks(text: string): ParsedBlock[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const result: ParsedBlock[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) result.push({ kind: "inline", name: "p", content: paragraph.join("\n"), style: paragraphStyle });
    paragraph = [];
  };
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? "";
    const fence = /^\s*(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence) {
      flush();
      const marker = fence[1] ?? "```";
      const code: string[] = [];
      while (++index < lines.length) {
        const value = lines[index] ?? "";
        const close = /^\s*(`{3,}|~{3,})\s*$/.exec(value)?.[1];
        if (close && close[0] === marker[0] && close.length >= marker.length) break;
        code.push(value);
      }
      result.push({ kind: "rich", nodes: [node("pre", [node("code", [textNode(code.join("\n"))])], codeStyle)] });
    } else if (!line.trim()) flush();
    else if (isTableStart(lines, index)) {
      flush();
      const header = splitRow(line);
      const alignments = splitRow(lines[index + 1] ?? "").map(cellAlign);
      const rows = [header];
      let end = index + 2;
      while (end < lines.length && (lines[end] ?? "").trim() && (lines[end] ?? "").includes("|")) {
        rows.push(splitRow(lines[end] ?? ""));
        end++;
      }
      const body = rows.slice(1).map((row) => node("tr", Array.from({ length: header.length }, (_, cellIndex) =>
        cellNode("td", row[cellIndex] ?? "", alignments[cellIndex] ?? "left"))));
      result.push({
        kind: "rich",
        nodes: [node("table", [
          node("tbody", [
            node("tr", header.map((cell, cellIndex) => cellNode("th", cell, alignments[cellIndex] ?? "left"))),
            ...body,
          ]),
        ], tableStyle)],
      });
      index = end - 1;
    } else if (/^\s{0,3}#{1,6}\s/.test(line)) {
      flush();
      const heading = /^\s{0,3}(#{1,6})\s+(.*)$/.exec(line);
      result.push({ kind: "inline", name: `h${heading?.[1]?.length ?? 2}`, content: heading?.[2] ?? line, style: headingStyle });
    } else if (/^\s*>/.test(line)) {
      flush();
      const quote: string[] = [line.replace(/^\s*>\s?/, "")];
      while (/^\s*>/.test(lines[index + 1] ?? "")) quote.push((lines[++index] ?? "").replace(/^\s*>\s?/, ""));
      result.push({ kind: "inline", name: "blockquote", content: quote.join("\n"), style: quoteStyle });
    } else if (/^\s*(?:[-+*]|\d+[.)])\s+/.test(line)) {
      flush();
      const ordered = /^\s*\d/.test(line);
      const start = ordered ? Math.max(1, Number.parseInt(/^\s*(\d+)/.exec(line)?.[1] ?? "1", 10) || 1) : 1;
      const pattern = ordered ? /^\s*\d+[.)]\s+(.*)$/ : /^\s*[-+*]\s+(.*)$/;
      const items: string[] = [];
      while (true) {
        const item = pattern.exec(lines[index] ?? "");
        if (!item) break;
        items.push(item[1] ?? "");
        index++;
      }
      index--;
      result.push({ kind: "list", ordered, start, items });
    } else paragraph.push(line);
  }
  flush();
  return result;
}

/** Existing detail-page contract: safe rich-text nodes from Markdown. */
export function markdown(text: string): RichTextNode[] {
  return parseBlocks(text).flatMap((block): RichTextNode[] => {
    if (block.kind === "rich") return block.nodes;
    if (block.kind === "list") {
      if (block.ordered) {
        const rows = block.items.map((item, offset) => node("div", inline(`${block.start + offset}. ${item}`), "margin:0 0 8px"));
        return [node("div", rows, "margin:0 0 16px")];
      }
      return [node("ul", block.items.map((item) => node("li", inline(item), "margin-bottom:8px")), "padding-left:24px;margin:0 0 16px")];
    }
    return [node(block.name, inline(block.content), block.style)];
  });
}

const citation = /【\s*(\d+(?:\s*[,，、]\s*\d+)*)\s*】|\[(\d+(?:\s*[,，、]\s*\d+)*)\](?!\()/g;
type Piece = { nodes: RichTextNode[] } | { ref: number };

function splitText(text: string, sourceCount: number): ({ text: string } | { ref: number })[] {
  const pieces: ({ text: string } | { ref: number })[] = [];
  let start = 0;
  for (const match of text.matchAll(citation)) {
    const numbers = (match[1] ?? match[2] ?? "").split(/[,，、]/).map((value) => Number.parseInt(value, 10));
    if (!numbers.length || numbers.some((number) => !Number.isInteger(number) || number < 1 || number > sourceCount)) continue;
    if (match.index > start) pieces.push({ text: text.slice(start, match.index) });
    for (const number of numbers) pieces.push({ ref: number });
    start = match.index + match[0].length;
  }
  if (start < text.length) pieces.push({ text: text.slice(start) });
  return pieces;
}

// Citations inside formatting stay formatted because each split piece keeps its wrapper nodes.
function splitNodes(nodes: RichTextNode[], sourceCount: number, depth = 0): Piece[] {
  if (depth > 6) return [{ nodes }];
  const pieces: Piece[] = [];
  let buffer: RichTextNode[] = [];
  const flush = () => {
    if (buffer.length) pieces.push({ nodes: buffer });
    buffer = [];
  };
  for (const item of nodes) {
    if (item.type === "text") {
      for (const piece of splitText(item.text, sourceCount)) {
        if ("ref" in piece) {
          flush();
          pieces.push(piece);
        } else if (piece.text) buffer.push(textNode(piece.text));
      }
    } else if (item.name === "code" || item.name === "pre" || item.name === "img") buffer.push(item);
    else {
      for (const piece of splitNodes(item.children, sourceCount, depth + 1)) {
        if ("ref" in piece) {
          flush();
          pieces.push(piece);
        } else if (piece.nodes.length) buffer.push({ ...item, children: piece.nodes });
      }
    }
  }
  flush();
  return pieces;
}

function runs(nodes: RichTextNode[], sourceCount: number): MarkdownRun[] {
  const result: MarkdownRun[] = [];
  let buffer: RichTextNode[] = [];
  const flush = () => {
    if (buffer.length) result.push({ key: `r${result.length}`, nodes: buffer });
    buffer = [];
  };
  for (const piece of splitNodes(nodes, sourceCount)) {
    if ("ref" in piece) {
      flush();
      result.push({ key: `r${result.length}`, ref: piece.ref, index: piece.ref - 1 });
    } else buffer.push(...piece.nodes);
  }
  flush();
  return result.length ? result : [{ key: "r0", nodes: [] }];
}

/**
 * Splits Markdown into rich runs plus native citation refs. `sourceCount` bounds
 * refs to real sources; late sources simply call this again to enable them.
 */
export function markdownParts(text: string, sourceCount: number): MarkdownBlock[] {
  const count = Number.isFinite(sourceCount) ? Math.max(0, Math.floor(sourceCount)) : 0;
  return parseBlocks(text).flatMap((block, blockIndex): MarkdownBlock[] => {
    const key = `b${blockIndex}`;
    if (block.kind === "rich") {
      const result: MarkdownBlock[] = [{ key, kind: "rich", nodes: block.nodes }];
      // Tables stay semantic rich text; matching source controls follow the table in source order.
      if (block.nodes.some(item => item.type === "node" && item.name === "table")) {
        const references = runs(block.nodes, count).filter((run): run is MarkdownRun & { ref: number; index: number } => "ref" in run);
        const seen = new Set<number>();
        const unique = references.filter(run => {
          if (seen.has(run.ref)) return false;
          seen.add(run.ref);
          return true;
        });
        if (unique.length) result.push({ key: `${key}-refs`, kind: "flow", style: "margin:-8px 0 16px", runs: [{ key: "label", nodes: [textNode("表格引用：")] }, ...unique] });
      }
      return result;
    }
    if (block.kind === "list") {
      return block.items.map((item, offset) => ({
        key: `${key}-${offset}`,
        kind: "flow",
        style: "margin:0 0 8px;padding-left:1.4em;text-indent:-1.4em",
        runs: runs(inline(`${block.ordered ? `${block.start + offset}. ` : "• "}${item}`), count),
      }));
    }
    return [{ key, kind: "flow", style: block.style, runs: runs(inline(block.content), count) }];
  });
}
