// Effect Schema initializes UTF-8 codecs before any page runs; older AppService runtimes lack them.
export class Utf8Encoder {
  readonly encoding = "utf-8";
  encode(value = ""): Uint8Array {
    const bytes: number[] = [];
    for (const character of String(value)) {
      let point = character.codePointAt(0) ?? 0;
      if (point >= 0xd800 && point <= 0xdfff) point = 0xfffd;
      if (point < 0x80) bytes.push(point);
      else if (point < 0x800) bytes.push(0xc0 | (point >> 6), 0x80 | (point & 63));
      else if (point < 0x10000) bytes.push(0xe0 | (point >> 12), 0x80 | ((point >> 6) & 63), 0x80 | (point & 63));
      else bytes.push(0xf0 | (point >> 18), 0x80 | ((point >> 12) & 63), 0x80 | ((point >> 6) & 63), 0x80 | (point & 63));
    }
    return new Uint8Array(bytes);
  }
}

export class Utf8Decoder {
  readonly encoding = "utf-8";
  readonly fatal: boolean;
  readonly ignoreBOM: boolean;
  private pending: number[] = [];
  private start = true;

  constructor(label = "utf-8", options: { fatal?: boolean; ignoreBOM?: boolean } = {}) {
    if (!["utf-8", "utf8", "unicode-1-1-utf-8"].includes(label.trim().toLowerCase())) {
      throw new RangeError("Only UTF-8 is supported");
    }
    this.fatal = !!options.fatal;
    this.ignoreBOM = !!options.ignoreBOM;
  }

  decode(input?: ArrayBuffer | ArrayBufferView, options: { stream?: boolean } = {}): string {
    const incoming = input === undefined ? new Uint8Array() : ArrayBuffer.isView(input)
      ? new Uint8Array(input.buffer, input.byteOffset, input.byteLength) : new Uint8Array(input);
    const bytes = this.pending.concat(Array.from(incoming));
    this.pending = [];
    let text = "";
    let index = 0;
    const invalid = () => {
      if (this.fatal) throw new TypeError("Invalid UTF-8 data");
      text += "�";
    };
    while (index < bytes.length) {
      const first = bytes[index];
      const count = first < 0x80 ? 1 : first >= 0xc2 && first <= 0xdf ? 2
        : first >= 0xe0 && first <= 0xef ? 3 : first >= 0xf0 && first <= 0xf4 ? 4 : 0;
      if (!count) { invalid(); index++; continue; }
      let point = first & (count === 1 ? 127 : 127 >> count);
      let consumed = 1;
      let malformed = false;
      while (consumed < count && index + consumed < bytes.length) {
        const byte = bytes[index + consumed];
        const min = consumed === 1 && first === 0xe0 ? 0xa0 : consumed === 1 && first === 0xf0 ? 0x90 : 0x80;
        const max = consumed === 1 && first === 0xed ? 0x9f : consumed === 1 && first === 0xf4 ? 0x8f : 0xbf;
        if (byte < min || byte > max) { malformed = true; break; }
        point = (point << 6) | (byte & 63);
        consumed++;
      }
      if (malformed) { invalid(); index += consumed; continue; }
      if (consumed < count) {
        if (options.stream) this.pending = bytes.slice(index);
        else invalid();
        break;
      }
      text += String.fromCodePoint(point);
      index += count;
    }
    if (this.start && text.length) {
      this.start = false;
      if (!this.ignoreBOM && text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    }
    if (!options.stream) this.start = true;
    return text;
  }
}

if (typeof globalThis.TextEncoder === "undefined") {
  Object.defineProperty(globalThis, "TextEncoder", { value: Utf8Encoder, configurable: true });
}
if (typeof globalThis.TextDecoder === "undefined") {
  Object.defineProperty(globalThis, "TextDecoder", { value: Utf8Decoder, configurable: true });
}
