import type {
  BuildAssistantToolsInput,
  ExecuteAssistantToolInput,
  ToolProgressHandlers,
} from "./contracts";

type ToolDefinition = {
  type: "function";
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
};

export function buildAssistantTools(
  _input: BuildAssistantToolsInput,
): ToolDefinition[] {
  return [
    {
      type: "function",
      name: "run_verification",
      description: "Run a verification pass for a request.",
      parameters: {
        type: "object",
        properties: {
          target: { type: "string" },
        },
        required: ["target"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "generate_image",
      description: "Generate an image from a prompt.",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string" },
        },
        required: ["prompt"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "list_workspace_files",
      description: "List files in the workspace.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
        },
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "read_workspace_file",
      description: "Read a file from the workspace.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
        },
        required: ["path"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "write_workspace_file",
      description: "Write a file in the workspace.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          content: { type: "string" },
        },
        required: ["path", "content"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "apply_workspace_patch",
      description: "Apply a simple string patch to a workspace file.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          find: { type: "string" },
          replace: { type: "string" },
        },
        required: ["path", "find", "replace"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "run_workspace_command",
      description: "Run an allowed workspace command.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string" },
        },
        required: ["command"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "build_workspace",
      description: "Run the default workspace build command.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ];
}

export async function executeAssistantTool(
  input: ExecuteAssistantToolInput,
  handlers?: ToolProgressHandlers,
): Promise<Record<string, unknown>> {
  handlers?.onProgress?.(`starting ${input.name}`);

  switch (input.name) {
    case "run_verification":
      handlers?.onProgress?.("verification requested");
      return {
        ok: true,
        action: "RUN_VERIFICATION",
        payload: input.args,
      };

    case "generate_image":
      handlers?.onProgress?.("image generation requested");
      return {
        ok: true,
        action: "PLAN_IMAGE",
        payload: input.args,
      };

    case "list_workspace_files":
      handlers?.onProgress?.("listing workspace files");
      return {
        ok: true,
        files: [],
      };

    case "read_workspace_file":
      handlers?.onProgress?.("reading workspace file");
      return {
        ok: true,
        path: input.args.path ?? "",
        content: "",
      };

    case "write_workspace_file":
      handlers?.onProgress?.("writing workspace file");
      return {
        ok: true,
        path: input.args.path ?? "",
      };

    case "apply_workspace_patch":
      handlers?.onProgress?.("applying workspace patch");
      return {
        ok: true,
        path: input.args.path ?? "",
      };

    case "run_workspace_command":
      handlers?.onProgress?.("running workspace command");
      return {
        ok: true,
        command: input.args.command ?? "",
        exitCode: 0,
        stdout: "",
        stderr: "",
      };

    case "build_workspace":
      handlers?.onProgress?.("building workspace");
      return {
        ok: true,
        exitCode: 0,
        stdout: "",
        stderr: "",
      };

    default:
      handlers?.onProgress?.(`unknown tool: ${input.name}`);
      return {
        ok: false,
        error: `Unknown tool: ${input.name}`,
      };
  }
}
