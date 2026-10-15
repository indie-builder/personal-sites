import { __toESM } from "../_runtime.mjs";
import { ArraySchema, Boolean, NullOr, Number, String, Struct, catch_, check, decodeUnknownResult, fail, isFailure$1 as isFailure, isFinite, isGreaterThanOrEqualTo, isMinLength, mutable, runPromise, succeed, timeoutOrElse } from "../_libs/effect.mjs";
import { aiNewsListRowSchema, curationListItemSchema, io } from "./open-source-D3tVDeeh.mjs";
import { require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/use-stream-feed-D1pTdTD6.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var MAX_SNAPSHOT_ITEMS = 400;
var SNAPSHOT_TTL_MS = 18e5;
/**
* 同一套快照约定的工厂：写入前截断条数；读取时校验结构，且只在快照首条与当前
* SSR 首条 id 一致（数据集没变）且未过期时返回，其余情况一律返回 null。
*/
function createStreamSnapshot(config) {
	return {
		to(state, now = Date.now()) {
			return {
				...state,
				items: state.items.slice(0, MAX_SNAPSHOT_ITEMS),
				savedAt: now
			};
		},
		from(raw, headId, now = Date.now()) {
			if (!raw || !headId) return null;
			try {
				const parsed = decodeUnknownResult(config.schema)(JSON.parse(raw));
				if (isFailure(parsed)) return null;
				const snapshot = parsed.success;
				if (snapshot.items[0].id !== headId) return null;
				if (now - snapshot.savedAt > SNAPSHOT_TTL_MS) return null;
				return snapshot;
			} catch {
				return null;
			}
		},
		write(snapshot, storageKey = config.storageKey) {
			try {
				window.sessionStorage.setItem(storageKey, JSON.stringify(snapshot));
			} catch {}
		},
		read(headId, storageKey = config.storageKey) {
			try {
				return this.from(window.sessionStorage.getItem(storageKey), headId);
			} catch {
				return null;
			}
		}
	};
}
var aiNewsStreamSnapshot = createStreamSnapshot({
	schema: Struct({
		activeCategory: NullOr(String),
		hasMore: Boolean,
		items: ArraySchema(aiNewsListRowSchema).pipe(mutable).check(isMinLength(1)),
		savedAt: Number.check(isFinite()),
		scrollTop: Number.check(isFinite()).pipe(check(isGreaterThanOrEqualTo(0)))
	}),
	storageKey: "ai-news-stream-v1"
});
var curationStreamSnapshot = createStreamSnapshot({
	schema: Struct({
		hasMore: Boolean,
		items: ArraySchema(curationListItemSchema).pipe(mutable).check(isMinLength(1)),
		savedAt: Number.check(isFinite()),
		scrollTop: Number.check(isFinite()).pipe(check(isGreaterThanOrEqualTo(0)))
	}),
	storageKey: "curation-stream-v1"
});
function getCurationScrollTarget(stream) {
	const feed = stream.closest(".curation-home__feed");
	if (feed instanceof HTMLElement && ["auto", "scroll"].includes(getComputedStyle(feed).overflowY)) return feed;
	return window;
}
/**
* Places a sentinel right after the stream and invokes `onNearEnd` whenever it
* intersects the scroll target (expanded by `threshold` pixels at the bottom).
* IntersectionObserver fires an initial callback on `observe`, so short pages
* that do not fill the scroll target trigger `onNearEnd` immediately.
* Returns a cleanup function that disconnects the observer and removes the sentinel.
*/
function observeCurationScrollEnd(stream, onNearEnd, threshold = 48) {
	const target = getCurationScrollTarget(stream);
	const sentinel = document.createElement("div");
	sentinel.setAttribute("aria-hidden", "true");
	sentinel.dataset.curationScrollSentinel = "";
	stream.after(sentinel);
	const observer = new IntersectionObserver((entries) => {
		if (entries.some((entry) => entry.isIntersecting)) onNearEnd();
	}, {
		root: target instanceof HTMLElement ? target : null,
		rootMargin: `0px 0px ${threshold}px 0px`
	});
	observer.observe(sentinel);
	return () => {
		observer.disconnect();
		sentinel.remove();
	};
}
/** 加载更多的请求上限；超时后走可重试的兜底提示，不让骨架无限转下去。 */
var STREAM_FETCH_TIMEOUT_MS = 1e4;
/**
* 请求下一页流数据。成功返回分页负载；失败返回面向访客的错误文案：
* 只有服务端 JSON 里明确给出的非空 error 才原样展示，网络中断、超时或网关
* 返回的 HTML 错误页（json() 抛 SyntaxError）一律回落到兜底提示。
* 形状非法的 2xx 响应（items 非数组、hasMore 缺失）与失败同权回落，
* 避免 updater 里的 TypeError 逃逸出错误 UI。
*/
function requestStreamPage(url, fallbackError) {
	return io("feed.page", async (signal) => {
		const response = await fetch(url, { signal });
		const payload = await response.json().catch(() => null);
		if (!response.ok) return typeof payload?.error === "string" && payload.error ? payload.error : fallbackError;
		if (payload === null || !Array.isArray(payload.items) || typeof payload.hasMore !== "boolean") return fallbackError;
		return payload;
	}).pipe(timeoutOrElse({
		duration: STREAM_FETCH_TIMEOUT_MS,
		orElse: () => fail(new Error(fallbackError))
	}), catch_(() => succeed(fallbackError)));
}
/**
* 流式列表的公共机制：无限滚动加载更多（按 id 去重）、滚动位置跟踪，
* 以及「详情页返回还原」的会话快照（写入门闩 + 一次性恢复 + 卸载兜底写）。
* 组件只保留各自的渲染逻辑。
*/
function useStreamFeed({ apiPath, pageSize, loadErrorMessage, initialHasMore, initialItems, snapshotHeadId, snapshot, snapshotExtra, onSnapshotRestore, storageKey }) {
	const [items, setItems] = (0, import_react.useState)(initialItems);
	const [appendStart, setAppendStart] = (0, import_react.useState)(initialItems.length);
	const [hasMore, setHasMore] = (0, import_react.useState)(initialHasMore);
	const [isLoading, setIsLoading] = (0, import_react.useState)(false);
	const [loadError, setLoadError] = (0, import_react.useState)(null);
	const [restored, setRestored] = (0, import_react.useState)(false);
	const streamRef = (0, import_react.useRef)(null);
	const scrollTopRef = (0, import_react.useRef)(0);
	const restoreScrollTopRef = (0, import_react.useRef)(0);
	const writesEnabledRef = (0, import_react.useRef)(false);
	const latestRef = (0, import_react.useRef)({
		hasMore,
		items
	});
	const extraRef = (0, import_react.useRef)(snapshotExtra);
	extraRef.current = snapshotExtra;
	(0, import_react.useLayoutEffect)(() => {
		const enableWrites = window.setTimeout(() => {
			writesEnabledRef.current = true;
		}, 0);
		const feedSnapshot = snapshot.read(snapshotHeadId ?? initialItems[0]?.id, storageKey);
		if (feedSnapshot) {
			restoreScrollTopRef.current = feedSnapshot.scrollTop;
			scrollTopRef.current = feedSnapshot.scrollTop;
			setItems(feedSnapshot.items);
			setHasMore(feedSnapshot.hasMore);
			setAppendStart(feedSnapshot.items.length);
			onSnapshotRestore?.(feedSnapshot);
			setRestored(true);
		}
		return () => window.clearTimeout(enableWrites);
	}, []);
	(0, import_react.useLayoutEffect)(() => {
		if (!restored) return;
		const stream = streamRef.current;
		if (!stream) return;
		getCurationScrollTarget(stream).scrollTo({
			behavior: "auto",
			top: restoreScrollTopRef.current
		});
	}, [restored]);
	(0, import_react.useEffect)(() => {
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
	const toSnapshot = (state) => snapshot.to({
		...extraRef.current?.() ?? {},
		...state
	});
	(0, import_react.useEffect)(() => {
		latestRef.current = {
			hasMore,
			items
		};
		if (!writesEnabledRef.current || items.length === 0) return;
		snapshot.write(toSnapshot({
			hasMore,
			items,
			scrollTop: scrollTopRef.current
		}), storageKey);
	}, [
		hasMore,
		items,
		snapshot,
		storageKey
	]);
	(0, import_react.useEffect)(() => () => {
		if (!writesEnabledRef.current) return;
		const latest = latestRef.current;
		if (latest.items.length === 0) return;
		snapshot.write(toSnapshot({
			...latest,
			scrollTop: scrollTopRef.current
		}), storageKey);
	}, [snapshot, storageKey]);
	const loadMore = (0, import_react.useCallback)(async () => {
		if (isLoading || !hasMore) return;
		setIsLoading(true);
		setLoadError(null);
		setAppendStart(items.length);
		try {
			const page = await runPromise(requestStreamPage(`${apiPath}${apiPath.includes("?") ? "&" : "?"}offset=${items.length}&limit=${pageSize}`, loadErrorMessage));
			if (typeof page === "string") {
				setLoadError(page);
				return;
			}
			setItems((currentItems) => {
				const knownIds = new Set(currentItems.map((item) => item.id));
				return [...currentItems, ...page.items.filter((item) => !knownIds.has(item.id))];
			});
			setHasMore(page.hasMore);
		} finally {
			setIsLoading(false);
		}
	}, [
		apiPath,
		hasMore,
		isLoading,
		items.length,
		loadErrorMessage,
		pageSize
	]);
	(0, import_react.useEffect)(() => {
		const stream = streamRef.current;
		if (!hasMore || loadError || !stream) return;
		return observeCurationScrollEnd(stream, () => void loadMore());
	}, [
		hasMore,
		loadError,
		loadMore
	]);
	return {
		appendStart,
		hasMore,
		isLoading,
		items,
		loadError,
		loadMore,
		streamRef
	};
}
//#endregion
export { aiNewsStreamSnapshot, curationStreamSnapshot, getCurationScrollTarget, useStreamFeed };
