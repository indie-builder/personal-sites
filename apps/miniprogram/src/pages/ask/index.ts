import { createAsk, markdownParts, run, scopes, type AskMessage, type AskScope, type AskState, type MarkdownBlock } from "../../lib/runtime";

const examples: { question: string; scope: AskScope }[] = [
  { question: "介绍一下陈远", scope: "profile" },
  { question: "最近关注哪些 AI 技术？", scope: "ai-news" },
  { question: "有哪些值得了解的开源项目？", scope: "open-source" },
];

const placeholders: Record<AskMessage["status"], string> = {
  streaming: "正在查阅资料…",
  complete: "暂无可显示的回答",
  stopped: "已停止生成",
  error: "这次未能完成回答",
};

// Displayed history is a bounded view; the controller keeps the full conversation.
const WINDOW = 20;
const VIEW_BUDGET = 256 * 1024;
// Six 16px lines at the composer's fixed 1.6 line-height.
const INPUT_MAX = 26 * 6 + 8;
const INPUT_MIN = 48;

function utf8Bytes(text: string): number {
  let bytes = 0;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) { bytes += 4; index++; }
    else bytes += 3;
  }
  return bytes;
}

type SourceView = { number: number; index: number; title: string; meta: string };
type PartsCache = { text: string; count: number; parts: MarkdownBlock[] };
type MessageView = {
  id: string; role: AskMessage["role"]; text: string; status: AskMessage["status"]; scope: AskScope;
  parts: MarkdownBlock[]; sourceViews: SourceView[]; sourceCount: number;
  placeholder: string; last: boolean;
};

function partCacheFor(message: AskMessage, cache: Map<string, PartsCache>): MarkdownBlock[] {
  const count = message.sources.length;
  const cached = cache.get(message.id);
  if (cached && cached.text === message.text && cached.count === count) return cached.parts;
  const parts = markdownParts(message.text, count);
  if (cache.size > 64) cache.clear();
  cache.set(message.id, { text: message.text, count, parts });
  return parts;
}

function messageView(message: AskMessage, last: boolean, cache: Map<string, PartsCache>): MessageView {
  const sources = message.sources;
  return {
    id: message.id,
    role: message.role,
    text: message.text,
    status: message.status,
    scope: message.scope,
    // Detail pages keep the plain markdown() contract; Ask renders parts with native refs.
    parts: message.role === "answer" ? partCacheFor(message, cache) : [],
    // Deliberately no source.content: reading happens from the controller copy.
    sourceViews: sources.map((source, index) => ({
      number: index + 1,
      index,
      title: source.title || `引用资料 ${index + 1}`,
      meta: [source.section, source.publishedAt?.slice(0, 10)].filter(Boolean).join(" · "),
    })),
    sourceCount: sources.length,
    placeholder: placeholders[message.status],
    last,
  };
}

