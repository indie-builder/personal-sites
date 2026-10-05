import { Result, Schema } from "effect";

import { aiNewsListRowSchema } from "@/lib/ai-news-types";
import { curationListItemSchema } from "@/lib/curation-types";

/*
 * 流式列表的会话快照：从详情页返回列表时，恢复已加载的分页与滚动位置。
 * 桌面端真正滚动的是 .curation-home__feed 自定义容器，Next 的滚动恢复只管 window，
 * 分页数据又只在组件 state 里——所以快照同时保存两者，用 sessionStorage 随会话消亡。
 */
type StreamSnapshot = {
  hasMore: boolean;
  items: { id: string }[];
  savedAt: number;
  scrollTop: number;
};

// 只保留最近这么多条：足够覆盖几次「加载更多」，又不至于撑爆 sessionStorage。
const MAX_SNAPSHOT_ITEMS = 400;
// 快照有效期：超过这个时间即使首条 id 一致也不再恢复，隔太久的会话从头看更合理。
const SNAPSHOT_TTL_MS = 30 * 60 * 1000;

/**
 * 同一套快照约定的工厂：写入前截断条数；读取时校验结构，且只在快照首条与当前
 * SSR 首条 id 一致（数据集没变）且未过期时返回，其余情况一律返回 null。
 */
function createStreamSnapshot<Snapshot extends StreamSnapshot, Encoded>(config: {
  schema: Schema.Codec<Snapshot, Encoded>;
  storageKey: string;
}) {
  return {
    to(state: Omit<Snapshot, "savedAt">, now = Date.now()): Snapshot {
      return { ...state, items: state.items.slice(0, MAX_SNAPSHOT_ITEMS), savedAt: now } as Snapshot;
    },
    from(raw: string | null, headId: string | undefined, now = Date.now()): Snapshot | null {
      if (!raw || !headId) return null;
      try {
        const parsed = Schema.decodeUnknownResult(config.schema)(JSON.parse(raw));
        if (Result.isFailure(parsed)) return null;
        const snapshot = parsed.success;
        if (snapshot.items[0].id !== headId) return null;
        if (now - snapshot.savedAt > SNAPSHOT_TTL_MS) return null;
        return snapshot;
      } catch {
        return null;
      }
    },
    write(snapshot: Snapshot, storageKey = config.storageKey) {
      try {
        window.sessionStorage.setItem(storageKey, JSON.stringify(snapshot));
      } catch {
        // 隐私模式或配额满时静默放弃，快照只是体验增强。
      }
    },
    read(headId: string | undefined, storageKey = config.storageKey): Snapshot | null {
      try {
        return this.from(window.sessionStorage.getItem(storageKey), headId);
      } catch {
        return null;
      }
    },
  };
}

// —— 每日动态 ——

const aiNewsStreamSnapshotSchema = Schema.Struct({
  activeCategory: Schema.NullOr(Schema.String),
  hasMore: Schema.Boolean,
  items: Schema.Array(aiNewsListRowSchema).pipe(Schema.mutable).check(Schema.isMinLength(1)),
  savedAt: Schema.Number.check(Schema.isFinite()),
  scrollTop: Schema.Number.check(Schema.isFinite()).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
});

export const aiNewsStreamSnapshot = createStreamSnapshot({
  schema: aiNewsStreamSnapshotSchema,
  storageKey: "ai-news-stream-v1",
});

// —— 剪报簿（每日关注 / 设计收藏 / 抖音收藏共用条目结构，仅存储 key 不同）——

const curationStreamSnapshotSchema = Schema.Struct({
  hasMore: Schema.Boolean,
  items: Schema.Array(curationListItemSchema).pipe(Schema.mutable).check(Schema.isMinLength(1)),
  savedAt: Schema.Number.check(Schema.isFinite()),
  scrollTop: Schema.Number.check(Schema.isFinite()).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
});

export const curationStreamSnapshot = createStreamSnapshot({
  schema: curationStreamSnapshotSchema,
  storageKey: "curation-stream-v1",
});
