import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";
import type {
  BuildAssistantToolsInput,
  ExecuteAssistantToolInput,
  ToolProgressHandlers,
} from "./contracts";
import { executeMediaGeneration } from "./media-generation";

type ToolDefinition = {
  type: "function";
  name: string;
  description: string;
  strict: boolean;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
};

type JsonObject = Record<string, unknown>;

const DEFAULT_COMMAND_TIMEOUT_MS = 120_000;

function getPersistentWorkspaceRoot(): string | null {
  const configured = process.env.STREAMS_PERSISTENT_WORKSPACE_ROOT?.trim();
  if (!configured) return null;
  return path.resolve(configured);
}

function getReadableWorkspaceRoot(): string {
  return getPersistentWorkspaceRoot() ?? process.cwd();
}

function getWritableWorkspaceRoot(): string {
  const root = getPersistentWorkspaceRoot();
  if (!root) {
    throw new Error(
      "Persistent workspace is not configured. Set STREAMS_PERSISTENT_WORKSPACE_ROOT to enable durable file writes.",
    );
  }
  return root;
}

function isSubpath(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return !!relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function resolveWorkspacePath(
  inputPath: unknown,
  options: { writable: boolean },
): string {
  if (typeof inputPath !== "string" || !inputPath.trim()) {
    throw new Error("A non-empty workspace path is required.");
  }

  const root = options.writable
    ? getWritableWorkspaceRoot()
    : getReadableWorkspaceRoot();

  const trimmed = inputPath.trim();

  if (path.isAbsolute(trimmed)) {
    throw new Error("Absolute paths are not allowed.");
  }

  const normalized = path.normalize(trimmed);
  const resolved = path.resolve(root, normalized);

  if (resolved === root) return resolved;
  if (!isSubpath(root, resolved)) {
    throw new Error("Path escapes the workspace root.");
  }

  return resolved;
}

async function ensureInsideWritableRoot(filePath: string): Promise<void> {
  const root = getWritableWorkspaceRoot();
  if (filePath !== root && !isSubpath(root, filePath)) {
    throw new Error("Write path escapes the persistent workspace root.");
  }
}

async function listDirectoryRecursive(
  dir: string,
  root: string,
  maxEntries = 500,
): Promise<string[]> {
  const output: string[] = [];

  async function walk(current: string) {
    if (output.length >= maxEntries) return;

    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (output.length >= maxEntries) break;

      const full = path.join(current, entry.name);
      const rel = path.relative(root, full).replace(/\\/g, "/");

      if (
        entry.name === ".git" ||
        entry.name === "node_modules" ||
        entry.name === ".next" ||
        entry.name === ".turbo"
      ) {
        continue;
      }

      output.push(entry.isDirectory() ? `${rel}/` : rel);

      if (entry.isDirectory()) {
        await walk(full);
      }
    }
  }

  await walk(dir);
  return output;
}

function parsePositiveInt(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    return Number(value);
  }
  return fallback;
}

