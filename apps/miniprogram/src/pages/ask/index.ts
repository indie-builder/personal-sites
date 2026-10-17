import { createAsk, markdown, run, scopes, type AskMessage, type AskScope, type AskState } from "../../lib/runtime";

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

function messageViews(messages: AskMessage[]) {
  return messages.map((message, index) => ({
    ...message,
    nodes: message.role === "answer" ? markdown(message.text) : [],
    placeholder: placeholders[message.status],
    last: index === messages.length - 1,
    sourceViews: message.sources.map((source, sourceIndex) => ({
      number: sourceIndex + 1,
      index: sourceIndex,
      title: source.title || `引用资料 ${sourceIndex + 1}`,
      meta: [source.section, source.publishedAt?.slice(0, 10)].filter(Boolean).join(" · "),
    })),
  }));
}

Page({
  data: {
    examples,
    scopeLabels: scopes.map((scope) => scope.label),
    scopeIndex: 0,
    scopeLabel: scopes[0]?.label ?? "全部公开资料",
    draft: "",
    messages: [] as ReturnType<typeof messageViews>,
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
  visible: false,
  followLatest: true,
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
  },

  renderState(state: AskState) {
    if (!this.visible) return;
    const length = state.draft.trim().length;
    const scopeIndex = Math.max(0, scopes.findIndex((scope) => scope.id === state.scope));
    this.setData({
      draft: state.draft,
      messages: messageViews(state.messages),
      streaming: state.streaming,
      error: state.error,
      scopeIndex,
      scopeLabel: scopes[scopeIndex]?.label ?? "全部公开资料",
      canSend: length >= 2 && length <= 1000 && !state.streaming,
      hasConversation: state.messages.length > 0 || state.draft.length > 0,
      inputHint: length > 1000 ? `已输入 ${length} 字，最多 1000 字` : length === 1 ? "至少输入 2 个字" : "",
    });
    if (this.followLatest && state.messages.length > 0) this.scrollLatest();
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
    this.setData({ inputFocused: true });
  },

  send() {
    if (!this.controller || !this.data.canSend) return;
    this.followLatest = true;
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
        this.setData({ pageError: "", showLatest: false, inputFocused: false });
        wx.hideKeyboard({});
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
    this.setData({ showLatest: false });
    this.scrollLatest();
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
