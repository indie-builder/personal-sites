import { copyLink, externalUrl, previewImages, readReducedMotion, run } from "../../lib/runtime";
import { collectionTitle, getWork, layoutAttribution, type Collection, type Work } from "../../portfolio/api";

type WorkView = Omit<Work, "media"> & { media: (Work["media"][number] & { heightRpx: number })[] };
type EntryDirection = "next" | "prev";

Page({
  data: {
    reducedMotion: false,
    contentEntering: false,
    entryDirection: "" as EntryDirection | "",
    collection: "layouts" as Collection,
    workId: "",
    item: null as WorkView | null,
    loading: false,
    error: "",
    invalid: false,
    attribution: "",
    failedMedia: {} as Record<string, boolean>,
    removedMedia: {} as Record<string, boolean>,
    readingIndex: -1,
    readingStart: 0,
    readingCount: 0,
  },
  readingIds: [] as string[],
  readingChannel: undefined as ReturnType<WechatMiniprogram.Page.TrivialInstance["getOpenerEventChannel"]> | undefined,
  readingListener: undefined as ((payload: unknown) => void) | undefined,
  cancel: undefined as (() => void) | undefined,
  generation: 0,
  // Increments on hide/show and unload so a pending entrance cannot survive a lifecycle turn.
  motionEpoch: 0,
  motionVisible: true,
  // Captured by the request that consumes it; a stale generation cannot reuse it.
  pendingEntry: undefined as EntryDirection | undefined,
  onLoad(options: Record<string, string | undefined>) {
    if ((options.collection !== "layouts" && options.collection !== "muse") || !options.id || options.id.length > 300) {
      this.setData({ invalid: true, error: "作品链接无效，请返回作品集重新打开。" });
      return;
    }
    this.setData({
      collection: options.collection,
      workId: options.id,
      attribution: options.collection === "layouts" ? layoutAttribution : "",
    });
    wx.setNavigationBarTitle({ title: collectionTitle(options.collection) });
    this.readingChannel = this.getOpenerEventChannel();
    this.readingListener = (payload: unknown) => {
      if (!payload || typeof payload !== "object" || this.readingIds.length) return;
      const { collection, ids, start } = payload as { collection?: unknown; ids?: unknown; start?: unknown };
      if (collection !== this.data.collection || !Array.isArray(ids) || !ids.length
        || !ids.every((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 300)
        || new Set(ids).size !== ids.length) return;
      const readingIndex = ids.indexOf(this.data.workId);
      const readingStart = start === undefined ? 0 : start;
      if (typeof readingStart !== "number" || !Number.isInteger(readingStart) || readingStart < 0 || readingStart >= ids.length) return;
      if (readingIndex < 0) return;
      this.readingIds = [...ids];
      this.setData({ readingIndex, readingStart, readingCount: ids.length });
    };
    this.readingChannel.on?.("workReading", this.readingListener);
    this.loadWork();
  },
  onUnload() {
    this.motionVisible = false;
    this.generation += 1;
    this.motionEpoch += 1;
    this.pendingEntry = undefined;
    this.cancel?.();
    this.pauseVideos();
    if (this.readingListener) this.readingChannel?.off?.("workReading", this.readingListener);
  },
  onShow() {
    this.motionVisible = true;
    this.pendingEntry = undefined;
    this.setData({ reducedMotion: readReducedMotion(), contentEntering: false, entryDirection: "" });
  },
  onHide() {
    this.motionVisible = false;
    this.motionEpoch += 1;
    this.pendingEntry = undefined;
    this.pauseVideos();
    this.setData({ contentEntering: false, entryDirection: "" });
  },
  // An animationend from a replaced node must not settle the entry currently on screen.
  finishContentEntry(event: WechatMiniprogram.CustomEvent) {
    if (!this.data.contentEntering || String(event.currentTarget.dataset.id ?? "") !== this.data.item?.id) return;
    this.setData({ contentEntering: false, entryDirection: "" });
  },
  pauseVideos() {
    const media = this.data.item?.media ?? [];
    for (let index = 0; index < media.length; index += 1) {
      if (media[index].kind === "video" && media[index].url && !this.data.failedMedia[media[index].id]) {
        wx.createVideoContext(`work-video-${index}`, this).pause();
      }
    }
  },
  previousWork() { this.moveWork(-1); },
  nextWork() { this.moveWork(1); },
  moveWork(delta: number) {
    if (this.data.invalid || this.data.readingIndex < 0 || (delta !== -1 && delta !== 1)) return;
    const readingIndex = this.data.readingIndex + delta;
    const workId = this.readingIds[readingIndex];
    if (!workId) return;
    this.pauseVideos();
    this.cancel?.();
    this.pendingEntry = delta === 1 ? "next" : "prev";
    this.setData({ readingIndex, workId, item: null, failedMedia: {}, removedMedia: {} });
    this.loadWork();
    wx.pageScrollTo({ scrollTop: 0, duration: 0 });
  },
  onPullDownRefresh() { this.loadWork(); },
  loadWork() {
    // Initial content keeps the original vertical entrance; only a successful adjacent move is spatial.
    const direction = this.data.item ? undefined : this.pendingEntry;
    const revealNewItem = !this.data.item;
    if (this.data.invalid) { wx.stopPullDownRefresh(); return; }
    this.cancel?.();
    this.pendingEntry = undefined;
    const generation = ++this.generation;
    const epoch = this.motionEpoch;
    this.setData({ loading: true, error: "" });
    this.cancel = run(getWork(this.data.collection, this.data.workId), (result) => {
      if (generation !== this.generation) return;
      const entering = revealNewItem && this.motionVisible && epoch === this.motionEpoch && !readReducedMotion();
      this.setData({
        loading: false, failedMedia: {}, removedMedia: {},
        contentEntering: entering,
        entryDirection: entering ? direction ?? "" : "",
        item: {
          ...result.item,
          sourceURL: externalUrl(result.item.sourceURL),
          thumbnail: externalUrl(result.item.thumbnail),
          media: result.item.media.map((media) => ({
            ...media, url: externalUrl(media.url), poster: externalUrl(media.poster),
            heightRpx: media.width > 0 && media.height > 0 ? Math.round(650 * media.height / media.width) : 488,
          })),
        },
      });
      wx.stopPullDownRefresh();
    }, () => {
      if (generation !== this.generation) return;
      this.setData({ loading: false, error: "暂时无法读取作品，请重试。" });
      wx.stopPullDownRefresh();
    });
  },
  previewImage(event: WechatMiniprogram.TouchEvent) {
    const media = this.data.item?.media;
    if (!media) return;
    previewImages(media.filter((item) => item.kind === "image").map((item) => item.url), String(event.currentTarget.dataset.url ?? ""));
  },
  mediaFailed(event: WechatMiniprogram.CustomEvent) {
    const id = String(event.currentTarget.dataset.id ?? "");
    this.setData({ failedMedia: { ...this.data.failedMedia, [id]: true } });
  },
  retryMedia(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id ?? "");
    this.setData({ removedMedia: { ...this.data.removedMedia, [id]: true } }, () => {
      this.setData({
        removedMedia: { ...this.data.removedMedia, [id]: false },
        failedMedia: { ...this.data.failedMedia, [id]: false },
      });
    });
  },
  copySource() { if (this.data.item?.sourceURL) copyLink(this.data.item.sourceURL); },
  onShareAppMessage() {
    return {
      title: this.data.item?.title || "陈远的作品集",
      path: this.data.workId && !this.data.invalid
        ? `/pages/work/index?collection=${this.data.collection}&id=${encodeURIComponent(this.data.workId)}`
        : "/pages/portfolio/index",
    };
  },
});
