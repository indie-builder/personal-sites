"use client";

import { BriefcaseBusiness, Newspaper } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { siteModeFromPathname } from "@/lib/site-mode";

// 身份轨左端的站内模式入口：信息侧显示「作品集」进入作品集，作品集侧显示「信息集」返回信息流。
// 复用 external-links 的 quiet 图标链接样式与移动端 44px 触达（reading.css）。
export function SiteModeLink() {
  const inPortfolio = siteModeFromPathname(usePathname()) === "portfolio";
  return (
    <Link href={inPortfolio ? "/" : "/portfolio"}>
      {inPortfolio ? <Newspaper aria-hidden="true" /> : <BriefcaseBusiness aria-hidden="true" />}
      {inPortfolio ? "信息集" : "作品集"}
    </Link>
  );
}
