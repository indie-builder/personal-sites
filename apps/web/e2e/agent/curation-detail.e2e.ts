import { test } from "@e2e-dev/web";
import { expect } from "e2e";

// 注册期跳过：agent fixture 在用例体之前获取，无模型时体内 test.skip 来不及生效。
const skipNoKey = !process.env.BIGMODEL_API_KEY?.trim();

test("从首页进入精选流并打开一条剪报详情", { skip: skipNoKey ? "缺少 BIGMODEL_API_KEY，跳过 agent 冒烟" : false }, async ({ app, agent, screen, browser }) => {
  await app.open("/");
  await agent.act("通过导航进入「每日关注」精选流");
  await expect(browser).toHaveURL("/curation");

  await agent.act("打开精选流里任意一条剪报的详情");
  await expect(screen.getByRole("region", "深度解析")).toBeVisible();
  await expect(screen.getByRole("region", "来源摘录")).toBeVisible();

  await app.back();
  await expect(browser).toHaveURL("/curation");
  await expect(screen.getByRole("listitem").first()).toBeVisible();
});
