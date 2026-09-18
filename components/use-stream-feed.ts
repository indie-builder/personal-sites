"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { getCurationScrollTarget, observeCurationScrollEnd } from "./curation-scroll";

export type StreamPage<Item> = {
  error?: string;
  hasMore: boolean;
  items: Item[];
};

export type StreamSnapshotState<Item, Extra> = Extra & {
  hasMore: boolean;
  items: Item[];
  scrollTop: number;
};

/** createStreamSnapshot（components/stream-snapshot.ts）实例的最小接口。 */
export interface StreamSnapshotAdapter<Item, Extra> {
  read(headId: string | undefined, storageKey?: string): (StreamSnapshotState<Item, Extra> & { savedAt: number }) | null;
  to(state: StreamSnapshotState<Item, Extra>, now?: number): object;
  write(snapshot: object, storageKey?: string): void;
}

type StreamFeedOptions<Item, Extra> = {
  /** 加载更多的分页接口。 */
  apiPath: string;
  /** 每次加载更多的条数。 */
  pageSize: number;
  /** 加载失败时的兜底提示。 */
  loadErrorMessage: string;
  initialHasMore: boolean;
  initialItems: Item[];
  snapshot: StreamSnapshotAdapter<Item, Extra>;
  /** 快照里除 items/hasMore 外还要保存的字段（如每日动态的筛选状态），每次写快照时取最新值。 */
  snapshotExtra?: () => Extra;
  /** 快照恢复时除 items/hasMore 外需要还原的组件状态。 */
  onSnapshotRestore?: (snapshot: StreamSnapshotState<Item, Extra> & { savedAt: number }) => void;
  storageKey?: string;
};

/**
 * 流式列表的公共机制：无限滚动加载更多（按 id 去重）、滚动位置跟踪，
 * 以及「详情页返回还原」的会话快照（写入门闩 + 一次性恢复 + 卸载兜底写）。
 * 组件只保留各自的渲染逻辑。
 */
export function useStreamFeed<Item extends { id: string }, Extra extends object = Record<never, never>, Element extends HTMLElement = HTMLElement>({
  apiPath,
  pageSize,
  loadErrorMessage,
  initialHasMore,
  initialItems,
  snapshot,
  snapshotExtra,
  onSnapshotRestore,
  storageKey,
}: StreamFeedOptions<Item, Extra>) {
  const [items, setItems] = useState(initialItems);
  const [appendStart, setAppendStart] = useState(initialItems.length);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // restored 是一次性开关——恢复后的重渲染提交完成、DOM 行数齐全后再落滚动位置。
  const [restored, setRestored] = useState(false);
  const streamRef = useRef<Element>(null);
  const scrollTopRef = useRef(0);
  const restoreScrollTopRef = useRef(0);
  // 快照写入门闩：挂载提交期间（含 StrictMode 重放、dev 下的重挂载）禁止写快照——
  // 否则恢复读取之前，初始 SSR 状态会先把有效快照覆盖掉。挂载落定后由宏任务开门。
  const writesEnabledRef = useRef(false);
  const latestRef = useRef({ hasMore, items });
  const extraRef = useRef(snapshotExtra);
  extraRef.current = snapshotExtra;

  // 仅挂载时执行：首渲染仍用 SSR 数据（无水合不一致），layout effect 里的
  // setState 会在绘制前同步重渲染，访客看不到从初始条数跳回完整列表的过程。
  useLayoutEffect(() => {
    const enableWrites = window.setTimeout(() => {
      writesEnabledRef.current = true;
    }, 0);
    const feedSnapshot = snapshot.read(initialItems[0]?.id, storageKey);
    if (feedSnapshot) {
      restoreScrollTopRef.current = feedSnapshot.scrollTop;
      scrollTopRef.current = feedSnapshot.scrollTop;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 恢复 sessionStorage 快照只能在挂载后做，layout effect 保证绘制前完成
      setItems(feedSnapshot.items);
      setHasMore(feedSnapshot.hasMore);
      // 恢复的行全部视为非追加行，不重播入场阶梯。
      setAppendStart(feedSnapshot.items.length);
      onSnapshotRestore?.(feedSnapshot);
      setRestored(true);
    }
    return () => window.clearTimeout(enableWrites);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在挂载时尝试恢复一次
  }, []);

  // 恢复后的重渲染提交完成、DOM 行数齐全后，落滚动位置。
  useLayoutEffect(() => {
    if (!restored) return;
    const stream = streamRef.current;
    if (!stream) return;
    getCurationScrollTarget(stream).scrollTo({ behavior: "auto", top: restoreScrollTopRef.current });
  }, [restored]);

  // 跟踪滚动位置（rAF 节流的被动监听）；桌面端滚动容器是 .curation-home__feed，
  // 移动端是 window，统一经 getCurationScrollTarget 取值。
  useEffect(() => {
    const stream = streamRef.current;
    if (!stream) return;
    const target = getCurationScrollTarget(stream);
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        scrollTopRef.current = target instanceof Window ? target.scrollY : target.scrollTop;
      });
    };
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      target.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const toSnapshot = (state: { hasMore: boolean; items: Item[]; scrollTop: number }) =>
    snapshot.to({ ...extraRef.current?.() ?? {} as Extra, ...state });

  // 分页变化时持久化快照；滚动位置与扩展字段在写入时从 ref 取最新值。
  useEffect(() => {
    latestRef.current = { hasMore, items };
    if (!writesEnabledRef.current || items.length === 0) return;
    snapshot.write(toSnapshot({ hasMore, items, scrollTop: scrollTopRef.current }), storageKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toSnapshot 每次渲染都重建，靠 extraRef 取最新值
  }, [hasMore, items, snapshot, storageKey]);

  // 路由离开（点进详情）时组件卸载，兜底写一次最终状态。
  useEffect(() => () => {
    if (!writesEnabledRef.current) return;
    const latest = latestRef.current;
    if (latest.items.length === 0) return;
    snapshot.write(toSnapshot({ ...latest, scrollTop: scrollTopRef.current }), storageKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 卸载只执行一次
  }, [snapshot, storageKey]);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    setLoadError(null);
    setAppendStart(items.length);
    try {
      const response = await fetch(`${apiPath}?offset=${items.length}&limit=${pageSize}`);
      const payload = (await response.json()) as StreamPage<Item>;
      if (!response.ok) throw new Error(payload.error ?? loadErrorMessage);

      setItems((currentItems) => {
        const knownIds = new Set(currentItems.map((item) => item.id));
        return [...currentItems, ...payload.items.filter((item) => !knownIds.has(item.id))];
      });
      setHasMore(payload.hasMore);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : loadErrorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [apiPath, hasMore, isLoading, items.length, loadErrorMessage, pageSize]);

  // 无限滚动：哨兵进入视口（或初始未填满滚动容器）时加载下一页。
  useEffect(() => {
    const stream = streamRef.current;
    if (!hasMore || !stream) return;

    return observeCurationScrollEnd(stream, () => void loadMore());
  }, [hasMore, loadMore]);

  return { appendStart, hasMore, isLoading, items, loadError, loadMore, setItems, streamRef };
}
