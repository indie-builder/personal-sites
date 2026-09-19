type AgentSession = {
  state?: { messages?: Array<{ content?: unknown; errorMessage?: unknown; role?: unknown; stopReason?: unknown }> };
};
export function getFinalAssistantText(session: AgentSession): string;
export function getFinalAssistantFailure(session: AgentSession): string;
