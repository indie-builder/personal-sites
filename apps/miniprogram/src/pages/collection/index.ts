import { externalUrl, run } from "../../lib/runtime";
import {
  collectionTitle, collectionWork, createCollection, type Category, type Collection, type CollectionWork, type Work,
} from "../../portfolio/api";

const shelfColors = ["#B94A35", "#D6C7A6", "#557477", "#D4AC49", "#465676", "#A65E47", "#707453", "#DDD5C3"];
const shelfInk = new Set([1, 3, 7]);
const shelfHeights = [182, 166, 176, 160, 172, 182, 162, 176];

type CategoryView = { id: string; name: string; count: number; number: string; color: string; ink: string; height: number };
type ViewItem = CollectionWork & { thumbnail: string; video: boolean };

const shelf = (categories: { id: string; name: string; count: number }[]): CategoryView[] =>
  categories.map((category, index) => ({
    ...category,
    number: String(index + 1).padStart(2, "0"),
    color: shelfColors[index % shelfColors.length],
    ink: shelfInk.has(index % shelfColors.length) ? "#383630" : "#ffffff",
    height: shelfHeights[index % shelfHeights.length],
  }));

Page({
  data: {
    collection: "layouts" as Collection,
    title: "布局参考",
    draft: "",
    items: [] as ViewItem[],
    shelf: [] as CategoryView[],
    shelfTotal: 0,
    // index: category shelf; grid: image-browse grid.
    view: "index" as "index" | "grid",
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
  loadedCount: 0,
  listRevision: -1,
  lastMode: "initial" as "initial" | "more" | "refresh",
  onLoad(options: Record<string, string | undefined>) {
    if (options.collection !== "layouts" && options.collection !== "muse") {
      this.setData({ invalid: true, error: "集合链接无效，请返回作品集重新打开。" });
      return;
    }
    const collection = options.collection;
    const title = collectionTitle(collection);
    this.setData({ collection, title, view: collection === "layouts" ? "index" : "grid" });
    wx.setNavigationBarTitle({ title });
    this.controller = createCollection(collection, (state) => this.render(state));
    this.load("initial");
  },
  render(state: ReturnType<typeof createCollection>["state"]) {
    const categories = [{ id: "", name: "全部分类", count: 0 }, ...state.categories];
    const topics = [{ id: "", name: "全部主题", count: 0 }, ...state.topics];
    // Bounded patch: list loads only send rows added since the last render, never the whole set.
    const reset = state.listRevision !== this.listRevision;
    this.listRevision = state.listRevision;
    const start = reset ? 0 : Math.min(this.loadedCount, state.items.length);
    this.loadedCount = state.items.length;
    const patch: Record<string, unknown> = {
      total: state.total, hasMore: state.hasMore, loading: state.loading, loaded: state.loaded,
      error: state.error, attribution: state.attribution, categories, topics,
      shelf: shelf(state.categories),
      shelfTotal: state.categories.reduce((sum, category) => sum + category.count, 0),
      categoryIndex: Math.max(0, categories.findIndex((category) => category.id === state.filters.cat)),
      topicIndex: Math.max(0, topics.findIndex((topic) => topic.id === state.filters.theme)),
    };
    for (let index = start; index < state.items.length; index += 1) {
      const item = collectionWork(state.items[index]);
      patch[`items[${index}]`] = { ...item, thumbnail: externalUrl(item.thumbnail) };
    }
    // Reset and indexed writes are separate patches so the writes land on the new empty list.
    if (reset) this.setData({ items: [] });
    this.setData(patch);
  },
  onUnload() { this.controller?.dispose(); this.cancel?.(); },
  onPullDownRefresh() { this.load("refresh"); },
  onReachBottom() {
    if (this.data.view === "grid" && this.data.loaded && this.data.hasMore && !this.data.error) this.load("more");
  },
  load(mode: "initial" | "more" | "refresh") {
    if (!this.controller || this.controller.state.loading) { wx.stopPullDownRefresh(); return; }
    this.lastMode = mode;
    this.cancel = run(this.controller.load(mode), () => {
      // A successful load clears failure flags; images may load again.
      if (!this.controller?.state.error) this.setData({ failedImages: {} });
      wx.stopPullDownRefresh();
    });
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
  openCategory(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id ?? "");
    const category = this.controller?.state.categories.find((item: Category) => item.id === id);
    if (category) this.changeFilters({ q: "", cat: category.id, theme: "" });
  },
  // The shelf and the full grid share the unfiltered page, so browsing all reuses it.
  browseAll() { this.setData({ view: "grid" }); },
  showIndex() { this.changeFilters({ q: "", cat: "", theme: "" }); },
  changeFilters(filters: { q: string; cat: string; theme: string }) {
    this.cancel?.();
    this.controller?.setFilters(filters);
    this.setData({ failedImages: {}, draft: this.controller?.state.filters.q ?? "" });
    const empty = !filters.q && !filters.cat && !filters.theme;
    this.setData({ view: empty && this.data.collection === "layouts" ? "index" : "grid" });
    this.load("initial");
  },
  openWork(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id ?? "");
    const items: readonly Work[] = this.controller?.state.items ?? [];
    const index = items.findIndex((item: Work) => item.id === id);
    if (index < 0 || !id || id.length > 300) return;
    wx.navigateTo({
      url: `/pages/work/index?collection=${this.data.collection}&id=${encodeURIComponent(id)}`,
      success: ({ eventChannel }) => eventChannel.emit("workReading", {
        collection: this.data.collection, ids: items.map((item: Work) => item.id), start: 0,
      }),
    });
  },
  // The event carries only the id; the grid renders from this view projection.
  imageFailed(event: WechatMiniprogram.CustomEvent) {
    const id = String(event.currentTarget.dataset.id ?? "");
    // Spread, not a dotted key: public work IDs are not guaranteed to be path-safe.
    this.setData({ failedImages: { ...this.data.failedImages, [id]: true } });
  },
  onShareAppMessage() {
    return { title: this.data.title, path: `/pages/collection/index?collection=${this.data.collection}` };
  },
});
