import type { CSSProperties } from "react";

import { DotFieldParallax } from "@/components/dot-field-parallax";

const TECHNICAL_TERMS = [
  "retry.policy", "human.in.loop", "agent.runtime", "tool.call()",
  "rag.retrieval", "sse.stream", "planner.agent", "memory.store",
  "function.calling", "eval.loop", "context.engine", "ship.systems",
] as const;

// 技术栈词条：前半复刻 aryankarma.com 的 Skills 列表，后半为国内常用的 Java 技术栈。
const TECH_STACK_TERMS = [
  "React.js", "Next.js", "TypeScript", "Node.js", "Python", "Postgres",
  "Docker", "Kubernetes", "Tailwind CSS", "Git/GitHub", "JavaScript",
  "Sass", "Express.js", "Redux", "Java", "Spring", "Spring Boot",
  "Spring Cloud", "MyBatis", "MySQL", "Redis", "RabbitMQ", "Elasticsearch",
  "Maven", "Nginx",
] as const;

// 固定词条保证 SSR/ISR 与客户端水合一致。
const SELECTED_TERMS = [...TECHNICAL_TERMS, ...TECH_STACK_TERMS];

// 弹幕泳道：词条按索引取模分配到六条水平泳道。每条泳道只动一个连续轨道，
// 轨道内用足够大的固定间隔保持同屏稀疏；复制序列只用于无缝循环。
const TERM_LANES = [
  { top: "2%", duration: 21 },
  { top: "19%", duration: 23 },
  { top: "36%", duration: 20 },
  { top: "52%", duration: 27 },
  { top: "68%", duration: 24 },
  { top: "84%", duration: 22 },
] as const;

const TERM_SUBGROUPS = 3;

const TERMS_BY_LANE = TERM_LANES.map((_, lane) =>
  SELECTED_TERMS.flatMap((term, index) => index % TERM_LANES.length === lane ? [{ index, term }] : []),
);

// 每条泳道的滚动参数都是索引的纯函数，服务端与客户端必然算出同一份结果。
function trackStyle(lane: number): CSSProperties {
  const { top, duration } = TERM_LANES[lane];
  const drift = (lane % 2 === 0 ? 1 : -1) * (0.06 + (lane % 3) * 0.03);

  return {
    "--term-top": top,
    "--term-duration": `${duration * TERM_SUBGROUPS}s`,
    "--term-delay": `${(-lane * 1.7).toFixed(2)}s`,
    "--term-drift": `${drift.toFixed(2)}rem`,
  } as CSSProperties;
}

function renderTerms(
  terms: (typeof TERMS_BY_LANE)[number],
  repeated = false,
) {
  return terms.map(({ index, term }) => (
    <span
      className="interactive-dot-field__term"
      data-emphasis={index === 0 || index === 8 ? "strong" : index === 4 ? "medium" : undefined}
      data-static-align={!repeated && index < TECHNICAL_TERMS.length
        ? index % 3 === 0 ? "start" : index % 3 === 2 ? "end" : undefined
        : undefined}
      data-static-term={!repeated && index < TECHNICAL_TERMS.length ? "" : undefined}
      key={`${repeated ? "repeat" : "original"}-${term}-${index}`}
      style={{ "--term-order": index } as CSSProperties}
    >
      {term}
    </span>
  ));
}

export function InteractiveDotField() {
  return (
    <div
      aria-label="技术词条动效"
      className="interactive-dot-field"
      role="group"
    >
      <DotFieldParallax>
        {TERMS_BY_LANE.map((terms, lane) => (
          <span className="interactive-dot-field__lane" key={lane}>
            <span className="interactive-dot-field__track" style={trackStyle(lane)}>
              <span className="interactive-dot-field__sequence">
                {renderTerms(terms)}
              </span>
              <span aria-hidden="true" className="interactive-dot-field__sequence interactive-dot-field__sequence--repeat">
                {renderTerms(terms, true)}
              </span>
            </span>
          </span>
        ))}
      </DotFieldParallax>
    </div>
  );
}
