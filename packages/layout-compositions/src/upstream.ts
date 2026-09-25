/**
 * 上游项目信息（CC BY 4.0 署名用）。
 * 独立成无 node 依赖的模块：客户端组件（如首页「关于」节点）从这里引，
 * 避免把 index.ts 的 node:fs/node:path 打进客户端包。
 */
export const upstream = {
  name: '350-layout-compositions',
  author: 'nevertoday',
  url: 'https://github.com/nevertoday/350-layout-compositions',
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
} as const;
