"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Pause, Play } from "lucide-react";
import styles from "./portfolio-overview.module.css";

const PreviewPlayback = createContext(true);

export function usePreviewPlayback() {
  return useContext(PreviewPlayback);
}

export function PreviewPlaybackScope({ children }: { children: ReactNode }) {
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
    <PreviewPlayback.Provider value={playing}>
      <div className={styles.previewScope} data-preview-paused={!playing || undefined}>
        <button
          className={styles.playback}
          type="button"
          disabled={reduced}
          onClick={() => setPaused(!paused)}
        >
          {playing ? <Pause aria-hidden="true" size={14} /> : <Play aria-hidden="true" size={14} />}
          {reduced ? "静态预览" : playing ? "暂停预览" : "播放预览"}
        </button>
        {children}
      </div>
    </PreviewPlayback.Provider>
  );
}
