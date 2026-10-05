function memberName(node) {
  if (node?.type !== "MemberExpression") return null;
  return node.computed ? node.property.value : node.property.name;
}

export default {
  meta: { name: "site-effect" },
  rules: {
    "execution-boundary": {
      meta: {
        type: "problem",
        schema: [{ enum: ["business", "cli"] }],
        messages: {
          runtime: "Return the Effect from business code; execute it at the CLI, framework or test boundary.",
          cliRuntime: "Use runCli so cancellation waits for scoped cleanup.",
          exit: "Return or fail the Effect and set process.exitCode at the boundary; process.exit skips cleanup.",
          missingCli: "This CLI must import runCli from @site/effect/cli, or runCliScript from ./lib/run-cli.mjs.",
          retry: "Use explicit retry options with a bounded times value, schedule and while predicate.",
          expectedFailure: "Use Effect.fail or attempt for expected failures; throwing inside Effect.gen/sync produces a defect.",
        },
      },
      create(context) {
        const mode = context.options[0];
        const effectNames = new Set();
        const runners = new Map();
        let hasRunCli = false;
        const effectMethod = (node) => {
          if (node?.type === "Identifier") return runners.get(node.name);
          if (node?.type === "MemberExpression" && effectNames.has(node.object.name)) return memberName(node);
          return null;
        };
        return {
          ImportDeclaration(node) {
            if (node.source.value === "@site/effect/cli") {
              hasRunCli ||= node.specifiers.some((item) => item.imported?.name === "runCli");
            }
            if (node.source.value === "./lib/run-cli.mjs") {
              hasRunCli ||= node.specifiers.some((item) => item.imported?.name === "runCliScript");
            }
            if (node.source.value === "effect") {
              for (const item of node.specifiers) {
                if (item.imported?.name === "Effect") effectNames.add(item.local.name);
              }
            }
            if (node.source.value === "effect/Effect") {
              for (const item of node.specifiers) {
                if (item.type === "ImportNamespaceSpecifier") effectNames.add(item.local.name);
                else if (item.imported) runners.set(item.local.name, item.imported.name);
              }
            }
          },
          CallExpression(node) {
            const method = effectMethod(node.callee);
            if (method === "retry") {
              const options = node.arguments.at(-1);
              const properties = options?.type === "ObjectExpression" ? options.properties : [];
              const get = (name) => properties.find((item) => (item.key?.name ?? item.key?.value) === name)?.value;
              const times = get("times");
              if (!Number.isInteger(times?.value) || times.value < 0 || !get("schedule") || !get("while")) {
                context.report({ node, messageId: "retry" });
              }
            }
            if (/^run(?:Promise|Sync|Fork|Callback)/u.test(method ?? "")) {
              const allocatesCache = mode === "business" && method === "runSync"
                && node.arguments[0]?.type === "CallExpression"
                && effectMethod(node.arguments[0].callee) === "cached";
              if (!allocatesCache) context.report({ node, messageId: mode === "cli" ? "cliRuntime" : "runtime" });
            }
            if (node.callee.type === "MemberExpression" && node.callee.object.name === "process"
              && memberName(node.callee) === "exit") context.report({ node, messageId: "exit" });
          },
          ThrowStatement(node) {
            let parent = node.parent;
            while (parent && !["FunctionExpression", "ArrowFunctionExpression", "FunctionDeclaration"].includes(parent.type)) {
              parent = parent.parent;
            }
            const call = parent?.parent;
            if (call?.type === "CallExpression" && ["gen", "sync"].includes(effectMethod(call.callee))) {
              context.report({ node, messageId: "expectedFailure" });
            }
          },
          "Program:exit"(node) {
            if (mode === "cli" && !hasRunCli) context.report({ node, messageId: "missingCli" });
          },
        };
      },
    },
  },
};
