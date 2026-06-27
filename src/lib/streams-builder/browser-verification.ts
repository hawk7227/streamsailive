export type BrowserVerificationTruthState = "PROVEN" | "FAILED" | "UNPROVEN";

export type BrowserVerificationAction =
  | { type: "goto"; url: string }
  | { type: "click"; selector: string }
  | { type: "fill"; selector: string; value: string }
  | { type: "wait_for_selector"; selector: string }
  | { type: "expect_text"; selector: string; text: string };

export interface BrowserVerificationRequest {
  projectId: string;
  sessionId: string;
  targetUrl: string;
  route?: string;
  actions: BrowserVerificationAction[];
}

export interface BrowserScreenshotArtifact {
  id: string;
  kind: "browser_screenshot";
  viewport: { width: number; height: number };
  mimeType: "image/png";
  dataUrl: string;
  capturedAt: string;
}

export interface BrowserVerificationResult {
  ok: boolean;
  truthState: BrowserVerificationTruthState;
  targetUrl: string;
  finalUrl?: string;
  title?: string;
  proof: string[];
  unproven: string[];
  errors: string[];
  consoleMessages: string[];
  networkFailures: string[];
  screenshot?: BrowserScreenshotArtifact;
}

function isSafeUrl(value: string) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return false;
    if (url.username || url.password) return false;
    const host = url.hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host.endsWith(".vercel.app") || host.endsWith("streamsailive.com") || host.endsWith("streams.ai");
  } catch {
    return false;
  }
}

function isSafeSelector(value: string) {
  return value.length > 0 && value.length <= 300 && !/[<>]/.test(value);
}

function createScreenshotArtifact(buffer: Buffer, viewport: { width: number; height: number }): BrowserScreenshotArtifact {
  return {
    id: `browser-shot-${Date.now()}`,
    kind: "browser_screenshot",
    viewport,
    mimeType: "image/png",
    dataUrl: `data:image/png;base64,${buffer.toString("base64")}`,
    capturedAt: new Date().toISOString(),
  };
}

export function validateBrowserVerificationRequest(request: BrowserVerificationRequest) {
  const errors: string[] = [];
  if (!request.projectId?.trim()) errors.push("projectId is required.");
  if (!request.sessionId?.trim()) errors.push("sessionId is required.");
  if (!request.targetUrl?.trim() || !isSafeUrl(request.targetUrl)) errors.push("targetUrl must be a safe http(s) preview URL.");
  if (!Array.isArray(request.actions) || request.actions.length === 0) errors.push("actions are required.");
  if (request.actions.length > 25) errors.push("actions cannot exceed 25 steps.");

  for (const action of request.actions || []) {
    if ("selector" in action && !isSafeSelector(action.selector)) {
      errors.push(`Unsafe selector for ${action.type}.`);
    }
    if (action.type === "goto" && !isSafeUrl(action.url)) {
      errors.push("goto action URL must be safe.");
    }
    if (action.type === "fill" && action.value.length > 1000) {
      errors.push("fill value is too long.");
    }
  }

  return errors;
}

export async function runBrowserVerification(request: BrowserVerificationRequest): Promise<BrowserVerificationResult> {
  const errors = validateBrowserVerificationRequest(request);
  if (errors.length > 0) {
    return {
      ok: false,
      truthState: "FAILED",
      targetUrl: request.targetUrl,
      proof: ["browser verification validation executed"],
      unproven: ["browser did not run"],
      errors,
      consoleMessages: [],
      networkFailures: [],
    };
  }

  let chromium: typeof import("@playwright/test")["chromium"] | null = null;
  try {
    chromium = (await import("@playwright/test")).chromium;
  } catch (error) {
    return {
      ok: false,
      truthState: "UNPROVEN",
      targetUrl: request.targetUrl,
      proof: ["browser verification request validated"],
      unproven: ["Playwright runtime unavailable"],
      errors: [error instanceof Error ? error.message : "Playwright runtime unavailable"],
      consoleMessages: [],
      networkFailures: [],
    };
  }

  const proof: string[] = ["browser verification request validated"];
  const unproven: string[] = [];
  const consoleMessages: string[] = [];
  const networkFailures: string[] = [];
  const runErrors: string[] = [];
  const browser = await chromium.launch({ headless: true });

  try {
    const viewport = { width: 1440, height: 1000 };
    const page = await browser.newPage({ viewport });
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) consoleMessages.push(`${message.type()}: ${message.text()}`.slice(0, 500));
    });
    page.on("requestfailed", (requestFailure) => {
      networkFailures.push(`${requestFailure.method()} ${requestFailure.url()} ${requestFailure.failure()?.errorText || "failed"}`.slice(0, 700));
    });

    await page.goto(request.targetUrl, { waitUntil: "networkidle", timeout: 45_000 });
    proof.push(`opened ${request.targetUrl}`);

    for (const action of request.actions) {
      if (action.type === "goto") {
        await page.goto(action.url, { waitUntil: "networkidle", timeout: 45_000 });
        proof.push(`navigated to ${action.url}`);
      }
      if (action.type === "click") {
        await page.locator(action.selector).first().click({ timeout: 15_000 });
        proof.push(`clicked ${action.selector}`);
      }
      if (action.type === "fill") {
        await page.locator(action.selector).first().fill(action.value, { timeout: 15_000 });
        proof.push(`filled ${action.selector}`);
      }
      if (action.type === "wait_for_selector") {
        await page.locator(action.selector).first().waitFor({ state: "visible", timeout: 15_000 });
        proof.push(`saw ${action.selector}`);
      }
      if (action.type === "expect_text") {
        const actual = await page.locator(action.selector).first().innerText({ timeout: 15_000 });
        if (!actual.includes(action.text)) throw new Error(`Expected text not found in ${action.selector}`);
        proof.push(`verified text in ${action.selector}`);
      }
    }

    const finalUrl = page.url();
    const title = await page.title();
    const screenshot = createScreenshotArtifact(await page.screenshot({ fullPage: true, type: "png" }), viewport);
    proof.push(`captured screenshot artifact ${screenshot.id}`);
    if (consoleMessages.length > 0) unproven.push("console warnings/errors require review");
    if (networkFailures.length > 0) unproven.push("network failures require review");
    const truthState: BrowserVerificationTruthState = runErrors.length > 0 ? "FAILED" : unproven.length > 0 ? "UNPROVEN" : "PROVEN";

    return {
      ok: truthState !== "FAILED",
      truthState,
      targetUrl: request.targetUrl,
      finalUrl,
      title,
      proof,
      unproven,
      errors: runErrors,
      consoleMessages,
      networkFailures,
      screenshot,
    };
  } catch (error) {
    return {
      ok: false,
      truthState: "FAILED",
      targetUrl: request.targetUrl,
      proof,
      unproven: ["workflow did not complete"],
      errors: [error instanceof Error ? error.message : "Browser verification failed"],
      consoleMessages,
      networkFailures,
    };
  } finally {
    await browser.close();
  }
}
