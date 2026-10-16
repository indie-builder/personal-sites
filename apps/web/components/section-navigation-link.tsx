import { Link, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";

import { beginProfileTransition } from "@/components/profile-transition-state";
import type { SiteSectionHref } from "@/components/site-section-navigation";

type SectionNavigationLinkProps = {
  "aria-current"?: "page";
  children: ReactNode;
  className: string;
  from: string;
  href: SiteSectionHref;
  to: string;
};

// 移动端 profile 过渡有 ghost 遮挡版块的退出过程，退出动画不必播完再导航，
// 缩短等待让路由渲染与退出动画重叠，压缩 ghost 悬停的空白窗口。
const mobileProfileExitDuration = 60;

// 同路径导航（如在目标页上再次点击其导航项）不触发路由跳转，回到顶部即可；
// Next 时代这里用 history.pushState 让 useSearchParams 同步，TanStack 的
// 路由状态由框架持有，同路径无需任何状态写入。
function commitNavigation(router: ReturnType<typeof useRouter>, href: SiteSectionHref) {
  const destination = new URL(href, window.location.origin);
  if (destination.pathname === window.location.pathname) {
    window.scrollTo(0, 0);
    return;
  }
  void router.navigate({ to: href });
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

  const handleNavigate = (event: MouseEvent<HTMLAnchorElement>) => {
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
  };

  return (
    <Link
      {...props}
      className={className}
      data-transitioning={isNavigating ? "true" : undefined}
      to={href}
      ref={link}
      onClick={(event) => {
        keyboardNavigation.current = event.detail === 0;
        handleNavigate(event);
      }}
    >
      {children}
    </Link>
  );
}
