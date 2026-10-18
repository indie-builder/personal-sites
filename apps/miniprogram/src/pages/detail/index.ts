import { copyLink, detailFor, externalUrl, markdown, previewImages, run, scopes, sections, takeRow, type Detail, type FeedRow, type Section } from "../../lib/runtime";

type MediaView = Detail["media"][number] & { index: number; imageError: boolean; videoError: boolean; videoHeight: number };
type DetailData = {
  loading: boolean;
  retryable: boolean;
  error: string;
  citation: boolean;
  title: string;
  meta: string;
  summary: string;
  reason: string;
  text: string;
  nodes: ReturnType<typeof markdown>;
  tagsText: string;
  media: MediaView[];
  photos: MediaView[];
  videos: MediaView[];
  gridHeight: number;
  sourceUrl: string;
  websiteUrl: string;
};
type DetailMethods = {
  _active: boolean;
  _section: Section | undefined;
  _id: string;
  _row: FeedRow | undefined;
  _cancel: (() => void) | undefined;
  _channel: ReturnType<WechatMiniprogram.Page.TrivialInstance["getOpenerEventChannel"]> | undefined;
  _citationListener: ((source: unknown) => void) | undefined;
  _availableWidth: number;
  loadDetail(): void;
  readCitation(source: unknown): void;
  previewImage(event: WechatMiniprogram.TouchEvent): void;
  mediaError(event: WechatMiniprogram.CustomEvent): void;
  retryMedia(event: WechatMiniprogram.TouchEvent): void;
  pauseVideos(): void;
  copySource(): void;
  copyWebsite(): void;
  copyMarkdown(): void;
  returnToFeed(): void;
  onResize(): void;
};

const MAX_READING_WIDTH = 760;

// 页面实际可用阅读宽度；媒体比例与方格尺寸都从这里推算。
function readingWidth(): number {
  try {
    const windowWidth = wx.getWindowInfo().windowWidth;
    if (Number.isFinite(windowWidth) && windowWidth > 0) return Math.max(0, Math.min(windowWidth, MAX_READING_WIDTH) - (windowWidth <= 350 ? 32 : 48));
  } catch { /* 旧基础库没有 getWindowInfo 时用常见手机宽度 */ }
  return 342;
}

function videoHeight(media: Detail["media"][number], available: number): number {
  const ratio = media.width && media.height && media.width > 0 && media.height > 0 ? media.width / media.height : 16 / 9;
  return Math.max(1, Math.round(available / ratio));
}

const gridHeight = (available: number) => Math.max(44, Math.floor((available - 12) / 3));

function mediaViews(media: Detail["media"], available: number): MediaView[] {
  const views = media.flatMap((item) => {
    const url = externalUrl(item.url);
    const video = externalUrl(item.videoUrl);
    return url || video ? [{ ...item, url, previewUrl: externalUrl(item.previewUrl), videoUrl: video }] : [];
  });
  return views.map((item, index) => ({
    ...item, index, imageError: false, videoError: false,
    videoHeight: item.videoUrl ? videoHeight(item, available) : 0,
  }));
}

