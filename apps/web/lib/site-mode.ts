export type SiteMode = "information" | "portfolio";

// 作品集模式 = /portfolio 总览与全部 /products/* 产品页；其余路由都属于信息侧。
export function siteModeFromPathname(pathname: string): SiteMode {
  return pathname === "/portfolio" || pathname.startsWith("/products/") ? "portfolio" : "information";
}
