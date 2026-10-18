import { createFeed, profile, run, sections, stashRow, type FeedState, type Section } from "../../lib/runtime";

type FeedView = Omit<FeedState, "items"> & { items: Omit<FeedState["items"][number], "raw">[] };
type FeedController = ReturnType<typeof createFeed>;
type LoadMode = "initial" | "more" | "refresh";
type HomeData = {
  sections: typeof sections;
  sectionLabels: string[];
  section: Section;
  sectionIndex: number;
  sectionLabel: string;
  feeds: Record<Section, FeedView>;
};
type HomeMethods = {
  _active: boolean;
  _controllers: Partial<Record<Section, FeedController>>;
  _cancels: Partial<Record<Section, () => void>>;
  _loadModes: Partial<Record<Section, LoadMode>>;
  _positions: Partial<Record<Section, number>>;
  _scrollTop: number;
  _scrollToken: number;
  _switching: boolean;
  loadFeed(mode?: LoadMode): void;
  selectSection(event: WechatMiniprogram.TouchEvent): void;
  selectSectionIndex(event: WechatMiniprogram.CustomEvent<{ value: string }>): void;
  activate(id: string | undefined): void;
  onPageScroll(options: WechatMiniprogram.Page.IPageScrollOption): void;
  openDetail(event: WechatMiniprogram.TouchEvent): void;
  openAbout(): void;
  retry(): void;
};

function emptyFeed(): FeedView {
  return { items: [], loading: false, refreshing: false, hasMore: true, error: "", loaded: false };
}

const homePage: WechatMiniprogram.Page.Options<HomeData, HomeMethods> = {
  data: {
    sections,
    sectionLabels: sections.map((section) => section.label),
    section: "ai-news",
    sectionIndex: 0,
    sectionLabel: sections[0]?.label ?? "每日动态",
    feeds: { "ai-news": emptyFeed(), curation: emptyFeed(), design: emptyFeed(), douyin: emptyFeed(), "open-source": emptyFeed() },
  },
  _active: false,
  _controllers: {},
  _cancels: {},
  _loadModes: {},
  _positions: {},
  _scrollTop: 0,
  _scrollToken: 0,
  _switching: false,

  onLoad(query) {
    this._active = true;
    this._controllers = {};
    this._cancels = {};
    this._loadModes = {};
    this._positions = {};
    this._scrollTop = 0;
    this._scrollToken = 0;
    this._switching = false;
    const selected = sections.find((section) => section.id === query.section) ?? sections[0];
    if (selected) this.setData({ section: selected.id, sectionIndex: sections.indexOf(selected), sectionLabel: selected.label });
    this.loadFeed();
  },

  loadFeed(mode = "initial") {
    if (!this._active) return;
    const section = this.data.section;
    const feed = this._controllers[section] ?? createFeed(section, (state) => {
      if (!this._active) return;
      const view: FeedView = {
        ...state,
        items: state.items.map(({ id, title, summary, meta, date, thumbnail }) => ({ id, title, summary, meta, date, thumbnail })),
      };
      this.setData({ [`feeds.${section}`]: view });
    });
    this._controllers[section] = feed;
    if (feed.state.loading || feed.state.refreshing || (mode === "initial" && feed.state.loaded) || (mode === "more" && !feed.state.hasMore && !feed.state.error)) {
      if (mode === "refresh") wx.stopPullDownRefresh();
      return;
    }
    this._loadModes[section] = mode;
    this._cancels[section] = run(feed.load(mode), () => {
      delete this._cancels[section];
      if (mode === "refresh") wx.stopPullDownRefresh();
    });
  },

  selectSection(event) {
    this.activate(event.currentTarget.dataset.section);
  },

  selectSectionIndex(event) {
    this.activate(sections[Number(event.detail.value)]?.id);
  },

  activate(id) {
    const selected = sections.find((section) => section.id === id);
    if (!selected || selected.id === this.data.section) return;
    if (!this._switching) this._positions[this.data.section] = this._scrollTop;
    const position = this._positions[selected.id] ?? 0;
    // 切换期间的滚动事件来自旧栏目或本次恢复，写入会污染目标栏目的阅读位置。
    const token = ++this._scrollToken;
    this._scrollTop = position;
    this._switching = true;
    const settle = () => {
      if (token !== this._scrollToken) return;
      this._scrollTop = position;
      this._switching = false;
    };
    this.setData({ section: selected.id, sectionIndex: sections.indexOf(selected), sectionLabel: selected.label }, () => {
      if (!this._active || token !== this._scrollToken) return;
      wx.pageScrollTo({ scrollTop: position, duration: 0, complete: settle, fail: settle });
    });
    if (!this._controllers[selected.id]?.state.error) this.loadFeed();
  },

  onPageScroll(event) {
    if (this._switching) return;
    this._scrollTop = event.scrollTop;
    this._positions[this.data.section] = event.scrollTop;
  },

  onPullDownRefresh() {
    this.loadFeed("refresh");
  },

  onReachBottom() {
    const state = this._controllers[this.data.section]?.state;
    if (state?.loaded && state.hasMore && !state.loading && !state.refreshing && !state.error) this.loadFeed("more");
  },

  retry() {
    this.loadFeed(this._loadModes[this.data.section] ?? "initial");
  },

  openDetail(event) {
    const section = this.data.section;
    const row = this._controllers[section]?.state.items.find((item) => item.id === event.currentTarget.dataset.id);
    if (!row) {
      wx.showToast({ title: "内容已更新，请刷新后重试", icon: "none" });
      return;
    }
    stashRow(section, row);
    wx.navigateTo({
      url: `/pages/detail/index?section=${section}&id=${encodeURIComponent(row.id)}`,
      fail: () => wx.showToast({ title: "页面未能打开，请重试", icon: "none" }),
    });
  },

  openAbout() {
    wx.switchTab({ url: "/pages/about/index", fail: () => wx.showToast({ title: "页面未能打开，请重试", icon: "none" }) });
  },

  onUnload() {
    this._active = false;
    this._switching = false;
    this._scrollToken++;
    for (const cancel of Object.values(this._cancels)) cancel?.();
    for (const feed of Object.values(this._controllers)) feed?.dispose();
    this._cancels = {};
    this._controllers = {};
    this._loadModes = {};
    this._positions = {};
    wx.stopPullDownRefresh();
  },

  onShareAppMessage() {
    return { title: `${profile.name} · ${this.data.sectionLabel}`, path: `/pages/home/index?section=${this.data.section}` };
  },
};

Page(homePage);
