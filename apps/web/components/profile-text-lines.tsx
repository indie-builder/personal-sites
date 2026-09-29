"use client";

import { useLayoutEffect, useRef, useState } from "react";

/** Keep the browser's real word wrapping, but give each landing line its own surface. */
export function ProfileTextLines({ text }: { text: string }) {
  const measure = useRef<HTMLSpanElement>(null);
  const [lines, setLines] = useState<string[]>([text]);

  useLayoutEffect(() => {
    const element = measure.current;
    if (!element) return;
    const update = () => {
      const node = element.firstChild;
      if (!node) return;
      const range = document.createRange();
      if (!range.getBoundingClientRect) return;
      const next: string[] = [];
      let top = -Infinity;
      for (let index = 0; index < text.length; index++) {
        range.setStart(node, index);
        range.setEnd(node, index + 1);
        const rect = range.getBoundingClientRect();
        if (Math.abs(rect.top - top) > 2) {
          next.push(text[index]);
          top = rect.top;
        } else {
          next[next.length - 1] += text[index];
        }
      }
      setLines((current) => current.join("\n") === next.join("\n") ? current : next);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text]);

  return (
    <span aria-hidden="true" className="profile-text-lines">
      <span className="profile-text-measure" ref={measure}>{text}</span>
      {lines.map((line, index) => <span className="profile-text-line" data-profile-line key={index}>{line}</span>)}
    </span>
  );
}
