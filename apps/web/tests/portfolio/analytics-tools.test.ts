// @vitest-environment node
import { test } from "vitest";
import assert from 'node:assert/strict';
// vitest 配置已把 server-only 映射为空模块。
import {
  analyticsToolNames,
  analyticsToolLabel,
  createAnalyticsTools,
} from '../../lib/portfolio/analytics-tools';
import { connectAnalyticsMcp, truncateToolText } from '../../lib/portfolio/analytics-mcp';

const noop = async () => ({ text: '', isError: false });

test('工具名清单与中文标签一一对应，未知名回退原名', () => {
  assert.deepEqual([...analyticsToolNames], [
    'get_context',
    'list_models',
    'describe_model',
    'list_cubes',
    'describe_cube',
    'plan_sql',
    'query_sql',
    'query_cube',
  ]);
  assert.equal(analyticsToolLabel('get_context'), '读取业务口径');
  assert.equal(analyticsToolLabel('query_cube'), '查询指标');
  assert.equal(analyticsToolLabel('unknown_tool'), 'unknown_tool');
});

test('8 个工具全部只读、串行执行，query_cube 过滤操作符限 12 个', () => {
  const tools = createAnalyticsTools(noop);
  assert.equal(tools.length, 8);
  for (const tool of tools) {
    assert.equal(tool.annotations?.readOnlyHint, true);
    assert.equal(tool.annotations?.destructiveHint, false);
    assert.equal(tool.executionMode, 'sequential');
    assert.ok(tool.description.length > 0);
  }
  const schemaOf = (name: string) => {
    const tool = tools.find((item) => item.name === name);
    const parameters = tool!.parameters as unknown as {
      properties: Record<string, { items?: { properties?: Record<string, { anyOf?: unknown[]; oneOf?: unknown[] }> }; sql?: unknown }>;
    };
    return parameters.properties;
  };
  const filterItem = schemaOf('query_cube').filters!.items!;
  const operator = filterItem.properties!.operator!;
  const literals = (operator.anyOf ?? operator.oneOf) as unknown[];
  assert.equal(literals.length, 12);
  assert.ok(schemaOf('plan_sql').sql);
});

test('工具执行透传参数、透传错误并按上限拦截', async () => {
  const calls: [string, Record<string, unknown>][] = [];
  const tools = createAnalyticsTools(async (name: string, args: Record<string, unknown>) => {
    calls.push([name, args]);
    return { text: `result:${name}`, isError: name === 'query_sql' };
  });
  const describeModel = tools.find((tool) => tool.name === 'describe_model')!;
  const ok = await describeModel.execute('t1', { name: 'employees' }, {} as never, undefined as never, undefined as never);
  assert.deepEqual(calls.at(-1), ['describe_model', { name: 'employees' }]);
  assert.equal(ok.isError, false);
  assert.equal((ok.content[0] as { text: string }).text, 'result:describe_model');
  const querySql = tools.find((tool) => tool.name === 'query_sql')!;
  const failed = await querySql.execute('t2', { sql: 'SELECT 1' }, {} as never, undefined as never, undefined as never);
  assert.equal(failed.isError, true);

  const budget = createAnalyticsTools(async () => ({ text: 'ok', isError: false }));
  const getContext = budget.find((tool) => tool.name === 'get_context')!;
  const params = {};
  for (let index = 0; index < 12; index++) {
    const result = await getContext.execute(`b${index}`, params, {} as never, undefined as never, undefined as never);
    assert.equal(result.isError, false);
  }
  const blocked = await getContext.execute('b12', params, {} as never, undefined as never, undefined as never);
  assert.equal(blocked.isError, true);
  assert.match((blocked.content[0] as { text: string }).text, /上限/);
});

test('超长结果被截断并注明数据不完整', () => {
  const long = 'x'.repeat(25_000);
  const truncated = truncateToolText(long);
  assert.ok(truncated.length < 25_000);
  assert.match(truncated, /数据不完整/);
  assert.equal(truncateToolText('短结果'), '短结果');
  assert.equal(truncateToolText('x'.repeat(20_000)).length, 20_000);
});

test('token 缺失时返回降级客户端：调用报错但不抛出', async () => {
  const previous = process.env.ANALYTICS_MCP_TOKEN;
  delete process.env.ANALYTICS_MCP_TOKEN;
  try {
    const client = await connectAnalyticsMcp();
    const result = await client.call('get_context', {});
    assert.equal(result.isError, true);
    assert.match(result.text, /尚未配置/);
    await client.close();
  } finally {
    if (previous === undefined) delete process.env.ANALYTICS_MCP_TOKEN;
    else process.env.ANALYTICS_MCP_TOKEN = previous;
  }
});
