"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { beginProfileTransition } from "@/components/profile-transition-state";

type SectionNavigationLinkProps = {
  "aria-current"?: "page";
  children: ReactNode;
  className: string;
  from: string;
  href: Route;
  to: string;
};

// 移动端 profile 过渡有 ghost 遮挡版块的退出过程，退出动画不必播完再导航，
// 缩短等待让路由渲染与退出动画重叠，压缩 ghost 悬停的空白窗口。
const mobileProfileExitDuration = 60;

// 同路径导航（如在目标页上再次点击其导航项）不需要 RSC 请求，用 history.pushState
// 完成即可——否则 slow network 下 ghost 会悬停数百毫秒等待 payload，飞行前的冻结窗口
// 全部来自这里。Next.js 会将 pushState 同步进 useSearchParams，浏览器前进/后退同样生效。
function commitNavigation(router: ReturnType<typeof useRouter>, href: Route) {
  const destination = new URL(href, window.location.origin);
  if (destination.pathname === window.location.pathname) {
    window.history.pushState(null, "", href);
    window.scrollTo(0, 0);
    return;
  }
  router.push(href);
}

export function SectionNavigationLink({
  children,
  className,
  from,
  href,
  to,
  ...props
}: SectionNavigationLinkProps) {
  const router = useRouter();
  const ariaCurrent = props["aria-current"];
  const link = useRef<HTMLAnchorElement>(null);
  const keyboardNavigation = useRef(false);
  const timeout = useRef<number | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => () => {
    if (timeout.current !== null) window.clearTimeout(timeout.current);
  }, []);

  useEffect(() => {
    if (ariaCurrent !== "page") return;
    const element = link.current;
    const container = element?.parentElement?.parentElement;
    if (!element || !container) return;
    const revealCurrent = () => {
      if (!window.matchMedia("(max-width: 900px)").matches) return;
      const item = element.getBoundingClientRect();
      const viewport = container.getBoundingClientRect();
      if (item.left >= viewport.left && item.right <= viewport.right) return;
      // 仅滚动导航自身，避免 scrollIntoView 同时移动页面或问答滚动区。
      container.scrollLeft += item.left - viewport.left - (viewport.width - item.width) / 2;
    };
    revealCurrent();
    const observer = new ResizeObserver(revealCurrent);
    observer.observe(container);
    return () => observer.disconnect();
  }, [ariaCurrent]);

  return (
    <Link
      {...props}
      className={className}
      data-transitioning={isNavigating ? "true" : undefined}
      href={href}
      ref={link}
      onClick={(event) => { keyboardNavigation.current = event.detail === 0; }}
      onNavigate={(event) => {
        if (isNavigating) return;

        const destination = new URL(href, window.location.origin);
        if (destination.pathname === window.location.pathname) {
          event.preventDefault();
          commitNavigation(router, href);
          return;
        }
        const isMobileProfileTransition = (from === "home" || to === "home")
          && window.matchMedia("(max-width: 900px)").matches;
        if (!isMobileProfileTransition || keyboardNavigation.current
          || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

        event.preventDefault();
        setIsNavigating(true);
        if (!beginProfileTransition(from, to)) {
          commitNavigation(router, href);
          return;
        }
        timeout.current = window.setTimeout(() => {
          commitNavigation(router, href);
        }, mobileProfileExitDuration);
      }}
    >
      {children}
    </Link>
  );
}
