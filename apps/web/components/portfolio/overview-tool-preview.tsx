"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";

import { useVisiblePlay } from "@/lib/portfolio/motion";

import styles from "./portfolio-overview.module.css";

/** 工具目录预览：可见时轮流点亮一枚工具（源站首页同款逻辑，图标为本地资产）。 */
export function OverviewToolPreview({ tools }: { tools: { name: string; icon: string | null }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(-1);
  const timer = useRef(0);
  const onPlay = useCallback(
    (playing: boolean) => {
      window.clearTimeout(timer.current);
      if (!playing) {
        setActive(-1);
        return;
      }
      const advance = () => {
        setActive((current) => (current + 1) % tools.length);
        timer.current = window.setTimeout(advance, 1800);
      };
      advance();
    },
    [tools.length],
  );
  useVisiblePlay(ref, onPlay);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <div ref={ref} className={styles.toolGrid} aria-hidden="true">
      {tools.map((tool, index) => (
        <span data-active={index === active || undefined} key={tool.name}>
          <i>
            {tool.icon ? (
              // eslint-disable-next-line @next/next/no-img-element -- Local committed favicon assets.
              <img alt="" height={16} src={tool.icon} width={16} />
            ) : null}
            <ArrowUpRight size={16} strokeWidth={1.6} />
          </i>
          <b>{tool.name}</b>
        </span>
      ))}
    </div>
  );
}
