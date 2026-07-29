import type {
  BuildAssistantToolsInput,
  ExecuteAssistantToolInput,
  ToolProgressHandlers,
} from "./contracts";
import { buildAssistantTools, executeAssistantTool } from "./tools";
import {
  buildAssistantGitHubTools,
  executeAssistantGitHubTool,
  isAssistantGitHubTool,
  type AssistantFunctionToolDefinition,
} from "./github-tools";

type JsonObject = Record<string, unknown>;

/**
 * Authoritative assistant tool registry.
 *
 * New tool families should be composed here rather than creating additional
 * Responses API loops. This keeps definition discovery and execution routing
 * aligned for every assistant-core caller.
 */
export function buildUnifiedAssistantTools(
  input: BuildAssistantToolsInput,
): AssistantFunctionToolDefinition[] {
  return [
    ...buildAssistantTools(input),
    ...buildAssistantGitHubTools(),
  ];
}

/**
 * Authoritative assistant tool executor.
 *
 * Specialized tool families receive the same assembled request context and
 * progress handlers as the existing assistant tools. Unknown tools continue
 * through the base executor so its established error contract is preserved.
 */
export async function executeUnifiedAssistantTool(
  input: ExecuteAssistantToolInput,
  handlers?: ToolProgressHandlers,
): Promise<JsonObject> {
  if (isAssistantGitHubTool(input.name)) {
    return executeAssistantGitHubTool(
      {
        name: input.name,
        args: input.args,
        context: input.context,
      },
      handlers,
    );
  }

  return executeAssistantTool(input, handlers);
}
