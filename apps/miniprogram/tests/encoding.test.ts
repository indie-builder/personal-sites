import { describe, expect, test } from "bun:test";
import { Utf8Decoder, Utf8Encoder } from "../src/encoding";

describe("AppService UTF-8 fallback", () => {
  test("matches native UTF-8 across every byte boundary", () => {
    const text = "陈远小站，问一问 👋🏽\n\u0000 café 日本語 𐐷";
    const bytes = new TextEncoder().encode(text);
    expect(new Utf8Encoder().encode(text)).toEqual(bytes);
    for (let split = 0; split <= bytes.length; split++) {
      const decoder = new Utf8Decoder();
      expect(decoder.decode(bytes.slice(0, split), { stream: true }) + decoder.decode(bytes.slice(split))).toBe(text);
    }
    const decoder = new Utf8Decoder();
    expect(Array.from(bytes, byte => decoder.decode(new Uint8Array([byte]), { stream: true })).join("") + decoder.decode()).toBe(text);
  });

  test("invalid UTF-8 and lone surrogates follow replacement/fatal behavior", () => {
    for (const bytes of [[0xe4, 0xb8], [0xe4, 0x41], [0xc0, 0xaf], [0xed, 0xa0, 0x80], [0xf4, 0x90, 0x80, 0x80]]) {
      expect(new Utf8Decoder().decode(new Uint8Array(bytes))).toBe(new TextDecoder().decode(new Uint8Array(bytes)));
      expect(() => new Utf8Decoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes))).toThrow();
    }
    expect(new Utf8Encoder().encode("\ud800x\udfff")).toEqual(new TextEncoder().encode("\ud800x\udfff"));
  });

  test("respects view offsets, BOM and decoder reuse", () => {
    const bytes = new Utf8Encoder().encode("x陈远y");
    expect(new Utf8Decoder().decode(bytes.subarray(1, bytes.length - 1))).toBe("陈远");
    const bom = new Uint8Array([0xef, 0xbb, 0xbf, 0x61]);
    expect(new Utf8Decoder().decode(bom)).toBe("a");
    expect(new Utf8Decoder("utf-8", { ignoreBOM: true }).decode(bom)).toBe("﻿a");
    expect(() => new Utf8Decoder("gbk")).toThrow();
  });
});
