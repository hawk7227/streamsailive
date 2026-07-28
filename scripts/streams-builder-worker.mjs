import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import crypto from "node:crypto";

const port = Number(process.env.PORT || process.env.STREAMS_WORKER_PORT || 8080);
const workspaceRoot = path.resolve(process.env.STREAMS_PERSISTENT_WORKSPACE_ROOT || "/workspace");
const authToken = String(process.env.STREAMS_WORKER_AUTH_TOKEN || "").trim();
const maxBodyBytes = Number(process.env.STREAMS_WORKER_MAX_BODY_BYTES || 1_000_000);
const commandTimeoutMs = Number(process.env.STREAMS_COMMAND_TIMEOUT_MS || 120_000);
const allowedCommands = new Set(
  String(process.env.STREAMS_ALLOWED_COMMANDS || "git,node,npm,npx,pnpm,corepack,tsc,next")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);

function json(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function unauthorized(res) {
  json(res, 401, { ok: false, error: "unauthorized" });
}

function isAuthorized(req) {
  if (!authToken) return false;
  const header = String(req.headers.authorization || "");
  if (!header.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(header.slice(7));
  const expected = Buffer.from(authToken);
  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
}

async function readBody(req) {
  let total = 0;
  const chunks = [];
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBodyBytes) throw new Error("request_body_too_large");
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function safeSegment(value, field) {
  const text = String(value || "").trim();
  if (!text || !/^[a-zA-Z0-9._-]+$/.test(text)) throw new Error(`invalid_${field}`);
  return text;
}

function projectRoot(body) {
  const tenantId = safeSegment(body.tenantId, "tenantId");
  const projectId = safeSegment(body.projectId, "projectId");
  return path.join(workspaceRoot, "tenants", tenantId, "projects", projectId);
}

function resolveProjectPath(body, requestedPath = ".") {
  const root = projectRoot(body);
  const normalized = path.normalize(String(requestedPath || "."));
  if (path.isAbsolute(normalized)) throw new Error("absolute_paths_not_allowed");
  const resolved = path.resolve(root, normalized);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("path_escape_blocked");
  return { root, resolved };
}

function parseCommand(command) {
  const parts = String(command || "").match(/(?:[^\s"]+|"[^"]*")+/g)?.map((part) => part.replace(/^"(.*)"$/, "$1")) || [];
  if (parts.length === 0) throw new Error("command_required");
  if (!allowedCommands.has(parts[0])) throw new Error(`command_not_allowed:${parts[0]}`);
  return { bin: parts[0], args: parts.slice(1) };
}

async function runCommand(body) {
  const { root } = resolveProjectPath(body, ".");
  const cwd = resolveProjectPath(body, body.cwd || "repo").resolved;
  await fs.mkdir(root, { recursive: true });
  await fs.mkdir(cwd, { recursive: true });
  const { bin, args } = parseCommand(body.command);
  const startedAt = Date.now();

  return await new Promise((resolve) => {
    const child = spawn(bin, args, {
      cwd,
      shell: false,
      env: { ...process.env, HOME: path.join(root, ".home") },
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        ...result,
        command: [bin, ...args].join(" "),
        cwd: path.relative(root, cwd) || ".",
        durationMs: Date.now() - startedAt,
        stdout: stdout.slice(-200_000),
        stderr: stderr.slice(-200_000),
      });
    };
    const timer = setTimeout(() => {
      try { child.kill("SIGKILL"); } catch {}
      finish({ ok: false, exitCode: null, timedOut: true, error: "command_timeout" });
    }, commandTimeoutMs);
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", (error) => finish({ ok: false, exitCode: null, error: error.message }));
    child.on("close", (code, signal) => finish({ ok: code === 0, exitCode: code, signal }));
  });
}

async function handle(req, res) {
  const url = new URL(req.url || "/", "http://worker.local");

  if (req.method === "GET" && url.pathname === "/health") {
    let workspaceWritable = false;
    try {
      await fs.mkdir(workspaceRoot, { recursive: true });
      const probe = path.join(workspaceRoot, `.health-${crypto.randomUUID()}`);
      await fs.writeFile(probe, "ok", "utf8");
      await fs.unlink(probe);
      workspaceWritable = true;
    } catch {}
    return json(res, workspaceWritable && authToken ? 200 : 503, {
      ok: workspaceWritable && Boolean(authToken),
      service: "streams-builder-worker",
      version: "2",
      workspaceRoot,
      workspaceWritable,
      authConfigured: Boolean(authToken),
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  }

  if (!isAuthorized(req)) return unauthorized(res);
  const body = await readBody(req);

  if (req.method === "POST" && url.pathname === "/v1/workspaces/ensure") {
    const root = projectRoot(body);
    for (const dir of ["repo", "artifacts", "logs", "tmp", ".home"]) {
      await fs.mkdir(path.join(root, dir), { recursive: true });
    }
    return json(res, 200, { ok: true, workspacePath: root });
  }

  if (req.method === "POST" && url.pathname === "/v1/files/read") {
    const { root, resolved } = resolveProjectPath(body, body.path);
    const content = await fs.readFile(resolved, "utf8");
    return json(res, 200, { ok: true, path: path.relative(root, resolved), content });
  }

  if (req.method === "POST" && url.pathname === "/v1/files/write") {
    const { root, resolved } = resolveProjectPath(body, body.path);
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, String(body.content ?? ""), "utf8");
    return json(res, 200, { ok: true, path: path.relative(root, resolved), bytesWritten: Buffer.byteLength(String(body.content ?? "")) });
  }

  if (req.method === "POST" && url.pathname === "/v1/files/patch") {
    const { root, resolved } = resolveProjectPath(body, body.path);
    const current = await fs.readFile(resolved, "utf8");
    const find = String(body.find ?? "");
    if (!find || !current.includes(find)) return json(res, 409, { ok: false, error: "patch_target_not_found" });
    const updated = current.replace(find, String(body.replace ?? ""));
    await fs.writeFile(resolved, updated, "utf8");
    return json(res, 200, { ok: true, path: path.relative(root, resolved), replaced: true });
  }

  if (req.method === "POST" && ["/v1/commands/run", "/v1/builds/run", "/v1/git/status"].includes(url.pathname)) {
    const effectiveBody = url.pathname === "/v1/git/status" ? { ...body, command: "git status --short --branch" } : body;
    const result = await runCommand(effectiveBody);
    return json(res, result.ok ? 200 : 422, result);
  }

  if (req.method === "POST" && url.pathname === "/v1/commission") {
    const root = projectRoot(body);
    await fs.mkdir(path.join(root, "tmp"), { recursive: true });
    const probe = path.join(root, "tmp", "commissioning.txt");
    const phase = String(body.phase || "write");

    if (phase === "check") {
      const expectedNonce = String(body.expectedNonce || "");
      const persisted = await fs.readFile(probe, "utf8").catch(() => "");
      return json(res, persisted === `${expectedNonce}:patched` ? 200 : 409, {
        ok: persisted === `${expectedNonce}:patched`,
        phase: "check",
        workspacePath: root,
        persistenceProbePath: path.relative(root, probe),
        persistedAcrossRestart: persisted === `${expectedNonce}:patched`,
      });
    }

    const nonce = crypto.randomUUID();
    await fs.writeFile(probe, nonce, "utf8");
    const readBack = await fs.readFile(probe, "utf8");
    await fs.writeFile(probe, `${readBack}:patched`, "utf8");
    const patched = await fs.readFile(probe, "utf8");
    return json(res, 200, {
      ok: readBack === nonce && patched === `${nonce}:patched`,
      phase: "write",
      workspacePath: root,
      persistenceProbePath: path.relative(root, probe),
      nonce,
      nextStep: "restart_worker_then_call_with_phase_check_and_expectedNonce",
    });
  }

  return json(res, 404, { ok: false, error: "not_found" });
}

await fs.mkdir(workspaceRoot, { recursive: true });

const server = http.createServer((req, res) => {
  handle(req, res).catch((error) => {
    console.error(JSON.stringify({ level: "error", event: "WORKER_REQUEST_FAILED", message: error instanceof Error ? error.message : String(error) }));
    json(res, 500, { ok: false, error: error instanceof Error ? error.message : "worker_error" });
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(JSON.stringify({ level: "info", event: "STREAMS_BUILDER_WORKER_STARTED", port, workspaceRoot, authConfigured: Boolean(authToken) }));
});