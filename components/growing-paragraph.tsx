import { useLayoutEffect, useRef, type ReactNode } from "react";

export function GrowingParagraph({ children, reduceMotion }: { children: ReactNode; reduceMotion: boolean }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner || reduceMotion) return;
    let animation: Animation | undefined;
    let previousHeight = inner.offsetHeight;
    outer.style.height = `${previousHeight}px`;
    const observer = new ResizeObserver(() => {
      const nextHeight = inner.offsetHeight;
      if (nextHeight === previousHeight) return;
      const fromHeight = outer.getBoundingClientRect().height;
      animation?.cancel();
      outer.style.height = `${nextHeight}px`;
      previousHeight = nextHeight;
      // Animate only actual line-height changes, not every typed character.
      if (!reduceMotion) {
        animation = outer.animate([{ height: `${fromHeight}px` }, { height: `${nextHeight}px` }], {
          duration: 220,
          easing: "cubic-bezier(.23,1,.32,1)",
        });
      }
    });
    observer.observe(inner);
    return () => {
      observer.disconnect();
      animation?.cancel();
      outer.style.removeProperty("height");
    };
  }, [reduceMotion]);

  return <div className="profile-paragraph-growth" ref={outerRef}><div className="profile-paragraph-content" ref={innerRef}>{children}</div></div>;
}
