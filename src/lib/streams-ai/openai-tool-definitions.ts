export type ApprovedOpenAIToolName =
  | "capabilities_list"
  | "runtime_events_read"
  | "orchestrator_plan"
  | "jobs_list"
  | "assets_list"
  | "provider_runs_lookup"
  | "action_resolve";

export type OpenAIToolDefinition = {
  type: "function";
  name: ApprovedOpenAIToolName;
  description: string;
  parameters: Record<string, unknown>;
};

const SESSION_SCHEMA = {
  type: "object",
  properties: {
    sessionId: { type: "string" },
  },
  required: ["sessionId"],
  additionalProperties: true,
};

export const APPROVED_OPENAI_TOOL_DEFINITIONS: OpenAIToolDefinition[] = [
  { type: "function", name: "capabilities_list", description: "List current universal Streams assistant capabilities and availability.", parameters: SESSION_SCHEMA },
  { type: "function", name: "runtime_events_read", description: "Read recent runtime/workspace events so chat knows what happened.", parameters: SESSION_SCHEMA },
  { type: "function", name: "orchestrator_plan", description: "Create a universal assistant plan only when runtime context or tool/action mode is needed.", parameters: { type: "object", properties: { sessionId: { type: "string" }, userMessage: { type: "string" } }, required: ["sessionId", "userMessage"], additionalProperties: true } },
  { type: "function", name: "jobs_list", description: "Read current session job records for proof/status checks.", parameters: SESSION_SCHEMA },
  { type: "function", name: "assets_list", description: "Read current session asset records for proof/status checks.", parameters: SESSION_SCHEMA },
  { type: "function", name: "provider_runs_lookup", description: "Read provider run records for provider execution proof.", parameters: { type: "object", properties: { sessionId: { type: "string" }, jobId: { type: "string" } }, required: ["sessionId"], additionalProperties: true } },
  { type: "function", name: "action_resolve", description: "Resolve an exact source/action target and block low-confidence mutations.", parameters: { type: "object", properties: { sessionId: { type: "string" }, attemptedAction: { type: "string" }, selectedLayer: { type: "object" }, selectedAsset: { type: "object" }, selectedJob: { type: "object" }, selectedProviderRun: { type: "object" }, repo: { type: "string" }, branch: { type: "string" }, route: { type: "string" }, filePath: { type: "string" } }, required: ["sessionId"], additionalProperties: true } },
];

export function isApprovedOpenAIToolName(name: string): name is ApprovedOpenAIToolName {
  return APPROVED_OPENAI_TOOL_DEFINITIONS.some((tool) => tool.name === name);
}
