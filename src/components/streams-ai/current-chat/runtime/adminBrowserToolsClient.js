const LOCAL_AGENT_BASE_URL = "http://127.0.0.1:5777";

const TOOL_NAMES = [
  "admin.workspace.pass",
  "admin.browser.check",
  "admin.browser.screenshot",
  "admin.browser.dom",
  "admin.browser.click",
  "admin.browser.type",
  "admin.browser.press",
];

export function isAdminBrowserToolIntent(message) {
  const text = String(message || "").toLowerCase();
  return TOOL_NAMES.some((name) => text.includes(name));
}

function stripAnsi(value) {
  return String(value || "")
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/\u001b\][^\u0007]*(?:\u0007|\u001b\\)/g, "")
    .replace(/\r/g, "")
    .replace(/\u001b/g, "");
}

function cleanOutput(value, max = 1200) {
  return stripAnsi(value).trim().slice(0, max);
}

function parseNumberArg(text, key) {
  const patterns = [
    new RegExp(`${key}\\s*[=:]\\s*(-?\\d+(?:\\.\\d+)?)`, "i"),
    new RegExp(`\\b${key}\\s+(-?\\d+(?:\\.\\d+)?)`, "i"),
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return Number(match[1]);
  }

  return null;
}

function parseTextArg(text) {
  const quoted = text.match(/text\s*=\s*"([\s\S]*?)"/i) || text.match(/text\s*=\s*'([\s\S]*?)'/i);
  if (quoted) return quoted[1];

  const afterTool = text.match(/admin\.browser\.type\s+([\s\S]+)/i);
  if (afterTool) return afterTool[1].trim();

  return "";
}

function parseKeyArg(text) {
  const match = text.match(/key\s*[=:]\s*([A-Za-z0-9+_-]+)/i) || text.match(/admin\.browser\.press\s+([A-Za-z0-9+_-]+)/i);
  return match ? match[1] : "Enter";
}

async function requestLocalAgent(path, options = {}) {
  const response = await fetch(`${LOCAL_AGENT_BASE_URL}${path}`, {
    cache: "no-store",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data?.success === false) {
    throw new Error(data?.error || `Local agent request failed: ${response.status}`);
  }

  return data;
}

async function requestLocalAgentReport(path, options = {}) {
  const response = await fetch(`${LOCAL_AGENT_BASE_URL}${path}`, {
    cache: "no-store",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok && !data?.status) {
    throw new Error(data?.error || `Local agent request failed: ${response.status}`);
  }

  return data;
}

async function requestCheck(payload) {
  const response = await fetch("/api/admin-browser/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.success === false) {
    throw new Error(data?.error || `Admin browser check failed: ${response.status}`);
  }
  return data;
}

function summarizeScreenshot(data) {
  return [
    "admin.browser.screenshot completed.",
    `URL: ${data.url || "unknown"}`,
    `Captured: ${data.capturedAt || "unknown"}`,
    data.image ? "Screenshot image returned from local agent and refreshed in admin-control." : "No image was returned.",
  ].join("\n");
}

function summarizeDom(data) {
  const elements = Array.isArray(data.elements) ? data.elements : [];
  const top = elements.slice(0, 12).map((element) => {
    const rect = element.rect || {};
    return `${element.index}. ${element.label || element.tag} [${element.tag}] x:${rect.x} y:${rect.y} w:${rect.width} h:${rect.height}`;
  });

  return [
    "admin.browser.dom completed.",
    `URL: ${data.url || "unknown"}`,
    `Elements: ${elements.length}`,
    ...top,
  ].join("\n");
}

function summarizeWorkspacePass(data) {
  const commandLines = (data.commandResults || []).map((item) => {
    const status = item.success ? "PASS" : "ISSUE";
    const output = cleanOutput(`${item.stdout || item.stderr || ""}`);
    return `${status}: ${item.command}\n${output || "No output."}`;
  });

  return [
    `admin.workspace.pass ${data.status || (data.success ? "PASS" : "ISSUE")}`,
    `Workspace: ${data.workspace || "unknown"}`,
    `Browser DOM elements: ${data.browser?.domElements ?? "not captured"}`,
    `Console events: ${data.browser?.consoleEvents?.length ?? 0}`,
    ...commandLines,
  ].join("\n\n");
}

export async function runAdminBrowserTool(message) {
  const text = String(message || "").trim();
  const lower = text.toLowerCase();

  if (lower.includes("admin.workspace.pass")) {
    const data = await requestLocalAgentReport("/workspace/pass", {
      method: "POST",
      body: JSON.stringify({ workspaceIndex: 0, commands: ["git-status", "npm-build"] }),
    });
    return { tool: "admin.workspace.pass", data, responseText: summarizeWorkspacePass(data) };
  }

  if (lower.includes("admin.browser.check")) {
    const screenshot = await requestLocalAgent("/browser/screenshot");
    const dom = await requestLocalAgent("/browser/dom");
    const status = await requestLocalAgent("/status");
    const check = await requestCheck({
      url: screenshot.url || dom.url || status?.browser?.url,
      screenshot: screenshot.image,
      dom,
      consoleEvents: status?.browser?.consoleEvents || [],
    });

    return {
      tool: "admin.browser.check",
      data: check,
      responseText: check.report || "admin.browser.check completed, but no report was returned.",
    };
  }

  if (lower.includes("admin.browser.screenshot")) {
    const data = await requestLocalAgent("/browser/screenshot");
    return { tool: "admin.browser.screenshot", data, responseText: summarizeScreenshot(data) };
  }

  if (lower.includes("admin.browser.dom")) {
    const data = await requestLocalAgent("/browser/dom");
    return { tool: "admin.browser.dom", data, responseText: summarizeDom(data) };
  }

  if (lower.includes("admin.browser.click")) {
    const x = parseNumberArg(text, "x");
    const y = parseNumberArg(text, "y");
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error("admin.browser.click requires x and y, for example: admin.browser.click x=400 y=250");
    }
    const data = await requestLocalAgent("/browser/click", {
      method: "POST",
      body: JSON.stringify({ x, y }),
    });
    return {
      tool: "admin.browser.click",
      data,
      responseText: `admin.browser.click completed at x=${x}, y=${y}.\nURL: ${data.url || "unknown"}\nScreenshot: ${data.screenshotAt || "updated"}`,
    };
  }

  if (lower.includes("admin.browser.type")) {
    const textToType = parseTextArg(text);
    if (!textToType) {
      throw new Error("admin.browser.type requires text, for example: admin.browser.type text=\"hello\"");
    }
    const data = await requestLocalAgent("/browser/type", {
      method: "POST",
      body: JSON.stringify({ text: textToType }),
    });
    return {
      tool: "admin.browser.type",
      data,
      responseText: `admin.browser.type completed. Characters typed: ${textToType.length}.\nURL: ${data.url || "unknown"}\nScreenshot: ${data.screenshotAt || "updated"}`,
    };
  }

  if (lower.includes("admin.browser.press")) {
    const key = parseKeyArg(text);
    const data = await requestLocalAgent("/browser/press", {
      method: "POST",
      body: JSON.stringify({ key }),
    });
    return {
      tool: "admin.browser.press",
      data,
      responseText: `admin.browser.press completed. Key: ${key}.\nURL: ${data.url || "unknown"}\nScreenshot: ${data.screenshotAt || "updated"}`,
    };
  }

  throw new Error("No supported admin browser tool found in the message.");
}
