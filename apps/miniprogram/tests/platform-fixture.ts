type RequestOptions = {
  url: string; data?: Record<string, unknown>; method?: string; timeout?: number; enableChunked?: boolean;
  success?: (response: { statusCode: number; data: unknown }) => void;
  fail?: (error: { errMsg: string }) => void;
};
class FakeRequest {
  aborted = false;
  chunkListener?: (response: { data: ArrayBuffer }) => void;
  headerListener?: (response: { statusCode: number; header: Record<string, string> }) => void;
  constructor(readonly options: RequestOptions) {}
  abort() { this.aborted = true; this.options.fail?.({ errMsg: "request:fail abort" }); }
  onChunkReceived(listener: (response: { data: ArrayBuffer }) => void) { this.chunkListener = listener; }
  offChunkReceived() {}
  onHeadersReceived(listener: (response: { statusCode: number; header: Record<string, string> }) => void) { this.headerListener = listener; }
  offHeadersReceived() {}
  headers(statusCode: number) { this.headerListener?.({ statusCode, header: {} }); }
  bytes(bytes: Uint8Array) { this.chunkListener?.({ data: Uint8Array.from(bytes).buffer }); }
  text(text: string) { this.bytes(new TextEncoder().encode(text)); }
  frame(event: string, data: unknown) { this.text(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); }
  success(data: unknown, statusCode = 200) { this.options.success?.({ data, statusCode }); }
  fail(message = "request:fail network") { this.options.fail?.({ errMsg: message }); }
}
export function mockPlatform() {
  const requests: FakeRequest[] = [];
  const storage = new Map<string, unknown>();
  const toasts: string[] = [];
  const copied: string[] = [];
  const previewed: string[][] = [];
  let randomCounter = 0;
  Object.defineProperty(globalThis, "wx", { configurable: true, value: {
    request(options: RequestOptions) { const request = new FakeRequest(options); requests.push(request); return request; },
    getStorageSync(key: string) { return storage.get(key) ?? ""; },
    setStorageSync(key: string, value: unknown) { storage.set(key, value); },
    getRandomValues(options: { length: number; success: (response: { randomValues: ArrayBuffer }) => void }) {
      options.success({ randomValues: new Uint8Array(options.length).fill(++randomCounter).buffer });
    },
    showToast(options: { title: string }) { toasts.push(options.title); },
    setClipboardData(options: { data: string; success: () => void }) { copied.push(options.data); options.success(); },
    previewImage(options: { urls: string[] }) { previewed.push(options.urls); },
  } });
  const latest = () => {
    const value = requests[requests.length - 1];
    if (!value) throw new Error("Expected a platform request");
    return value;
  };
  return { requests, storage, toasts, copied, previewed, latest };
}