Page({
  data: {
    examples,
    scopeLabels: scopes.map((scope) => scope.label),
    scopeIndex: 0,
    scopeLabel: scopes[0]?.label ?? "全部公开资料",
    draft: "",
    messages: [] as MessageView[],
    hiddenCount: 0,
    inputHeight: INPUT_MIN,
    streaming: false,
    error: "",
    pageError: "",
    canSend: false,
    hasConversation: false,
    inputHint: "",
    inputFocused: false,
    showLatest: false,
    scrollTarget: "",
    screenHeight: 0,
    keyboardOpen: false,
  },
  controller: undefined as ReturnType<typeof createAsk> | undefined,
  cancel: undefined as (() => void) | undefined,
  partsCache: new Map<string, PartsCache>(),
  visible: false,
  followLatest: true,
  windowEnd: 0,
  measuredHeight: 0,
  viewportHeight: 0,
  keyboardHeight: 0,
  windowHeight: 0,
  bottomChrome: 0,
  tail: false,
  scrollTop: 0,

  onLoad() {
    this.visible = true;
    this.controller = createAsk((state) => this.renderState(state));
    this.renderState(this.controller.state);
    this.readWindow();
  },

  onShow() {
    this.visible = true;
    this.readWindow();
  },

  onReady() {
    this.measureConversation();
  },

  onResize() {
    this.readWindow();
  },

  onHide() {
    this.stop();
    this.visible = false;
    this.keyboardHeight = 0;
    this.setData({ inputFocused: false, keyboardOpen: false });
  },

  onUnload() {
    this.stop();
    this.visible = false;
    this.controller = undefined;
    this.partsCache.clear();
  },

  renderState(state: AskState) {
    if (!this.visible) return;
    const length = state.draft.trim().length;
    const scopeIndex = Math.max(0, scopes.findIndex((scope) => scope.id === state.scope));
    const total = state.messages.length;
    // Reverse-fill from the anchor so the newest answer is always in view; loadEarlier moves the anchor back.
    const end = this.followLatest || this.windowEnd <= 0 || this.windowEnd > total ? total : this.windowEnd;
    this.windowEnd = end;
    const start = Math.max(0, end - WINDOW);
    const views: MessageView[] = [];
    let bytes = 0;
    for (let index = end - 1; index >= start; index--) {
      const view = messageView(state.messages[index]!, index === total - 1, this.partsCache);
      const size = utf8Bytes(JSON.stringify(view));
      // One oversized answer still renders alone rather than hiding the tail.
      if (views.length && bytes + size > VIEW_BUDGET) break;
      views.unshift(view);
      bytes += size;
    }
    const firstVisible = end - views.length;
    const draft = state.draft;
    const next = {
      draft,
      streaming: state.streaming,
      error: state.error,
      scopeIndex,
      scopeLabel: scopes[scopeIndex]?.label ?? "全部公开资料",
      canSend: length >= 2 && length <= 1000 && !state.streaming,
      hasConversation: total > 0 || draft.length > 0,
      inputHint: length > 1000 ? `已输入 ${length} 字，最多 1000 字` : length === 1 ? "至少输入 2 个字" : "",
      inputHeight: this.measuredHeight > 0 ? this.measuredHeight : INPUT_MIN,
      hiddenCount: firstVisible,
    };
    const current = this.data;
    const patch: Record<string, unknown> = {};
    for (const field of Object.keys(next) as (keyof typeof next)[]) {
      if (current[field] !== next[field]) patch[field] = next[field];
    }
    const replaced = views.length !== current.messages.length || views[0]?.id !== current.messages[0]?.id;
    if (replaced) {
      // Bounded by VIEW_BUDGET, so one write stays well under the native 1 MiB cap.
      patch.messages = views;
    } else {
      for (let index = 0; index < views.length; index++) {
        const view = views[index]!;
        const previous = current.messages[index]!;
        for (const field of ["text", "status", "placeholder", "last"] as const) {
          if (previous[field] !== view[field]) patch[`messages[${index}].${field}`] = view[field];
        }
        if (previous.text !== view.text) patch[`messages[${index}].parts`] = view.parts;
        else if (previous.sourceCount !== view.sourceCount) {
          // Late sources enable the inline refs without resending the answer text.
          patch[`messages[${index}].parts`] = view.parts;
        }
        if (previous.sourceCount !== view.sourceCount) {
          patch[`messages[${index}].sourceViews`] = view.sourceViews;
          patch[`messages[${index}].sourceCount`] = view.sourceCount;
        }
      }
    }
    if (Object.keys(patch).length) this.setData(patch);
    if (this.followLatest && total > 0) this.scrollLatest();
  },

  onInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.controller?.setDraft(event.detail.value);
  },

  onScopeChange(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    if (this.data.streaming) return;
    const scope = scopes[Number(event.detail.value)];
    if (scope) this.controller?.setScope(scope.id);
  },

  onExample(event: WechatMiniprogram.TouchEvent) {
    const example = examples[Number(event.currentTarget.dataset.index)];
    if (!example || this.data.streaming) return;
    this.controller?.setScope(example.scope);
    this.controller?.setDraft(example.question);
    this.resetMeasurement();
    this.setData({ inputFocused: true });
  },

  loadEarlier() {
    if (!this.controller) return;
    const total = this.controller.state.messages.length;
    const oldest = this.data.hiddenCount;
    if (oldest <= 0) return;
    this.followLatest = false;
    // Page backwards so the previously hidden page replaces the view; returnLatest restores the tail.
    this.windowEnd = Math.min(total, oldest + 1);
    this.setData({ showLatest: true });
    this.renderState(this.controller.state);
    if (this.visible) this.setData({ scrollTarget: `message-${this.data.hiddenCount}` });
  },

  onLineChange(event: WechatMiniprogram.CustomEvent<{ lineCount?: number; height?: number }>) {
    const lineCount = Number(event.detail.lineCount) || 0;
    const height = Number(event.detail.height) || 0;
    if (!lineCount || !height) return;
    // Native wrap metrics; six lines is the cap, and 8px is the textarea's vertical padding.
    this.measuredHeight = Math.min(INPUT_MAX, Math.min(6, lineCount) * (height / lineCount) + 8);
    if (this.controller) this.renderState(this.controller.state);
  },

  resetMeasurement() {
    this.measuredHeight = 0;
  },

  send() {
    if (!this.controller || !this.data.canSend) return;
    this.followLatest = true;
    this.resetMeasurement();
    this.setData({ pageError: "", showLatest: false, inputFocused: false });
    wx.hideKeyboard({});
    this.cancel = run(this.controller.send(), () => { this.cancel = undefined; }, () => {
      if (this.visible) this.setData({ pageError: "暂时无法回答，请重试。" });
      this.cancel = undefined;
    });
  },

  retry() {
    if (!this.controller || this.data.streaming) return;
    this.followLatest = true;
    this.setData({ pageError: "", showLatest: false });
    this.cancel = run(this.controller.retry(), () => { this.cancel = undefined; }, () => {
      if (this.visible) this.setData({ pageError: "暂时无法回答，请重试。" });
      this.cancel = undefined;
    });
  },

  stop() {
    this.controller?.stop();
    this.cancel?.();
    this.cancel = undefined;
  },

  newConversation() {
    if (!this.data.hasConversation) return;
    wx.showModal({
      title: "开始新对话？",
      content: "当前对话和输入草稿将清空。",
      confirmText: "新对话",
      cancelText: "保留对话",
      success: ({ confirm }) => {
        if (!confirm || !this.visible) return;
        this.stop();
        this.followLatest = true;
        this.windowEnd = 0;
        this.setData({ pageError: "", showLatest: false, inputFocused: false });
        wx.hideKeyboard({});
        this.resetMeasurement();
        this.controller?.reset();
      },
      fail: () => wx.showToast({ title: "暂时无法打开确认，请重试", icon: "none" }),
    });
  },

  copyAnswer(event: WechatMiniprogram.TouchEvent) {
    const message = this.controller?.state.messages.find((item) => item.id === event.currentTarget.dataset.messageId);
    if (message?.role !== "answer" || !message.text) return;
    wx.setClipboardData({
      data: message.text,
      success: () => wx.showToast({ title: "回答已复制", icon: "success" }),
      fail: () => wx.showToast({ title: "复制失败，请重试", icon: "none" }),
    });
  },

  openSource(event: WechatMiniprogram.TouchEvent) {
    const message = this.controller?.state.messages.find((item) => item.id === event.currentTarget.dataset.messageId);
    const source = message?.sources[Number(event.currentTarget.dataset.index)];
    if (!source) return;
    this.setData({ inputFocused: false });
    wx.hideKeyboard({});
    wx.navigateTo({
      url: "/pages/detail/index?citation=1",
      success: ({ eventChannel }) => eventChannel.emit("citation", source),
      fail: () => wx.showToast({ title: "暂时无法打开引用，请重试", icon: "none" }),
    });
  },

  onScroll(event: WechatMiniprogram.CustomEvent<{ scrollTop: number; scrollHeight: number }>) {
    if (this.viewportHeight <= 0) return;
    const nearBottom = event.detail.scrollHeight - event.detail.scrollTop - this.viewportHeight <= 64;
    if (event.detail.scrollTop < this.scrollTop - 1) this.followLatest = nearBottom;
    else if (nearBottom) this.followLatest = true;
    this.scrollTop = event.detail.scrollTop;
    if (this.data.showLatest === this.followLatest) this.setData({ showLatest: !this.followLatest });
  },

  returnLatest() {
    this.followLatest = true;
    this.windowEnd = 0;
    this.setData({ showLatest: false });
    // Re-render trims the window back to the latest slice and scrolls.
    if (this.controller) this.renderState(this.controller.state);
    else this.scrollLatest();
  },

  scrollLatest() {
    this.tail = !this.tail;
    this.setData({ scrollTarget: this.tail ? "conversation-end-a" : "conversation-end-b" });
  },

  readWindow() {
    const info = wx.getWindowInfo();
    this.windowHeight = info.windowHeight;
    // Native navigation and tab bar already own their safe areas.
    this.bottomChrome = Math.max(0, info.screenHeight - info.screenTop - info.windowHeight);
    this.layoutKeyboard();
  },

  onKeyboardHeight(event: WechatMiniprogram.CustomEvent<{ height: number }>) {
    this.keyboardHeight = Math.max(0, event.detail.height || 0);
    this.layoutKeyboard();
  },

  onInputFocus(event: WechatMiniprogram.CustomEvent<{ height?: number }>) {
    this.setData({ inputFocused: true });
    if (event.detail.height !== undefined) {
      this.keyboardHeight = Math.max(0, event.detail.height);
      this.layoutKeyboard();
    }
  },

  onInputBlur() {
    this.keyboardHeight = 0;
    this.setData({ inputFocused: false });
    this.layoutKeyboard();
  },

  layoutKeyboard() {
    const coveredHeight = Math.max(0, this.keyboardHeight - this.bottomChrome);
    this.setData({
      screenHeight: Math.max(0, this.windowHeight - coveredHeight),
      keyboardOpen: this.keyboardHeight > 0,
    }, () => this.measureConversation());
  },

  measureConversation() {
    if (!this.visible) return;
    wx.createSelectorQuery().in(this).select("#conversation").boundingClientRect((rect) => {
      if (!this.visible || !rect || Array.isArray(rect)) return;
      this.viewportHeight = rect.height;
      if (this.followLatest && this.data.messages.length > 0) this.scrollLatest();
    }).exec();
  },
});