function getAllowedCommands(): Set<string> {
  const raw =
    process.env.STREAMS_ALLOWED_COMMANDS ??
    "pnpm,pnpm.cmd,npm,npm.cmd,node,node.exe,tsc,tsc.cmd,next,next.cmd";
  return new Set(
    raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function parseCommand(command: unknown): { bin: string; args: string[] } {
  if (typeof command !== "string" || !command.trim()) {
    throw new Error("A command string is required.");
  }

  const parts =
    command.match(/(?:[^\s"]+|"[^"]*")+/g)?.map((part) =>
      part.replace(/^"(.*)"$/, "$1"),
    ) ?? [];

  if (parts.length === 0) {
    throw new Error("Unable to parse command.");
  }

  return { bin: parts[0], args: parts.slice(1) };
}

function assertAllowedCommand(bin: string): void {
  const allowed = getAllowedCommands();
  if (!allowed.has(bin)) {
    throw new Error(
      `Command "${bin}" is not allowed. Allowed commands: ${Array.from(allowed).join(", ")}`,
    );
  }
}

async function runCommand(
  command: string,
  handlers?: ToolProgressHandlers,
): Promise<JsonObject> {
  const { bin, args } = parseCommand(command);
  assertAllowedCommand(bin);

  const cwd = getReadableWorkspaceRoot();
  const timeoutMs = parsePositiveInt(
    process.env.STREAMS_COMMAND_TIMEOUT_MS,
    DEFAULT_COMMAND_TIMEOUT_MS,
  );

  handlers?.onProgress?.(`running ${bin} ${args.join(" ")}`.trim());

  return await new Promise<JsonObject>((resolve) => {
    const child = spawn(bin, args, {
      cwd,
      shell: false,
      env: process.env,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (result: JsonObject) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      handlers?.onProgress?.(`command timeout after ${timeoutMs}ms`);
      try {
        child.kill("SIGKILL");
      } catch {}
      finish({
        ok: false,
        exitCode: null,
        stdout,
        stderr,
        error: `Command timed out after ${timeoutMs}ms`,
        timedOut: true,
      });
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer | string) => {
      const text = chunk.toString();
      stdout += text;
      handlers?.onProgress?.(text.slice(-4000));
    });

    child.stderr.on("data", (chunk: Buffer | string) => {
      const text = chunk.toString();
      stderr += text;
      handlers?.onProgress?.(text.slice(-4000));
    });

    child.on("error", (error) => {
      finish({
        ok: false,
        exitCode: null,
        stdout,
        stderr,
        error: error.message,
      });
    });

    child.on("close", (code, signal) => {
      finish({
        ok: code === 0,
        exitCode: code,
        signal,
        stdout,
        stderr,
      });
    });
  });
}

function safeString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new Error(`${field} must be a string.`);
  }
  return value;
}

export function buildAssistantTools(
  _input: BuildAssistantToolsInput,
): ToolDefinition[] {
  return [
    {
      type: "function",
      name: "run_verification",
      description: "Run a verification pass for a request.",
      strict: true,
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
      name: "generate_media",
      description: "Generate an image, video, or image-to-video output using the configured media pipeline.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["image", "video", "i2v"] },
          prompt: { type: "string" },
          provider: { type: "string" },
          model: { type: "string" },
          duration: { type: "string" },
          aspectRatio: { type: "string" },
          quality: { type: "string" },
          imageUrl: { type: "string" },
          storyBible: { type: "string" },
          longVideo: { type: "boolean" }
        },
        required: ["type", "prompt"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "list_workspace_files",
      description: "List files in the workspace.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          recursive: { type: "boolean" },
          maxEntries: { type: "number" },
        },
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "read_workspace_file",
      description: "Read a file from the workspace.",
      strict: true,
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
      description: "Write a file in the persistent workspace.",
      strict: true,
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
      description:
        "Apply a literal string replacement patch to a workspace file.",
      strict: true,
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
      strict: true,
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
      description: "Run the workspace build command.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          command: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  ];
}

export async function executeAssistantTool(
  input: ExecuteAssistantToolInput,
  handlers?: ToolProgressHandlers,
): Promise<JsonObject> {
  handlers?.onProgress?.(`starting ${input.name}`);

  switch (input.name) {
    case "run_verification": {
      handlers?.onProgress?.("verification requested");
      return {
        ok: true,
        action: "RUN_VERIFICATION",
        payload: input.args,
      };
    }

    case "generate_media": {
      const type = safeString(input.args.type, "type") as "image" | "video" | "i2v";
      const prompt = safeString(input.args.prompt, "prompt");
      handlers?.onProgress?.(`preparing ${type} generation`);

      const workspaceId =
        typeof input.context.context?.workspaceId === "string"
          ? input.context.context.workspaceId
          : undefined;

      const result = await executeMediaGeneration({
        type,
        prompt,
        provider: typeof input.args.provider === "string" ? input.args.provider : undefined,
        model: typeof input.args.model === "string" ? input.args.model : undefined,
        duration: typeof input.args.duration === "string" ? input.args.duration : undefined,
        aspectRatio: typeof input.args.aspectRatio === "string" ? input.args.aspectRatio : undefined,
        quality: typeof input.args.quality === "string" ? input.args.quality : undefined,
        imageUrl: typeof input.args.imageUrl === "string" ? input.args.imageUrl : undefined,
        storyBible: typeof input.args.storyBible === "string" ? input.args.storyBible : undefined,
        longVideo: input.args.longVideo === true,
        workspaceId,
      });

      handlers?.onProgress?.(`${type} generation ${result.status}`);
      return result;
    }

    case "list_workspace_files": {
      const requestedPath =
        typeof input.args.path === "string" && input.args.path.trim()
          ? input.args.path
          : ".";
      const recursive = Boolean(input.args.recursive);
      const maxEntries = parsePositiveInt(input.args.maxEntries, 200);

      const resolved = resolveWorkspacePath(requestedPath, { writable: false });
      const stat = await fs.stat(resolved);

      if (!stat.isDirectory()) {
        throw new Error("Path is not a directory.");
      }

      handlers?.onProgress?.(`listing ${requestedPath}`);

      const files = recursive
        ? await listDirectoryRecursive(resolved, getReadableWorkspaceRoot(), maxEntries)
        : (
            await fs.readdir(resolved, { withFileTypes: true })
          )
            .filter(
              (entry) =>
                entry.name !== ".git" &&
                entry.name !== "node_modules" &&
                entry.name !== ".next" &&
                entry.name !== ".turbo",
            )
            .slice(0, maxEntries)
            .map((entry) => {
              const rel = path
                .relative(getReadableWorkspaceRoot(), path.join(resolved, entry.name))
                .replace(/\\/g, "/");
              return entry.isDirectory() ? `${rel}/` : rel;
            });

      return {
        ok: true,
        root: getReadableWorkspaceRoot(),
        path: requestedPath,
        recursive,
        files,
      };
    }

    case "read_workspace_file": {
      const requestedPath = safeString(input.args.path, "path");
      const resolved = resolveWorkspacePath(requestedPath, { writable: false });

      handlers?.onProgress?.(`reading ${requestedPath}`);

      const stat = await fs.stat(resolved);
      if (!stat.isFile()) {
        throw new Error("Path is not a file.");
      }

      const content = await fs.readFile(resolved, "utf8");

      return {
        ok: true,
        path: requestedPath,
        content,
      };
    }

    case "write_workspace_file": {
      const requestedPath = safeString(input.args.path, "path");
      const content = safeString(input.args.content, "content");
      const resolved = resolveWorkspacePath(requestedPath, { writable: true });

      await ensureInsideWritableRoot(resolved);
      handlers?.onProgress?.(`writing ${requestedPath}`);

      await fs.mkdir(path.dirname(resolved), { recursive: true });
      await fs.writeFile(resolved, content, "utf8");

      return {
        ok: true,
        path: requestedPath,
        bytesWritten: Buffer.byteLength(content, "utf8"),
        persistentRoot: getWritableWorkspaceRoot(),
      };
    }

    case "apply_workspace_patch": {
      const requestedPath = safeString(input.args.path, "path");
      const find = safeString(input.args.find, "find");
      const replace = safeString(input.args.replace, "replace");
      const resolved = resolveWorkspacePath(requestedPath, { writable: true });

      await ensureInsideWritableRoot(resolved);
      handlers?.onProgress?.(`patching ${requestedPath}`);

      const current = await fs.readFile(resolved, "utf8");
      if (!current.includes(find)) {
        throw new Error("Patch target string was not found in the file.");
      }

      const updated = current.replace(find, replace);
      await fs.writeFile(resolved, updated, "utf8");

      return {
        ok: true,
        path: requestedPath,
        replaced: true,
      };
    }

    case "run_workspace_command": {
      const command = safeString(input.args.command, "command");
      return await runCommand(command, handlers);
    }

    case "build_workspace": {
      const command =
        typeof input.args.command === "string" && input.args.command.trim()
          ? input.args.command
          : process.env.STREAMS_BUILD_COMMAND?.trim() || "pnpm run build";

      return await runCommand(command, handlers);
    }

    default: {
      handlers?.onProgress?.(`unknown tool: ${input.name}`);
      return {
        ok: false,
        error: `Unknown tool: ${input.name}`,
      };
    }
  }
}
