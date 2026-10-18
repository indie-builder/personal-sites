import { copyLink, profile, SITE_ORIGIN } from "../../lib/runtime";

Page({
  data: {
    profile,
    careerOpen: false,
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

  toggleCareer() {
    this.setData({ careerOpen: !this.data.careerOpen });
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
