import { copyLink, profile, readReducedMotion, setReducedMotion, SITE_ORIGIN } from "../../lib/runtime";

Page({
  data: {
    profile,
    careerOpen: false,
    careerHeight: "0px",
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
  _careerToken: 0,

  // Keep the closed receipt mounted so its height never reflows after the first measurement.
  measureCareer() {
    const token = ++this._careerToken;
    const settle = (height: string) => {
      if (token !== this._careerToken) return;
      this.setData({ careerHeight: height });
    };
    try {
      wx.createSelectorQuery().in(this).select("#career-receipt").boundingClientRect((rect) => {
        const measured = rect && !Array.isArray(rect) && Number.isFinite(rect.height) && rect.height > 0;
        settle(measured ? `${Math.ceil(rect.height)}px` : "auto");
      }).exec();
    } catch {
      // A persistent zero height without a measurable rect would hide the open content.
      settle("auto");
    }
  },

  toggleCareer() {
    if (this.data.careerOpen) {
      this._careerToken += 1;
      this.setData({ careerOpen: false, careerHeight: "0px" });
      return;
    }
    this.setData({ careerOpen: true });
    this.measureCareer();
  },

  onShow() {
    const reducedMotion = readReducedMotion();
    if (reducedMotion !== this.data.reducedMotion) this.setData({ reducedMotion });
    if (this.data.careerOpen) this.measureCareer();
  },

  onResize() {
    if (this.data.careerOpen) this.measureCareer();
  },

  onHide() {
    this._careerToken += 1;
  },

  onUnload() {
    this._careerToken += 1;
  },

  onReducedMotionChange(event: WechatMiniprogram.SwitchChange) {
    setReducedMotion(event.detail.value);
    this.setData({ reducedMotion: readReducedMotion() });
  },

  copyProfileLink(event: WechatMiniprogram.TouchEvent) {
    const link = this.data.links.find((item) => item.url === event.currentTarget.dataset.url);
    if (link) copyLink(link.url);
  },

  copyWebsite() {
    copyLink(SITE_ORIGIN);
  },

  onShareAppMessage() {
    return { title: `${profile.name} · 关于我`, path: "/pages/about/index" };
  },
});
