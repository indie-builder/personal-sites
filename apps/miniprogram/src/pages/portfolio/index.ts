import { externalUrl, run } from "../../lib/runtime";
import { getProducts, productDestination, projectPath, type Product } from "../../portfolio/api";

Page({
  data: {
    products: [] as Product[],
    loading: false,
    loaded: false,
    error: "",
    failedImages: {} as Record<string, boolean>,
  },
  cancel: undefined as (() => void) | undefined,
  generation: 0,
  onLoad() { this.loadContent(); },
  onUnload() { this.generation += 1; this.cancel?.(); },
  onPullDownRefresh() { this.loadContent(); },
  loadContent() {
    this.cancel?.();
    const generation = ++this.generation;
    this.setData({ loading: true, error: "" });
    const finish = () => {
      if (generation !== this.generation) return false;
      this.setData({ loading: false });
      wx.stopPullDownRefresh();
      return true;
    };
    this.cancel = run(getProducts(), (products) => {
      // A successful refresh clears failure flags so covers can load again.
      if (finish()) this.setData({
        products: products.map((product) => ({ ...product, cover: externalUrl(product.cover) })),
        loaded: true, failedImages: {},
      });
    }, () => {
      if (finish()) this.setData({ error: "暂时无法读取作品集，请重试。" });
    });
  },
  openProduct(event: WechatMiniprogram.TouchEvent) {
    const destination = productDestination(String(event.currentTarget.dataset.id ?? ""));
    if (!destination) return;
    if (destination === "layouts" || destination === "muse") {
      wx.navigateTo({ url: `/pages/collection/index?collection=${destination}` });
      return;
    }
    wx.navigateTo({ url: projectPath(destination) });
  },
  imageFailed(event: WechatMiniprogram.CustomEvent) {
    const id = String(event.currentTarget.dataset.id ?? "");
    this.setData({ [`failedImages.${id}`]: true });
  },
  onShareAppMessage() { return { title: "陈远的作品集", path: "/pages/portfolio/index" }; },
});