const detailPage: WechatMiniprogram.Page.Options<DetailData, DetailMethods> = {
  data: { loading: true, retryable: false, error: "", citation: false, title: "", meta: "", summary: "", reason: "", text: "", nodes: [], tagsText: "", media: [], photos: [], videos: [], gridHeight: 44, sourceUrl: "", websiteUrl: "" },
  _active: false,
  _section: undefined,
  _id: "",
  _row: undefined,
  _cancel: undefined,
  _channel: undefined,
  _citationListener: undefined,
  _availableWidth: 342,

  onLoad(query) {
    this._active = true;
    this._availableWidth = readingWidth();
    this.setData({ gridHeight: gridHeight(this._availableWidth) });
    if (query.citation === "1") {
      this.setData({ citation: true, loading: false, error: "引用资料未能读取，请返回对话后重新打开。" });
      this._channel = this.getOpenerEventChannel();
      this._citationListener = (source) => this.readCitation(source);
      this._channel.on?.("citation", this._citationListener);
      return;
    }
    this._section = sections.find((section) => section.id === query.section)?.id;
    this._id = query.id ?? "";
    if (!this._section || !this._id) {
      this.setData({ loading: false, error: "详情链接不完整，请返回动态重新选择内容。" });
      return;
    }
    this._row = takeRow(this._section, this._id);
    this.loadDetail();
  },

  onReady() {
    wx.setNavigationBarTitle({ title: this.data.citation ? "引用资料" : "阅读详情" });
  },

  loadDetail() {
    if (!this._active || !this._section || !this._id || this.data.citation) return;
    this._cancel?.();
    this.setData({ loading: true, retryable: true, error: "" });
    this._cancel = run(detailFor(this._section, this._id, this._row), (detail) => {
      if (!this._active) return;
      const summary = detail.summary.trim() !== detail.title.trim() ? detail.summary : "";
      const text = detail.text.trim() !== detail.title.trim() && detail.text.trim() !== detail.summary.trim() ? detail.text : "";
      const media = mediaViews(detail.media, this._availableWidth);
      this.setData({
        loading: false,
        error: "",
        title: detail.title,
        meta: detail.meta,
        summary,
        reason: detail.reason,
        text,
        nodes: markdown(text),
        tagsText: detail.tags.join(" · "),
        media,
        photos: media.filter((item) => !item.videoUrl),
        videos: media.filter((item) => item.videoUrl),
        sourceUrl: externalUrl(detail.sourceUrl),
        websiteUrl: externalUrl(detail.websiteUrl),
      });
    }, (error) => {
      if (!this._active) return;
      this.setData({ loading: false, error: error instanceof Error ? error.message : "内容暂时无法读取，请重试。" });
    });
  },

  readCitation(source) {
    if (!this._active) return;
    if (!source || typeof source !== "object" || !("title" in source) || typeof source.title !== "string" || !("content" in source) || typeof source.content !== "string" || !("sourceUrl" in source) || typeof source.sourceUrl !== "string" || !("scope" in source) || typeof source.scope !== "string") {
      this.setData({ loading: false, error: "引用资料格式异常，请返回对话后重试。" });
      return;
    }
    const section = "section" in source && typeof source.section === "string" ? sections.find((item) => item.id === source.section) : undefined;
    const scopeLabel = section?.label ?? scopes.find((scope) => scope.id === source.scope)?.label ?? "公开资料";
    const date = "publishedAt" in source && typeof source.publishedAt === "string" ? source.publishedAt.slice(0, 10) : "";
    this.setData({
      loading: false,
      error: "",
      title: source.title || "引用资料",
      meta: `${scopeLabel}${date ? ` · ${date}` : ""}`,
      text: source.content,
      nodes: markdown(source.content),
      sourceUrl: externalUrl(source.sourceUrl),
    });
  },

  previewImage(event) {
    const media = this.data.media[Number(event.currentTarget.dataset.index)];
    if (!media || media.videoUrl) return;
    previewImages(this.data.photos.map((item) => item.url), media.url);
  },

  mediaError(event) {
    const index = Number(event.currentTarget.dataset.index);
    const media = this.data.media[index];
    if (!media) return;
    this.setData({ [`media[${index}].${media.videoUrl ? "videoError" : "imageError"}`]: true });
  },

  retryMedia(event) {
    const index = Number(event.currentTarget.dataset.index);
    const media = this.data.media[index];
    if (!media) return;
    this.setData({ [`media[${index}].videoError`]: false, [`media[${index}].imageError`]: false });
  },

  pauseVideos() {
    this.data.media.forEach((media, index) => {
      if (media.videoUrl) wx.createVideoContext(`detail-video-${index}`, this).pause();
    });
  },

  // 横竖屏切换后重算视频高度与方格边长，不重新请求内容。
  onResize() {
    const available = readingWidth();
    if (available === this._availableWidth) return;
    this._availableWidth = available;
    const patch: Record<string, unknown> = { gridHeight: gridHeight(available) };
    this.data.media.forEach((item, index) => {
      if (item.videoUrl) patch[`media[${index}].videoHeight`] = videoHeight(item, available);
    });
    this.setData(patch);
  },

  onHide() {
    this.pauseVideos();
  },

  onUnload() {
    this._active = false;
    this._cancel?.();
    this.pauseVideos();
    if (this._citationListener) this._channel?.off?.("citation", this._citationListener);
    this._channel = undefined;
    this._citationListener = undefined;
  },

  copySource() { copyLink(this.data.sourceUrl); },
  copyWebsite() { copyLink(this.data.websiteUrl); },

  copyMarkdown() {
    const data = this.data;
    const content = [
      `# ${data.title}`,
      data.meta,
      data.summary,
      data.text,
      data.reason ? `## 推荐理由\n\n${data.reason}` : "",
      data.tagsText,
      data.sourceUrl ? `原文：${data.sourceUrl}` : "",
    ].filter(Boolean).join("\n\n");
    wx.setClipboardData({ data: content, success: () => wx.showToast({ title: "正文已复制", icon: "success" }), fail: () => wx.showToast({ title: "复制失败，请重试", icon: "none" }) });
  },

  returnToFeed() {
    wx.switchTab({ url: "/pages/home/index", fail: () => wx.showToast({ title: "页面未能打开，请重试", icon: "none" }) });
  },

  onShareAppMessage() {
    const section = this._section ?? "ai-news";
    return {
      title: this.data.title || "陈远小站",
      path: !this.data.citation && section === "ai-news" && this._id
        ? `/pages/detail/index?section=ai-news&id=${encodeURIComponent(this._id)}`
        : `/pages/home/index?section=${section}`,
    };
  },
};

Page(detailPage);
