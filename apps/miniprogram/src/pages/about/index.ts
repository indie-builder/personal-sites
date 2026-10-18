import { copyLink, profile, readReducedMotion, setReducedMotion, SITE_ORIGIN } from "../../lib/runtime";

Page({
  data: {
    profile,
    careerOpen: false,
    careerDuration: 0,
    reducedMotion: false,
    links: [
      { label: "GitHub", url: "https://github.com/indie-builder" },
      { label: "语雀", url: "https://www.yuque.com/defulat-coder" },
    ],
    career: [
      { company: "PLUS数字科技", meta: "2014—2019 · Java · 服务运维", years: "5 年" },
      { company: "红星美凯龙", meta: "2019—2023 · 业务 · 集团架构", years: "4 年" },
      { company: "喜马拉雅", meta: "2023—2026 · 企业 AI 应用", years: "3 年" },
      { company: "PayerMax", meta: "2026— · OPT · 端到端交付", years: "至今" },
    ],
    terms: ["agent.runtime", "human.in.loop", "rag.retrieval", "sse.stream", "TypeScript", "Python", "Java", "Postgres", "Docker", "Kubernetes", "React.js", "Git/GitHub"],
  },
  _tabBarHidden: false,
  _openToken: 0,

  measureMotion() {
    const token = ++this._openToken;
    const reducedMotion = readReducedMotion();
    this.setData({ reducedMotion, careerDuration: 0 });
    if (reducedMotion) return;
    try {
      wx.createSelectorQuery().in(this).select(".career-motion-probe").fields({ computedStyle: ["opacity"] }, (style) => {
        if (token !== this._openToken || !style) return;
        this.setData({ careerDuration: String(style.opacity) === "1" ? 250 : 0 });
      }).exec();
    } catch { /* Static is the safe fallback when the WebView cannot report the system preference. */ }
  },

  toggleCareer() {
    if (this.data.careerOpen) { this.closeCareer(); return; }
    this._tabBarHidden = true;
    wx.hideTabBar({ animation: false });
    this.setData({ careerOpen: true, reducedMotion: readReducedMotion() });
  },

  closeCareer() { this.setData({ careerOpen: false }); },

  onCareerLeave() {
    // Native back/swipe dismissal also has to update the controlled show property.
    this.closeCareer();
  },

  onCareerAfterLeave() {
    // A close completion may arrive after reopening the sheet.
    if (!this.data.careerOpen) this.restoreTabBar();
  },

  restoreTabBar() {
    if (!this._tabBarHidden) return;
    this._tabBarHidden = false;
    wx.showTabBar({ animation: false });
  },

  onShow() { this.measureMotion(); },
  onHide() { this._openToken++; this.closeCareer(); this.restoreTabBar(); },
  onUnload() { this._openToken++; this.restoreTabBar(); },

  onReducedMotionChange(event: WechatMiniprogram.SwitchChange) {
    setReducedMotion(event.detail.value);
    this.measureMotion();
  },

  copyProfileLink(event: WechatMiniprogram.TouchEvent) {
    const link = this.data.links.find((item) => item.url === event.currentTarget.dataset.url);
    if (link) copyLink(link.url);
  },

  copyWebsite() { copyLink(SITE_ORIGIN); },

  onShareAppMessage() { return { title: `${profile.name} · 关于我`, path: "/pages/about/index" }; },
});
