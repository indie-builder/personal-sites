"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Pause, Play } from "lucide-react";
import styles from "./portfolio-overview.module.css";

const PreviewPlayback = createContext(true);

type TimelinePlaybackValue = {
  activeSlug: string | null;
  playing: boolean;
  reduced: boolean;
  toggle: () => void;
};

const TimelinePlayback = createContext<TimelinePlaybackValue>({
  activeSlug: null,
  playing: true,
  reduced: false,
  toggle: () => {},
});

export function usePreviewPlayback() {
  return useContext(PreviewPlayback);
}

export function PreviewPlaybackScope({ activeSlug, children }: { activeSlug: string | null; children: ReactNode }) {
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const playing = !paused && !reduced;
  return (
    <TimelinePlayback.Provider value={{ activeSlug, playing, reduced, toggle: () => setPaused(!paused) }}>
      <PreviewPlayback.Provider value={playing}>{children}</PreviewPlayback.Provider>
    </TimelinePlayback.Provider>
  );
}

export function PlaybackToggle() {
  const { playing, reduced, toggle } = useContext(TimelinePlayback);
  return (
    <button className={styles.playback} type="button" disabled={reduced} onClick={toggle}>
      {playing ? <Pause aria-hidden="true" size={14} /> : <Play aria-hidden="true" size={14} />}
      {reduced ? "静态预览" : playing ? "暂停预览" : "播放预览"}
    </button>
  );
}

/** 预览只在自己的停靠处于活动位且未暂停时播放；包装元素供测试检视播放资格。 */
export function PreviewStation({ slug, children }: { slug: string; children: ReactNode }) {
  const { activeSlug, playing } = useContext(TimelinePlayback);
  const eligible = activeSlug === slug && playing;
  return (
    <PreviewPlayback.Provider value={eligible}>
      <div className={styles.previewStation} data-preview-playing={eligible ? "true" : "false"} data-preview-station={slug}>
        {children}
      </div>
    </PreviewPlayback.Provider>
  );
}
