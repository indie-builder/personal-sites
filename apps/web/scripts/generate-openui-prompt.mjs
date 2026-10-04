import { writeFileSync } from "node:fs";
import { openuiLibrary, openuiPromptOptions } from "@openuidev/react-ui/genui-lib";

// 官方组件定义包含客户端代码；升级 OpenUI 后生成服务端使用的同版本提示词。
writeFileSync(
  new URL("../lib/ask-openui-prompt.json", import.meta.url),
  `${JSON.stringify(openuiLibrary.prompt(openuiPromptOptions), null, 2)}\n`,
);
