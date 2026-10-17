export class Utf8Decoder {
  private pending: number[] = [];
  private first = true;

  decode(bytes = new Uint8Array(), final = false): string {
    const input = this.pending.concat(Array.from(bytes));
    this.pending = [];
    let output = "";
    let index = 0;
    const emit = (point: number) => {
      if (!this.first || point !== 0xfeff) output += String.fromCodePoint(point);
      this.first = false;
    };
    while (index < input.length) {
      const lead = input[index] ?? 0;
      if (lead < 0x80) {
        emit(lead);
        index++;
        continue;
      }
      const count = lead >= 0xc2 && lead <= 0xdf ? 2 : lead >= 0xe0 && lead <= 0xef ? 3 : lead >= 0xf0 && lead <= 0xf4 ? 4 : 0;
      if (!count) {
        emit(0xfffd);
        index++;
        continue;
      }
      let consumed = 1;
      let point = lead & (0x7f >> count);
      while (consumed < count && index + consumed < input.length) {
        const byte = input[index + consumed] ?? 0;
        const lower = consumed === 1 && lead === 0xe0 ? 0xa0 : consumed === 1 && lead === 0xf0 ? 0x90 : 0x80;
        const upper = consumed === 1 && lead === 0xed ? 0x9f : consumed === 1 && lead === 0xf4 ? 0x8f : 0xbf;
        if (byte < lower || byte > upper) break;
        point = (point << 6) | (byte & 0x3f);
        consumed++;
      }
      if (consumed === count) emit(point);
      else if (index + consumed === input.length && !final) {
        this.pending = input.slice(index);
        break;
      } else emit(0xfffd);
      index += consumed;
    }
    return output;
  }
}

export interface SseFrame { event: string; data: string }

export class SseParser {
  private line = "";
  private event = "";
  private data: string[] = [];
  private skipLF = false;
  private size = 0;

  constructor(private readonly onFrame: (frame: SseFrame) => void) {}

  push(text: string): void {
    for (const character of text) {
      if (this.skipLF) {
        this.skipLF = false;
        if (character === "\n") continue;
      }
      if (character === "\n" || character === "\r") {
        this.consumeLine();
        this.skipLF = character === "\r";
      } else {
        this.line += character;
        this.size++;
        if (this.size > 1_048_576) throw new Error("回答数据过大，请重试。");
      }
    }
  }

  finish(): void {
    if (this.line) this.consumeLine();
    this.dispatch();
  }

  private consumeLine(): void {
    const line = this.line;
    this.line = "";
    if (line === "") {
      this.dispatch();
      return;
    }
    if (line.startsWith(":")) return;
    const colon = line.indexOf(":");
    const field = colon < 0 ? line : line.slice(0, colon);
    let value = colon < 0 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") this.event = value;
    else if (field === "data") this.data.push(value);
  }

  private dispatch(): void {
    const frame = { event: this.event || "message", data: this.data.join("\n") };
    const hasData = this.data.length > 0;
    this.event = "";
    this.data = [];
    this.size = 0;
    if (hasData) this.onFrame(frame);
  }
}
