export type BrowserVerificationTruthState = "PROVEN" | "FAILED" | "UNPROVEN";

export type BrowserVerificationAction =
  | { type: "goto"; url: string }
  | { type: "click"; selector: string }
  | { type: "fill"; selector: string; value: string }
  | { type: "wait_for_selector"; selector: string }
  | { type: "expect_text"; selector: string; text: string };

export type BrowserVerificationViewportName = "desktop" | "mobile";
export type BrowserVerificationViewport = { name: BrowserVerificationViewportName; width: number; height: number };

export interface BrowserVerificationRequest {
  projectId: string;
  sessionId: string;
  targetUrl: string;
  route?: string;
  actions: BrowserVerificationAction[];
  viewports?: BrowserVerificationViewport[];
}

export interface BrowserScreenshotArtifact {
  id: string;
  kind: "browser_screenshot";
  viewportName: BrowserVerificationViewportName;
  viewport: { width: number; height: number };
  mimeType: "image/png";
  dataUrl: string;
  capturedAt: string;
}

export interface BrowserViewportResult {
  name: BrowserVerificationViewportName;
  viewport: { width: number; height: number };
  finalUrl?: string;
  title?: string;
  proof: string[];
  errors: string[];
  consoleMessages: string[];
  networkFailures: string[];
  screenshot?: BrowserScreenshotArtifact;
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
  screenshots: BrowserScreenshotArtifact[];
  viewports: BrowserViewportResult[];
}

const DEFAULT_VIEWPORTS: BrowserVerificationViewport[] = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 430, height: 932 },
];

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

function createScreenshotArtifact(buffer: Buffer, viewport: BrowserVerificationViewport): BrowserScreenshotArtifact {
  return {
    id: `browser-shot-${viewport.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind: "browser_screenshot",
    viewportName: viewport.name,
    viewport: { width: viewport.width, height: viewport.height },
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
    if ("selector" in action && !isSafeSelector(action.selector)) errors.push(`Unsafe selector for ${action.type}.`);
    if (action.type === "goto" && !isSafeUrl(action.url)) errors.push("goto action URL must be safe.");
    if (action.type === "fill" && action.value.length > 1000) errors.push("fill value is too long.");
  }

  for (const viewport of request.viewports || DEFAULT_VIEWPORTS) {
    if (!["desktop", "mobile"].includes(viewport.name)) errors.push("viewport name must be desktop or mobile.");
    if (!Number.isInteger(viewport.width) || !Number.isInteger(viewport.height) || viewport.width < 320 || viewport.width > 2560 || viewport.height < 480 || viewport.height > 2000) {
      errors.push(`Invalid ${viewport.name} viewport dimensions.`);
    }
  }
  return errors;
}

async function runActions(page: import("@playwright/test").Page, actions: BrowserVerificationAction[], proof: string[]) {
  for (const action of actions) {
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
}

export async function runBrowserVerification(request: BrowserVerificationRequest): Promise<BrowserVerificationResult> {
  const validationErrors = validateBrowserVerificationRequest(request);
  if (validationErrors.length > 0) {
    return { ok: false, truthState: "FAILED", targetUrl: request.targetUrl, proof: ["browser verification validation executed"], unproven: ["browser did not run"], errors: validationErrors, consoleMessages: [], networkFailures: [], screenshots: [], viewports: [] };
  }

  let chromium: typeof import("@playwright/test")["chromium"] | null = null;
  try {
    chromium = (await import("@playwright/test")).chromium;
  } catch (error) {
    return { ok: false, truthState: "UNPROVEN", targetUrl: request.targetUrl, proof: ["browser verification request validated"], unproven: ["Playwright runtime unavailable"], errors: [error instanceof Error ? error.message : "Playwright runtime unavailable"], consoleMessages: [], networkFailures: [], screenshots: [], viewports: [] };
  }

  const browser = await chromium.launch({ headless: true });
  const viewportResults: BrowserViewportResult[] = [];
  try {
    for (const viewport of request.viewports || DEFAULT_VIEWPORTS) {
      const proof = [`${viewport.name} browser verification request validated`];
      const consoleMessages: string[] = [];
      const networkFailures: string[] = [];
      const errors: string[] = [];
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, isMobile: viewport.name === "mobile", hasTouch: viewport.name === "mobile" });
      page.on("console", (message) => { if (["error", "warning"].includes(message.type())) consoleMessages.push(`${message.type()}: ${message.text()}`.slice(0, 500)); });
      page.on("requestfailed", (failure) => networkFailures.push(`${failure.method()} ${failure.url()} ${failure.failure()?.errorText || "failed"}`.slice(0, 700)));
      try {
        await page.goto(request.targetUrl, { waitUntil: "networkidle", timeout: 45_000 });
        proof.push(`opened ${request.targetUrl}`);
        await runActions(page, request.actions, proof);
        const screenshot = createScreenshotArtifact(await page.screenshot({ fullPage: true, type: "png" }), viewport);
        proof.push(`captured ${viewport.name} screenshot artifact ${screenshot.id}`);
        viewportResults.push({ name: viewport.name, viewport: screenshot.viewport, finalUrl: page.url(), title: await page.title(), proof, errors, consoleMessages, networkFailures, screenshot });
      } catch (error) {
        errors.push(error instanceof Error ? error.message : `${viewport.name} browser verification failed`);
        viewportResults.push({ name: viewport.name, viewport: { width: viewport.width, height: viewport.height }, finalUrl: page.url(), proof, errors, consoleMessages, networkFailures });
      } finally {
        await page.close();
      }
    }

    const proof = viewportResults.flatMap((result) => result.proof);
    const errors = viewportResults.flatMap((result) => result.errors);
    const consoleMessages = viewportResults.flatMap((result) => result.consoleMessages.map((message) => `${result.name}: ${message}`));
    const networkFailures = viewportResults.flatMap((result) => result.networkFailures.map((message) => `${result.name}: ${message}`));
    const screenshots = viewportResults.flatMap((result) => result.screenshot ? [result.screenshot] : []);
    const unproven: string[] = [];
    if (viewportResults.length < 2 || !viewportResults.some((item) => item.name === "desktop") || !viewportResults.some((item) => item.name === "mobile")) unproven.push("desktop and mobile verification were not both completed");
    if (consoleMessages.length > 0) unproven.push("console warnings/errors require review");
    if (networkFailures.length > 0) unproven.push("network failures require review");
    const truthState: BrowserVerificationTruthState = errors.length > 0 ? "FAILED" : unproven.length > 0 ? "UNPROVEN" : "PROVEN";
    const primary = viewportResults.find((item) => item.name === "desktop") || viewportResults[0];
    return { ok: truthState !== "FAILED", truthState, targetUrl: request.targetUrl, finalUrl: primary?.finalUrl, title: primary?.title, proof, unproven, errors, consoleMessages, networkFailures, screenshot: screenshots[0], screenshots, viewports: viewportResults };
  } finally {
    await browser.close();
  }
}
