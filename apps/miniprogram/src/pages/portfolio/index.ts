import { copyLink, externalUrl, run } from "../../lib/runtime";
import { getProducts, getSite, getTools, productDestination, type Product, type Site, type Tools } from "../../portfolio/api";

type Mode = "index" | "tools" | "site";

Page({
  data: {
    mode: "index" as Mode,
    products: [] as Product[],
    categories: [] as (typeof Tools.Type)["categories"],
    site: null as Site | null,
    loading: false,
    loaded: false,
    error: "",
    failedImages: {} as Record<string, boolean>,
    videoFailed: false,
    videoMounted: true,
  },
  cancel: undefined as (() => void) | undefined,
  generation: 0,
  onLoad() { this.loadContent(); },
  onUnload() { this.generation += 1; this.cancel?.(); },
  onHide() { if (this.data.mode === "site") wx.createVideoContext("site-video", this).pause(); },
  onPullDownRefresh() { this.loadContent(); },
  loadContent() {
    this.cancel?.();
    const generation = ++this.generation;
    const mode = this.data.mode;
    this.setData({ loading: true, error: "" });
    const finish = () => {
      if (generation !== this.generation) return false;
      this.setData({ loading: false });
      wx.stopPullDownRefresh();
      return true;
    };
    const failure = () => { if (finish()) this.setData({ error: "暂时无法读取作品集，请重试。" }); };
    if (mode === "tools") {
      this.cancel = run(getTools(), (result) => {
        if (finish()) this.setData({ loaded: true, categories: result.categories.map((category) => ({
          ...category, tools: category.tools.map((tool) => ({ ...tool, url: externalUrl(tool.url), icon: externalUrl(tool.icon) })),
        })) });
      }, failure);
    } else if (mode === "site") {
      this.cancel = run(getSite(), (result) => {
        if (finish()) this.setData({ loaded: true, videoFailed: false, site: {
          ...result, video: externalUrl(result.video), poster: externalUrl(result.poster), website: externalUrl(result.website),
        } });
      }, failure);
    } else {
      this.cancel = run(getProducts(), (products) => {
        if (finish()) this.setData({ products: products.map((product) => ({ ...product, cover: externalUrl(product.cover) })), loaded: true });
      }, failure);
    }
  },
  openProduct(event: WechatMiniprogram.TouchEvent) {
    const destination = productDestination(String(event.currentTarget.dataset.id ?? ""));
    if (!destination) return;
    if (destination === "layouts" || destination === "muse") {
      wx.navigateTo({ url: `/pages/collection/index?collection=${destination}` });
      return;
    }
    this.setData({ mode: destination, loaded: false, error: "" });
    wx.setNavigationBarTitle({ title: destination === "tools" ? "设计工程工具" : "个人网站" });
    this.loadContent();
  },
  backToProducts() {
    if (this.data.mode === "site") wx.createVideoContext("site-video", this).pause();
    this.generation += 1;
    this.cancel?.();
    this.setData({ mode: "index", loaded: this.data.products.length > 0, error: "", loading: false });
    wx.setNavigationBarTitle({ title: "作品集" });
    if (!this.data.products.length) this.loadContent();
  },
  copyUrl(event: WechatMiniprogram.TouchEvent) { copyLink(String(event.currentTarget.dataset.url ?? "")); },
  imageFailed(event: WechatMiniprogram.CustomEvent) {
    const id = String(event.currentTarget.dataset.id ?? "");
    this.setData({ failedImages: { ...this.data.failedImages, [id]: true } });
  },
  videoFailed() { this.setData({ videoFailed: true }); },
  retryVideo() {
    this.setData({ videoMounted: false }, () => this.setData({ videoMounted: true, videoFailed: false }));
  },
  onShareAppMessage() { return { title: "陈远的作品集", path: "/pages/portfolio/index" }; },
});
