"use client";

import { useHasMounted } from "@/components/use-mounted";
import { formatAiNewsRelativeTime } from "@/lib/ai-news-types";

/** 静态详情页的相对时间：服务端渲染为空态，水合后再计算，避免缓存页里的时间过期。 */
export function AiNewsRelativeTime({ publishedAt }: { publishedAt: string | null }) {
  const mounted = useHasMounted();
  if (!mounted) return null;
  const label = formatAiNewsRelativeTime(publishedAt);
  return label ? <span>{label}</span> : null;
}
