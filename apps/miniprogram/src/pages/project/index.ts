import { copyLink, externalUrl, run } from "../../lib/runtime";
import { getSite, getTools, projectKind, projectTitle, type Project, type Site, type Tools } from "../../portfolio/api";

Page({
  data: {
    kind: "tools" as Project,
    title: "设计工程工具",
    categories: [] as (typeof Tools.Type)["categories"],
    site: null as Site | null,
    loading: false,
    loaded: false,
    error: "",
    invalid: false,
    failedImages: {} as Record<string, boolean>,
    videoFailed: false,
    videoMounted: true,
  },
  cancel: undefined as (() => void) | undefined,
  generation: 0,
  onLoad(options: Record<string, string | undefined>) {
    const kind = projectKind(options.kind);
    if (!kind) {
      this.setData({ invalid: true, error: "项目链接无效，请返回作品集重新打开。" });
      return;
    }
    const title = projectTitle(kind);
    this.setData({ kind, title });
    wx.setNavigationBarTitle({ title });
    this.loadContent();
  },
  onUnload() { this.generation += 1; this.cancel?.(); },
  onHide() { if (this.data.kind === "site") wx.createVideoContext("site-video", this).pause(); },
  onPullDownRefresh() { this.loadContent(); },
  loadContent() {
    if (this.data.invalid) { wx.stopPullDownRefresh(); return; }
    this.cancel?.();
    const generation = ++this.generation;
    const kind = this.data.kind;
    this.setData({ loading: true, error: "" });
    const finish = () => {
      if (generation !== this.generation) return false;
      this.setData({ loading: false });
      wx.stopPullDownRefresh();
      return true;
    };
    const failure = () => {
      if (finish()) this.setData({ error: kind === "tools" ? "暂时无法读取工具目录，请重试。" : "暂时无法读取网站介绍，请重试。" });
    };
    if (kind === "tools") {
      this.cancel = run(getTools(), (result) => {
        if (finish()) this.setData({ loaded: true, failedImages: {}, categories: result.categories.map((category) => ({
          ...category, tools: category.tools.map((tool) => ({ ...tool, url: externalUrl(tool.url), icon: externalUrl(tool.icon) })),
        })) });
      }, failure);
    } else {
      this.cancel = run(getSite(), (result) => {
        if (finish()) this.setData({
          loaded: true, videoFailed: false, failedImages: {},
          site: { ...result, video: externalUrl(result.video), poster: externalUrl(result.poster), website: externalUrl(result.website) },
        });
      }, failure);
    }
  },
  copyUrl(event: WechatMiniprogram.TouchEvent) { copyLink(String(event.currentTarget.dataset.url ?? "")); },
  imageFailed(event: WechatMiniprogram.CustomEvent) {
    this.setData({ failedImages: { ...this.data.failedImages, [String(event.currentTarget.dataset.id ?? "")]: true } });
  },
  videoFailed() { this.setData({ videoFailed: true }); },
  retryVideo() {
    this.setData({ videoMounted: false }, () => this.setData({ videoMounted: true, videoFailed: false }));
  },
  onShareAppMessage() {
    return { title: this.data.title, path: this.data.invalid ? "/pages/portfolio/index" : `/pages/project/index?kind=${this.data.kind}` };
  },
});
