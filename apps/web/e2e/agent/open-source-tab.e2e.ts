import { test } from "@e2e-dev/web";
import { expect } from "e2e";

// 注册期跳过：agent fixture 在用例体之前获取，无模型时体内 test.skip 来不及生效。
const skipNoKey = !process.env.BIGMODEL_API_KEY?.trim();

test("开源仓库详情切换文档标签", { skip: skipNoKey ? "缺少 BIGMODEL_API_KEY，跳过 agent 冒烟" : false }, async ({ app, agent, screen }) => {
  await app.open("/open-source");
  await agent.act("打开开源关注列表里任意一个仓库的文档详情");
  await expect(screen.getByRole("tablist", "切换仓库文档版本")).toBeVisible();
  await expect(screen.getByRole("tabpanel", "中文阅读版")).toBeVisible();

  await agent.act("切换到「仓库结构」标签");
  await expect(screen.getByRole("tabpanel", "仓库结构")).toBeVisible();
  await expect(screen.getByRole("tabpanel", "中文阅读版")).toBeHidden();
});
