import type { Route } from "next";

import { SectionNavigationLink } from "@/components/section-navigation-link";
import { SiteModeNavigation } from "@/components/site-mode-navigation";

import styles from "./site-section-navigation.module.css";

export type SiteSection = "home" | "ai-news" | "daily" | "design" | "douyin" | "open-source";

// 刊头只包含阅读版块；问答由个人简介中的角色打开；作品集由「信息流 / 作品流」模式切换进入。
const siblingSections: Array<{ href: Route; id: Exclude<SiteSection, "home">; label: string }> = [
  { href: "/ai-news", id: "ai-news", label: "每日动态" },
  { href: "/curation", id: "daily", label: "每日关注" },
  { href: "/design" as Route, id: "design", label: "设计收藏" },
  { href: "/douyin", id: "douyin", label: "抖音收藏" },
  { href: "/open-source", id: "open-source", label: "开源关注" },
];

const homeSection = { href: "/" as Route, id: "home" as const, label: "首页" };
const portfolioSection = { href: "/portfolio" as Route, id: "portfolio" as const, label: "作品流" };

const sectionHref = (section: SiteSection): Route =>
  section === "home" ? homeSection.href : (siblingSections.find((item) => item.id === section)?.href ?? homeSection.href);

export function MobileSectionNavigation({ current }: { current: SiteSection }) {
  return (
    <div className={styles.mobileNavigation} data-mobile-navigation>
      <nav aria-label="内容导航" className={styles.navigation}>
        {[homeSection, ...siblingSections, portfolioSection].map((section) => (
          <SectionNavigationLink
            aria-current={current === section.id ? "page" : undefined}
            className={styles.link}
            from={current}
            href={section.href}
            key={`${current}-${section.id}`}
            to={section.id}
          >
            {section.label}
          </SectionNavigationLink>
        ))}
      </nav>
    </div>
  );
}

// 桌面刊头：「信息流 / 作品流」模式切换 + 当前版块刊名 + 兄弟版块 quiet 同行链接，
// 整个头部共享一条细线——导航不使用 tab 语法。桌面无独立「首页」：/ 的右侧即每日动态，
// 「首页」只保留在移动端导航（回到展开的个人资料）。
export function ContentSectionNavigation({ current }: { current: SiteSection }) {
  const currentSection = siblingSections.find((section) => section.id === current) ?? siblingSections[0];
  const siblings = siblingSections.filter((section) => section.id !== currentSection.id);
  return (
    <nav aria-label="内容导航" className={styles.contentNavigation}>
      <div className={styles.mastheadGroup}>
        <SiteModeNavigation current="information" informationHref={sectionHref(current)} />
        <span aria-current="page" className={styles.current}>
          {currentSection.label}
        </span>
      </div>
      <div className={styles.siblings}>
        {siblings.map((section) => (
          <SectionNavigationLink
            className={styles.siblingLink}
            from={current}
            href={section.href}
            key={`${current}-${section.id}`}
            to={section.id}
          >
            {section.label}
          </SectionNavigationLink>
        ))}
      </div>
    </nav>
  );
}
