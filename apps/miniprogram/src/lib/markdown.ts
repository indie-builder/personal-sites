import { externalUrl } from "./platform";

export type RichTextNode = { type: "text"; text: string } | {
  type: "node";
  name: string;
  attrs?: Record<string, string>;
  children: RichTextNode[];
};

const textNode = (text: string): RichTextNode => ({ type: "text", text });
const node = (name: string, children: RichTextNode[], style = ""): RichTextNode => ({
  type: "node", name, children, ...(style ? { attrs: { style } } : {}),
});

function inline(text: string, depth = 0): RichTextNode[] {
  if (depth > 4) return [textNode(text)];
  const tokens = /(`+)([^`]*?)\1|\*\*(.+?)\*\*|__([^_]+?)__|(!?)\[([^\]]*)\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g;
  const result: RichTextNode[] = [];
  let start = 0;
  for (const match of text.matchAll(tokens)) {
    const index = match.index;
    if (index > start) result.push(textNode(text.slice(start, index)));
    if (match[1]) result.push(node("code", [textNode(match[2] ?? "")], "font-family:monospace;white-space:pre-wrap"));
    else if (match[3] || match[4]) result.push(node("strong", inline(match[3] ?? match[4] ?? "", depth + 1)));
    else {
      const label = match[6] ?? "";
      const url = externalUrl(match[7] ?? "");
      if (match[5] && url) result.push({ type: "node", name: "img", attrs: { src: url, alt: label, style: "max-width:100%;height:auto" }, children: [] });
      else if (match[5]) result.push(textNode(label || "[图片链接不可用]"));
      else result.push(node("span", inline(url ? `${label}（${url}）` : label, depth + 1)));
    }
    start = index + match[0].length;
  }
  if (start < text.length) result.push(textNode(text.slice(start)));
  return result;
}

export function markdown(text: string): RichTextNode[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const result: RichTextNode[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) result.push(node("p", inline(paragraph.join("\n")), "white-space:pre-wrap;margin:0 0 16px"));
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
      result.push(node("pre", [node("code", [textNode(code.join("\n"))])], "white-space:pre-wrap;word-break:break-all;font-family:monospace;padding:12px 0;margin:0 0 16px"));
    } else if (!line.trim()) flush();
    else if (/^\s{0,3}#{1,6}\s/.test(line)) {
      flush();
      const heading = /^\s{0,3}(#{1,6})\s+(.*)$/.exec(line);
      result.push(node(`h${heading?.[1]?.length ?? 2}`, inline(heading?.[2] ?? line), "font-weight:600;line-height:1.5;margin:20px 0 12px"));
    } else if (/^\s*>/.test(line)) {
      flush();
      const quote: string[] = [line.replace(/^\s*>\s?/, "")];
      while (/^\s*>/.test(lines[index + 1] ?? "")) quote.push((lines[++index] ?? "").replace(/^\s*>\s?/, ""));
      result.push(node("blockquote", inline(quote.join("\n")), "white-space:pre-wrap;border-left:2px solid #999;padding-left:12px;margin:0 0 16px"));
    } else if (/^\s*(?:[-+*]|\d+[.)])\s+/.test(line)) {
      flush();
      const ordered = /^\s*\d/.test(line);
      const items: RichTextNode[] = [];
      const pattern = ordered ? /^\s*\d+[.)]\s+(.*)$/ : /^\s*[-+*]\s+(.*)$/;
      let current = line;
      while (true) {
        const item = pattern.exec(current);
        if (!item) break;
        items.push(node("li", inline(item[1] ?? ""), "margin-bottom:8px"));
        const next = lines[index + 1] ?? "";
        if (!pattern.test(next)) break;
        index++;
        current = next;
      }
      result.push(node(ordered ? "ol" : "ul", items, "padding-left:24px;margin:0 0 16px"));
    } else paragraph.push(line);
  }
  flush();
  return result;
}
