export const item = (id: string) => ({
  id, title: `作品 ${id}`, category: "构图", topic: "空间留白", author: "作者", text: "说明",
  sourceURL: "https://example.com/work", thumbnail: "https://example.com/thumb.webp", media: [],
});
export const page = (ids: string[], hasMore = true) => ({
  items: ids.map(item), total: 80, hasMore,
  categories: [{ id: "composition", name: "构图", count: 80 }],
  topics: [{ id: "space", name: "空间留白", count: 12 }], attribution: "创作者 · CC BY 4.0",
});

interface Pending {
  url: string;
  aborted: boolean;
  success: (response: { statusCode: number; data: unknown }) => void;
  fail: (error: { errMsg: string }) => void;
}

export function mockPortfolioRequests() {
  const pending: Pending[] = [];
  const waiters: ((request: Pending) => void)[] = [];
  const originalWx = Object.getOwnPropertyDescriptor(globalThis, "wx");
  const nextRequest = (): Promise<Pending> => {
    const request = pending.shift();
    return request ? Promise.resolve(request) : new Promise((resolve) => waiters.push(resolve));
  };
  const respond = (request: Pending, data: unknown, statusCode = 200) => request.success({ statusCode, data });
  Object.defineProperty(globalThis, "wx", { configurable: true, value: {
    request(options: Omit<Pending, "aborted">) {
      const request: Pending = { ...options, aborted: false };
      const waiter = waiters.shift();
      if (waiter) waiter(request); else pending.push(request);
      return { abort() { request.aborted = true; options.fail({ errMsg: "request:fail abort" }); } };
    },
    showToast() {},
  } });
  function restore() {
    if (originalWx) Object.defineProperty(globalThis, "wx", originalWx);
    else Reflect.deleteProperty(globalThis, "wx");
  }
  return { pending, nextRequest, respond, restore };
}
