import { externalUrl, run } from "../../lib/runtime";
import { collectionTitle, createCollection, workReadingLimit, type Collection, type Work } from "../../portfolio/api";

Page({
  data: {
    collection: "layouts" as Collection,
    title: "布局参考",
    draft: "",
    items: [] as ReturnType<typeof createCollection>["state"]["items"],
    categories: [{ id: "", name: "全部分类", count: 0 }],
    topics: [{ id: "", name: "全部主题", count: 0 }],
    categoryIndex: 0,
    topicIndex: 0,
    total: 0,
    hasMore: true,
    loading: false,
    loaded: false,
    error: "",
    attribution: "",
    failedImages: {} as Record<string, boolean>,
    invalid: false,
  },
  controller: undefined as ReturnType<typeof createCollection> | undefined,
  cancel: undefined as (() => void) | undefined,
  lastMode: "initial" as "initial" | "more" | "refresh",
  onLoad(options: Record<string, string | undefined>) {
    if (options.collection !== "layouts" && options.collection !== "muse") {
      this.setData({ invalid: true, error: "集合链接无效，请返回作品集重新打开。" });
      return;
    }
    const collection = options.collection;
    const title = collectionTitle(collection);
    this.setData({ collection, title });
    wx.setNavigationBarTitle({ title });
    this.controller = createCollection(collection, (state) => {
      const categories = [{ id: "", name: "全部分类", count: 0 }, ...state.categories];
      const topics = [{ id: "", name: "全部主题", count: 0 }, ...state.topics];
      this.setData({
        ...state,
        items: state.items.map((item) => ({ ...item, thumbnail: externalUrl(item.thumbnail) })),
        categories, topics,
        categoryIndex: Math.max(0, categories.findIndex((category) => category.id === state.filters.cat)),
        topicIndex: Math.max(0, topics.findIndex((topic) => topic.id === state.filters.theme)),
      });
    });
    this.load("initial");
  },
  onUnload() { this.controller?.dispose(); this.cancel?.(); },
  onPullDownRefresh() { this.load("refresh"); },
  onReachBottom() {
    if (this.data.loaded && this.data.hasMore && !this.data.error) this.load("more");
  },
  load(mode: "initial" | "more" | "refresh") {
    if (!this.controller || this.controller.state.loading) { wx.stopPullDownRefresh(); return; }
    this.lastMode = mode;
    this.cancel = run(this.controller.load(mode), () => wx.stopPullDownRefresh());
  },
  retry() { this.load(this.lastMode); },
  loadMore() { this.load("more"); },
  inputQuery(event: WechatMiniprogram.Input) { this.setData({ draft: event.detail.value }); },
  search() {
    const filters = this.controller?.state.filters;
    if (filters) this.changeFilters({ ...filters, q: this.data.draft });
  },
  clearSearch() {
    this.setData({ draft: "" });
    const filters = this.controller?.state.filters;
    if (filters) this.changeFilters({ ...filters, q: "" });
  },
  selectCategory(event: WechatMiniprogram.PickerChange) {
    const category = this.data.categories[Number(event.detail.value)];
    const filters = this.controller?.state.filters;
    if (category && filters) this.changeFilters({ ...filters, cat: category.id, theme: "" });
  },
  selectTopic(event: WechatMiniprogram.PickerChange) {
    const topic = this.data.topics[Number(event.detail.value)];
    const filters = this.controller?.state.filters;
    if (topic && filters) this.changeFilters({ ...filters, theme: topic.id });
  },
  changeFilters(filters: { q: string; cat: string; theme: string }) {
    this.cancel?.();
    this.controller?.setFilters(filters);
    this.setData({ failedImages: {}, draft: this.controller?.state.filters.q ?? "" });
    this.load("initial");
  },
  openWork(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id ?? "");
    const items: readonly Work[] = this.controller?.state.items ?? [];
    const index = items.findIndex((item) => item.id === id);
    if (index < 0 || !id || id.length > 300) return;
    // shortcut: browse at most 120 loaded works; expand the handoff only if longer reading sessions need it.
    const start = Math.max(0, Math.min(index - Math.floor(workReadingLimit / 2), items.length - workReadingLimit));
    const ids = items.slice(start, start + workReadingLimit).map((item) => item.id);
    wx.navigateTo({
      url: `/pages/work/index?collection=${this.data.collection}&id=${encodeURIComponent(id)}`,
      success: ({ eventChannel }) => eventChannel.emit("workReading", { collection: this.data.collection, ids }),
    });
  },
  imageFailed(event: WechatMiniprogram.CustomEvent) {
    const id = String(event.currentTarget.dataset.id ?? "");
    this.setData({ failedImages: { ...this.data.failedImages, [id]: true } });
  },
  onShareAppMessage() {
    return { title: this.data.title, path: `/pages/collection/index?collection=${this.data.collection}` };
  },
});
