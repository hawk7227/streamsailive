import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";
import type {
  BuildAssistantToolsInput,
  ExecuteAssistantToolInput,
  ToolProgressHandlers,
} from "./contracts";
import { executeMediaGeneration } from "./media-generation";
import { generateSong } from "@/lib/song-runtime/generateSong";
import { generateVoice } from "@/lib/voice-runtime/generateVoice";
import { searchWorkspaceFiles } from "@/lib/files/retrieval";
import { createAdminClient } from "@/lib/supabase/admin";
import { STREAMS_ALLOWED_COMMANDS, STREAMS_BUILD_COMMAND, STREAMS_COMMAND_TIMEOUT_MS, STREAMS_PERSISTENT_WORKSPACE_ROOT } from "@/lib/env";

type ToolDefinition = {
  type: "function";
  name: string;
  description: string;
  strict: boolean | null;
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
  const configured = STREAMS_PERSISTENT_WORKSPACE_ROOT;
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
    STREAMS_ALLOWED_COMMANDS ??
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
    STREAMS_COMMAND_TIMEOUT_MS,
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
      name: "web_search",
      description: "Search the web for current information, news, research, or recent developments. Use this when you need up-to-date information beyond your training data.",
      strict: true,
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query to execute" },
          num_results: { type: "number", description: "Number of results to return (1-10, default 5)" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
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
      description: "Generate an image, video, or image-to-video output. Call this immediately when the user requests any visual media. Do not ask for clarification first.",
      strict: null,
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
          longVideo: { type: "boolean" },
          realismMode: { type: "string", enum: ["strict", "balanced", "strict_everyday", "premium_commercial"] },
        },
        required: ["type", "prompt"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "generate_song",
      description: "Generate a song or music track using the configured song runtime. Supports vocal and instrumental modes, genre/mood/tempo styling, and optional lyrics.",
      strict: null,
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Description of the song to generate" },
          lyrics: { type: "string", description: "Optional lyrics to use in the song" },
          instrumental: { type: "boolean", description: "Generate an instrumental track (no vocals)" },
          genre: { type: "string", description: "Music genre (e.g. pop, hip-hop, jazz, rock)" },
          mood: { type: "string", description: "Emotional mood (e.g. upbeat, melancholic, energetic)" },
          tempo: { type: "string", description: "Tempo description (e.g. fast, slow, moderate)" },
          durationSeconds: { type: "number", description: "Target duration in seconds (10–300)" },
          provider: { type: "string", enum: ["suno", "udio", "auto"], description: "Song generation provider" },
          referenceAudioUrl: { type: "string", description: "URL of a reference audio track for style guidance" },
          requireStems: { type: "boolean", description: "Request separate stem files (vocals, instrumental) if the provider supports them" },
        },
        required: ["prompt"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "generate_voice",
      description: "Generate spoken voice audio from text using the configured voice runtime. Supports ElevenLabs and OpenAI TTS with voice selection, speed, and style control.",
      strict: null,
      parameters: {
        type: "object",
        properties: {
          text: { type: "string", description: "The text to convert to speech" },
          voice: { type: "string", description: "Voice ID or name to use" },
          provider: { type: "string", enum: ["elevenlabs", "openai"], description: "TTS provider" },
          speed: { type: "number", description: "Speaking speed multiplier (0.5–2.0, default 1.0)" },
          style: { type: "string", description: "Speaking style or persona" },
          emotion: { type: "string", description: "Emotional delivery (e.g. calm, excited, serious)" },
          format: { type: "string", enum: ["mp3", "wav"], description: "Output audio format" },
        },
        required: ["text"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "search_files",
      description: "Search uploaded files and indexed documents in the workspace using semantic similarity. Use this when the user asks about code, documents, logs, or any content they have uploaded. Returns the most relevant file chunks for the query.",
      strict: null,
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query — a question or description of what to find" },
          limit: { type: "number", description: "Maximum number of results to return (default 6, max 12)" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "list_conversation_artifacts",
      description: "List media artifacts (images, videos, audio) generated in this conversation. Use this to reference previously generated outputs, get their URLs, or present them to the user.",
      strict: null,
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["image", "video", "audio", "all"], description: "Filter by artifact type. Defaults to all." },
        },
        required: [],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "list_workspace_files",
      description: "List files in the workspace.",
      strict: null,
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
      name: "send_workspace_action",
      description: "Dispatch a workspace action to control the pipeline, preview, media shelf, editor, or generation from the assistant. Use this to trigger pipeline runs, send outputs to screens or shelf, update prompts, control concepts, open configs, and drive all main-page workspace operations.",
      strict: null,
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            description: "The workspace action type. Examples: PLAN_IMAGE, PLAN_VIDEO, PLAN_LONG_VIDEO, run_pipeline, generate_image, generate_video, generate_song, build_story_bible, SEND_TO_SCREEN, SEND_TO_SHELF, update_image_prompt, update_video_prompt, update_strategy_prompt, update_copy_prompt, update_i2v_prompt, update_qa_instruction, select_concept, approve_output, open_step_config, set_niche, run_step, REGENERATE_REALISM, EDITORPRO_SET_FILE, EDITORPRO_SET_DEVICE, EDITORPRO_SET_ZOOM, EDITORPRO_PULL_FILE, EDITORPRO_PUSH_FILE, EDITORPRO_SELECT_ELEMENT, EDITORPRO_SET_TEXT, EDITORPRO_SET_STYLE, PREVIEW_SET_ACTIVE, PREVIEW_ESCALATE, PREVIEW_PIN, MEDIA_SHELF_ADD"
          },
          payload: {
            type: "object",
            description: "Action-specific payload. For PLAN_IMAGE/PLAN_VIDEO: { prompt }. For generate_image/generate_video: { conceptId, prompt }. For SEND_TO_SCREEN: { url, mediaType, screen }. For SEND_TO_SHELF: { url, mediaType, prompt }. For update_*_prompt: { value }. For select_concept: { conceptId }. For approve_output: { type, url }. For set_niche: { nicheId }. For run_step: { stepId }. For build_story_bible: { storyText }. For EDITORPRO actions: { file, device, element, text, style }. For PREVIEW actions: { previewId, route, type }.",
            additionalProperties: true
          }
        },
        required: ["action"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "build_workspace",
      description: "Run the workspace build command.",
      strict: null,
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
    case "web_search": {
      const query = safeString(input.args.query, "query");
      const numResults = Math.min(Math.max(typeof input.args.num_results === "number" ? input.args.num_results : 5, 1), 10);
      
      if (!query) {
        return { ok: false, error: "web_search requires a query parameter" };
      }

      handlers?.onProgress?.(`searching web for: ${query}`);

      try {
        // Try using DuckDuckGo API (free, no key required)
        const searchUrl = new URL('https://api.search.brave.com/res/v1/web/search');
        searchUrl.searchParams.set('q', query);
        searchUrl.searchParams.set('count', String(numResults));
        
        const apiKey = process.env.BRAVE_SEARCH_API_KEY;
        
        if (!apiKey) {
          // Fallback: Use DuckDuckGo instant answer API (free, basic)
          const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`;
          const ddgResponse = await fetch(ddgUrl);
          if (!ddgResponse.ok) throw new Error('DuckDuckGo search failed');
          
          const ddgData = await ddgResponse.json() as any;
          const results = (ddgData.Results || []).slice(0, numResults).map((result: any) => ({
            title: result.Text || '',
            url: result.FirstURL || '',
            snippet: result.Result || '',
            source: new URL(result.FirstURL || 'https://example.com').hostname || 'duckduckgo.com',
          }));
          
          return {
            ok: true,
            query,
            results: results.length > 0 ? results : [
              {
                title: "Search via DuckDuckGo",
                url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
                snippet: `Search results for "${query}" on DuckDuckGo`,
                source: "duckduckgo.com",
              }
            ],
            searchEngine: "DuckDuckGo (Free API)",
          };
        }
        
        // Use Brave Search API (if key provided)
        const response = await fetch(searchUrl.toString(), {
          headers: {
            'Accept': 'application/json',
            'X-Subscription-Token': apiKey,
          },
        });
        
        if (!response.ok) {
          throw new Error(`Brave Search API error: ${response.statusText}`);
        }
        
        const data = await response.json() as any;
        const results = (data.web || []).map((result: any) => ({
          title: result.title || '',
          url: result.url || '',
          snippet: result.description || '',
          source: new URL(result.url || 'https://example.com').hostname || 'brave.com',
        }));
        
        return {
          ok: true,
          query,
          results: results.length > 0 ? results : [
            {
              title: "Search Results",
              url: `https://search.brave.com/search?q=${encodeURIComponent(query)}`,
              snippet: `Search results for "${query}"`,
              source: "brave.com",
            }
          ],
          searchEngine: "Brave Search API",
        };
      } catch (err) {
        // Final fallback to DuckDuckGo website search
        return {
          ok: true,
          query,
          results: [
            {
              title: "Search on DuckDuckGo",
              url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
              snippet: `Visit DuckDuckGo to search for "${query}"`,
              source: "duckduckgo.com",
            }
          ],
          searchEngine: "DuckDuckGo (Fallback)",
          note: `To enable API search, set BRAVE_SEARCH_API_KEY environment variable. Error: ${String(err)}`,
        };
      }
    }

    case "run_verification": {
      handlers?.onProgress?.("verification requested");
      return {
        ok: true,
        action: "RUN_VERIFICATION",
        payload: input.args,
      };
    }

    case "send_workspace_action": {
      const action = typeof input.args.action === "string" ? input.args.action : "";
      const payload = (input.args.payload && typeof input.args.payload === "object")
        ? input.args.payload as Record<string, unknown>
        : {};
      if (!action) {
        return { ok: false, error: "send_workspace_action requires a non-empty action field." };
      }
      handlers?.onProgress?.(`dispatching workspace action: ${action}`);
      // Return shape that realtime server translates to workspace.action WS event
      return {
        ok: true,
        action,
        payload,
      };
    }

    case "generate_media": {
      const type = safeString(input.args.type, "type") as "image" | "video" | "i2v";
      const prompt = safeString(input.args.prompt, "prompt");
      handlers?.onProgress?.(`preparing ${type} generation`);

      const workspaceId =
        typeof input.context.workspaceId === "string"
          ? input.context.workspaceId
          : typeof input.context.context?.workspaceId === "string"
            ? input.context.context.workspaceId
            : undefined;

      const conversationId =
        typeof input.context.conversationId === "string"
          ? input.context.conversationId
          : typeof input.context.context?.conversationId === "string"
            ? input.context.context.conversationId
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
        realismMode: typeof input.args.realismMode === "string" ? input.args.realismMode as "strict" | "balanced" | "strict_everyday" | "premium_commercial" : undefined,
        workspaceId,
        conversationId,
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

      // Include a preview so the realtime server can emit a file.written event
      // with content visible to the client at write time.
      // Serverless filesystems are ephemeral — the file cannot be fetched later.
      const lines = content.split("\n");
      const contentPreview = lines.slice(0, 100).join("\n");
      const ext = requestedPath.split(".").pop()?.toLowerCase() ?? "";

      return {
        ok: true,
        path: requestedPath,
        operation: "write",
        bytesWritten: Buffer.byteLength(content, "utf8"),
        contentPreview,
        language: ext || null,
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

      const lines = updated.split("\n");
      const contentPreview = lines.slice(0, 100).join("\n");
      const ext = requestedPath.split(".").pop()?.toLowerCase() ?? "";

      return {
        ok: true,
        path: requestedPath,
        operation: "patch",
        replaced: true,
        bytesWritten: Buffer.byteLength(updated, "utf8"),
        contentPreview,
        language: ext || null,
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
          : STREAMS_BUILD_COMMAND || "pnpm run build";

      return await runCommand(command, handlers);
    }

    case "search_files": {
      const query = safeString(input.args.query, "query");
      const limit = typeof input.args.limit === "number"
        ? Math.min(Math.max(1, Math.floor(input.args.limit)), 12)
        : 6;

      const workspaceId =
        typeof input.context.workspaceId === "string"
          ? input.context.workspaceId
          : typeof input.context.context?.workspaceId === "string"
            ? input.context.context.workspaceId
            : undefined;

      if (!workspaceId) {
        return { ok: false, error: "workspaceId is required to search files", matches: [] };
      }

      handlers?.onProgress?.("searching files");

      const matches = await searchWorkspaceFiles(workspaceId, query, limit);

      return {
        ok: true,
        query,
        matchCount: matches.length,
        matches: matches.map((m) => ({
          fileName: m.fileName,
          mimeType: m.mimeType,
          chunkIndex: m.chunkIndex,
          content: m.content.slice(0, 2000),
          relevance: m.rank,
        })),
      };
    }

    case "list_conversation_artifacts": {
      const typeFilter = typeof input.args.type === "string" ? input.args.type : "all";
      const conversationId =
        typeof input.context.conversationId === "string"
          ? input.context.conversationId
          : typeof input.context.context?.conversationId === "string"
            ? input.context.context.conversationId
            : undefined;

      if (!conversationId) {
        return { ok: false, error: "No conversation ID in context", artifacts: [] };
      }

      handlers?.onProgress?.("retrieving conversation artifacts");

      const admin = createAdminClient();
      let query = admin
        .from("artifacts")
        .select("id, type, storage_url, mime_type, duration_seconds, metadata, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (typeFilter !== "all") {
        query = query.eq("type", typeFilter);
      }

      const { data, error } = await query;
      if (error) {
        return { ok: false, error: error.message, artifacts: [] };
      }

      return {
        ok: true,
        conversationId,
        artifactCount: data?.length ?? 0,
        artifacts: (data ?? []).map((a) => ({
          id: a.id,
          type: a.type,
          url: a.storage_url,
          mimeType: a.mime_type,
          durationSeconds: a.duration_seconds,
          createdAt: a.created_at,
        })),
      };
    }

    case "generate_song": {
      const prompt = safeString(input.args.prompt, "prompt");
      const workspaceId =
        typeof input.context.context?.workspaceId === "string"
          ? input.context.context.workspaceId
          : undefined;

      handlers?.onProgress?.("preparing song generation");

      const result = await generateSong({
        prompt,
        lyrics: typeof input.args.lyrics === "string" ? input.args.lyrics : undefined,
        instrumental: input.args.instrumental === true,
        genre: typeof input.args.genre === "string" ? input.args.genre : undefined,
        mood: typeof input.args.mood === "string" ? input.args.mood : undefined,
        tempo: typeof input.args.tempo === "string" ? input.args.tempo : undefined,
        durationSeconds: typeof input.args.durationSeconds === "number" ? input.args.durationSeconds : undefined,
        provider: typeof input.args.provider === "string" ? input.args.provider : undefined,
        referenceAudioUrl: typeof input.args.referenceAudioUrl === "string" ? input.args.referenceAudioUrl : undefined,
        requireStems: input.args.requireStems === true,
        workspaceId,
      });

      handlers?.onProgress?.(`song generation ${result.status}`);
      return result;
    }

    case "generate_voice": {
      const text = safeString(input.args.text, "text");
      const workspaceId =
        typeof input.context.context?.workspaceId === "string"
          ? input.context.context.workspaceId
          : undefined;

      handlers?.onProgress?.("preparing voice synthesis");

      const result = await generateVoice({
        text,
        voice: typeof input.args.voice === "string" ? input.args.voice : undefined,
        provider: typeof input.args.provider === "string" ? input.args.provider : undefined,
        speed: typeof input.args.speed === "number" ? input.args.speed : undefined,
        style: typeof input.args.style === "string" ? input.args.style : undefined,
        emotion: typeof input.args.emotion === "string" ? input.args.emotion : undefined,
        format: input.args.format === "wav" ? "wav" : "mp3",
        workspaceId,
      });

      handlers?.onProgress?.(`voice synthesis ${result.status}`);
      return result;
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







