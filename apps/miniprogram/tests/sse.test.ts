import { describe, expect, test } from "bun:test";
import { SseParser, Utf8Decoder } from "../src/lib/sse";
import { parseAskFrame } from "../src/lib/ask";

const encode = (value: string) => new TextEncoder().encode(value);

describe("UTF-8 streaming decoder", () => {
  test("preserves Chinese and emoji across EVERY byte split and one-byte chunks", () => {
    const text = "中文回答：陈远，您好 👋🏽 😀 🚀𠮷\nASCII\r\n";
    const bytes = encode(text);
    for (let split = 0; split <= bytes.length; split++) {
      const decoder = new Utf8Decoder();
      expect(decoder.decode(bytes.slice(0, split)) + decoder.decode(bytes.slice(split)) + decoder.decode(undefined, true)).toBe(text);
    }
    const decoder = new Utf8Decoder();
    expect(Array.from(bytes, (byte) => decoder.decode(Uint8Array.of(byte))).join("") + decoder.decode(undefined, true)).toBe(text);
  });

  test("matches replacement semantics for malformed and truncated bytes at every split", () => {
    const cases = [[0xe4, 0xb8], [0xed, 0xa0, 0x80], [0xf4, 0x90, 0x80, 0x80], [0xe4, 0x41], [0xc0, 0x80], [0xf0, 0x9f, 0x92], [0xef, 0xbb, 0xbf, 0xe4, 0xb8, 0xad]];
    for (const bytes of cases) {
      for (let split = 0; split <= bytes.length; split++) {
        const decoder = new Utf8Decoder();
        expect(decoder.decode(Uint8Array.from(bytes.slice(0, split))) + decoder.decode(Uint8Array.from(bytes.slice(split)), true)).toBe(new TextDecoder().decode(Uint8Array.from(bytes)));
      }
    }
  });
});

describe("SSE frame parser", () => {
  test("handles every byte split, CRLF boundaries, comments, multiline data and trailing EOF frame", () => {
    const source = ": 心跳\r\nevent: text\r\ndata: {\r\ndata: \"delta\":\"中文😀【1】\"}\r\n\r\nevent: sources\ndata: {\"sources\":[]}\n\nevent: done\rdata: {}";
    const bytes = encode(source);
    for (let split = 0; split <= bytes.length; split++) {
      const events: unknown[] = [];
      const decoder = new Utf8Decoder();
      const parser = new SseParser((frame) => events.push(parseAskFrame(frame)));
      parser.push(decoder.decode(bytes.slice(0, split)));
      parser.push(decoder.decode(bytes.slice(split), true));
      parser.finish();
      expect(events).toEqual([{ type: "text", delta: "中文😀【1】" }, { type: "sources", sources: [] }, { type: "done" }]);
    }
  });

  test("preserves source order and duplicates, sanitizes source URLs", () => {
    const source = { id: "same", title: "来源", content: "正文", scope: "profile", sourceUrl: "https://example.com/1" };
    const event = parseAskFrame({ event: "sources", data: JSON.stringify({ sources: [source, { ...source, title: "第二", sourceUrl: "javascript:alert(1)" }, source] }) });
    expect(event).toEqual({ type: "sources", sources: [source, { ...source, title: "第二", sourceUrl: "" }, source] });
  });

  test("rejects malformed known events rather than shifting citation numbering", () => {
    for (const frame of [
      { event: "text", data: "{bad}" }, { event: "text", data: '{"delta":3}' },
      { event: "sources", data: '{"sources":[{"id":"broken"}]}' }, { event: "done", data: "null" },
      { event: "error", data: '{"message":3}' },
    ]) expect(() => parseAskFrame(frame)).toThrow("数据格式异常");
    expect(() => parseAskFrame({ event: "error", data: '{"message":"请稍后重试"}' })).toThrow("请稍后重试");
  });

  test("ignores comments and unknown fields, resets event at frame boundary", () => {
    const frames: unknown[] = [];
    const parser = new SseParser((frame) => frames.push(frame));
    parser.push(":keepalive\n\nid: 3\nevent: text\ndata: a\n\nretry: 2\ndata: b\n\n");
    parser.finish();
    expect(frames).toEqual([{ event: "text", data: "a" }, { event: "message", data: "b" }]);
  });
});
