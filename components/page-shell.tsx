import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";

import { SectionMotionLifecycle } from "@/components/section-motion-lifecycle";
import { ContentSectionNavigation, type SiteSection } from "@/components/site-section-navigation";
import { SiteProfile } from "@/components/site-profile";
import { ThemeToggle } from "@/components/theme-toggle";
import styles from "@/components/open-source.module.css";

/** 列表页流式骨架：与列表加载更多的骨架共用同一套样式。 */
export function FeedSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="curation-home__stream-skeleton">
      <span />
      <span className="is-medium" />
      <span className="is-short" />
    </div>
  );
}

/** 列表页共用壳：个人信息栏 + 版块导航 + 阅读流容器；数据由 children 自行流式补进。 */
export function FeedPage({ children, label, section }: { children: ReactNode; label: string; section: SiteSection }) {
  return (
    <main className="curation-home" id="site-main" tabIndex={-1}>
      <SiteProfile mobileSection={section} />
      <SectionMotionLifecycle section={section} />
      <section aria-label={label} className="curation-home__feed site-section-motion">
        <ContentSectionNavigation current={section} />
        {children}
      </section>
    </main>
  );
}

/** 详情页共用壳：完整 main 与个人信息栏；mainClassName 承载各板块的修饰类。 */
export function DetailPage({ children, mainClassName = "curation-home curation-detail" }: { children: ReactNode; mainClassName?: string }) {
  return (
    <main className={mainClassName} id="site-main" tabIndex={-1}>
      <SiteProfile />
      {children}
    </main>
  );
}

/** 详情页顶部的返回导航（真实返回链接 + 主题切换）。 */
export function DetailTopbar({ backClassName, backHref, backLabel, className = "curation-detail__back" }: {
  backClassName?: string;
  backHref: string;
  backLabel: string;
  className?: string;
}) {
  return (
    <nav aria-label="返回" className={className}>
      <Link className={backClassName} href={backHref as Route}>
        <ArrowLeft aria-hidden="true" />
        {backLabel}
      </Link>
      <ThemeToggle />
    </nav>
  );
}

/** 详情页加载占位的三行文档骨架（样式见 open-source.module.css）。 */
export function LoadingDocument() {
  return (
    <div aria-hidden="true" className={styles.loadingDocument}>
      <span className={styles.loadingLine} />
      <span className={`${styles.loadingLine} ${styles.loadingLineMedium}`} />
      <span className={`${styles.loadingLine} ${styles.loadingLineShort}`} />
    </div>
  );
}

/** 剪报簿族详情页的加载占位骨架：返回链接占位 + 正在打开提示 + 标题占位。 */
export function DetailLoadingChrome({ backLabel, loadingLabel }: { backLabel: string; loadingLabel: string }) {
  return (
    <>
      <nav aria-label="返回" className="curation-detail__back">
        <span className={styles.loadingBack}>
          <ArrowLeft aria-hidden="true" />
          {backLabel}
        </span>
        <ThemeToggle />
      </nav>
      <header className="curation-detail__header">
        <p className={styles.loadingLabel}>{loadingLabel}</p>
        <span aria-hidden="true" className={styles.loadingTitle} />
      </header>
    </>
  );
}
