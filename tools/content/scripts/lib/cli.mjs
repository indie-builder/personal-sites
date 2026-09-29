/**
 * 表驱动的命令行解析：`--flag value` 与 `--flag=value` 两种写法统一处理。
 * spec 把选项名映射为 "flag"（布尔）|"int"（正整数）|"csv"（逗号分隔去重集合）|
 * "string"；未识别的 -- 参数、缺值、非法整数都直接抛错，位置参数收进 positionals。
 */
export function parseCliOptions(args, spec) {
  const options = { positionals: [] };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--") continue;
    if (!argument.startsWith("--")) {
      options.positionals.push(argument);
      continue;
    }
    const equalsIndex = argument.indexOf("=");
    const name = equalsIndex < 0 ? argument : argument.slice(0, equalsIndex);
    const kind = spec[name];
    if (!kind) throw new Error(`未知参数：${argument}`);
    const inline = equalsIndex < 0 ? undefined : argument.slice(equalsIndex + 1);
    const read = () => {
      if (inline !== undefined) return inline;
      const value = args[index + 1];
      if (value === undefined || value.startsWith("--")) throw new Error(`${name} 需要一个值。`);
      index += 1;
      return value;
    };
    const key = toOptionKey(name);
    if (kind === "flag") {
      options[key] = true;
    } else if (kind === "int") {
      const value = Number.parseInt(read(), 10);
      if (!Number.isInteger(value) || value < 1) throw new Error(`${name} 必须是大于 0 的整数。`);
      options[key] = value;
    } else if (kind === "csv") {
      const values = read().split(",").filter(Boolean);
      if (values.length === 0) throw new Error(`${name} 至少需要一个值。`);
      options[key] = new Set(values);
    } else {
      options[key] = read();
    }
  }
  return options;
}

function toOptionKey(name) {
  return name.slice(2).replace(/-([a-z])/gu, (_, character) => character.toUpperCase());
}
