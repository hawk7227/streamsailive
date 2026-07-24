import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import {
  finalizeBrowserEvidence,
  type BrowserAssertionResult,
  type BrowserConsoleEvent,
  type BrowserEvidenceBundle,
  type BrowserNetworkFailure,
} from "./browser-observation-runtime";

export interface BrowserVerificationAssertion {
  id: string;
  description: string;
  run(page: Page): Promise<{ passed: boolean; expected?: string; actual?: string }>;
}

export interface PlaywrightBrowserVerificationInput {
  sessionId: string;
  jobId: string;
  workspaceId: string;
  projectId?: string;
  route: string;
  commitSha: string;
  deploymentId?: string;
  baseUrl: string;
  artifactDirectory: string;
  storageStatePath?: string;
  viewport?: { width: number; height: number };
  assertions: BrowserVerificationAssertion[];
  browser?: Browser;
}

function safeName(value: string) {
  return value.replace(/[^A-Za-z0-9_.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "browser-session";
}

function absoluteUrl(baseUrl: string, route: string) {
  return new URL(route, baseUrl).toString();
}

export async function runPlaywrightBrowserVerification(input: PlaywrightBrowserVerificationInput): Promise<BrowserEvidenceBundle> {
  const startedAt = new Date().toISOString();
  const sessionDirectory = join(input.artifactDirectory, safeName(input.sessionId));
  await mkdir(sessionDirectory, { recursive: true });

  const ownsBrowser = !input.browser;
  const browser = input.browser ?? await chromium.launch({ headless: true });
  let context: BrowserContext | undefined;

  const consoleEvents: BrowserConsoleEvent[] = [];
  const runtimeExceptions: string[] = [];
  const networkFailures: BrowserNetworkFailure[] = [];
  const assertionResults: BrowserAssertionResult[] = [];

  const tracePath = join(sessionDirectory, "trace.zip");
  const screenshotPath = join(sessionDirectory, "final.png");
  const domSnapshotPath = join(sessionDirectory, "dom.html");

  try {
    context = await browser.newContext({
      viewport: input.viewport ?? { width: 1440, height: 900 },
      storageState: input.storageStatePath,
      serviceWorkers: "block",
    });
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    const page = await context.newPage();

    page.on("console", (message) => {
      const type = message.type();
      consoleEvents.push({
        level: type === "error" ? "error" : type === "warning" ? "warning" : type === "debug" ? "debug" : "info",
        text: message.text(),
        url: message.location().url || undefined,
        line: message.location().lineNumber,
        column: message.location().columnNumber,
      });
    });
    page.on("pageerror", (error) => runtimeExceptions.push(error.stack || error.message));
    page.on("requestfailed", (request) => {
      networkFailures.push({
        url: request.url(),
        method: request.method(),
        errorText: request.failure()?.errorText,
        resourceType: request.resourceType(),
      });
    });
    page.on("response", (response) => {
      if (response.status() >= 400) {
        networkFailures.push({
          url: response.url(),
          method: response.request().method(),
          status: response.status(),
          resourceType: response.request().resourceType(),
        });
      }
    });

    await page.goto(absoluteUrl(input.baseUrl, input.route), { waitUntil: "networkidle" });

    for (const assertion of input.assertions) {
      try {
        const result = await assertion.run(page);
        assertionResults.push({
          id: assertion.id,
          description: assertion.description,
          passed: result.passed,
          expected: result.expected,
          actual: result.actual,
          evidenceUris: [screenshotPath, tracePath],
        });
      } catch (error) {
        assertionResults.push({
          id: assertion.id,
          description: assertion.description,
          passed: false,
          actual: error instanceof Error ? error.message : String(error),
          evidenceUris: [screenshotPath, tracePath],
        });
      }
    }

    await page.screenshot({ path: screenshotPath, fullPage: true });
    const html = await page.content();
    const { writeFile } = await import("node:fs/promises");
    await writeFile(domSnapshotPath, html, "utf-8");
    await context.tracing.stop({ path: tracePath });

    return finalizeBrowserEvidence({
      sessionId: input.sessionId,
      jobId: input.jobId,
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      route: input.route,
      commitSha: input.commitSha,
      deploymentId: input.deploymentId,
      browserVersion: browser.version(),
      viewport: input.viewport ?? { width: 1440, height: 900 },
      assertions: assertionResults,
      artifacts: [
        { kind: "trace", uri: tracePath, contentType: "application/zip" },
        { kind: "screenshot", uri: screenshotPath, contentType: "image/png" },
        { kind: "dom_snapshot", uri: domSnapshotPath, contentType: "text/html" },
      ],
      consoleEvents,
      runtimeExceptions,
      networkFailures,
      accessibilityFindings: [],
      startedAt,
      truthState: "UNPROVEN",
    });
  } finally {
    if (context) await context.close().catch(() => undefined);
    if (ownsBrowser) await browser.close().catch(() => undefined);
  }
}

export const browserAssertions = {
  titleContains(expected: string): BrowserVerificationAssertion {
    return {
      id: `title-contains-${safeName(expected)}`,
      description: `Page title contains ${expected}`,
      run: async (page) => {
        const actual = await page.title();
        return { passed: actual.includes(expected), expected, actual };
      },
    };
  },
  routeIs(expectedRoute: string): BrowserVerificationAssertion {
    return {
      id: `route-is-${safeName(expectedRoute)}`,
      description: `Browser route is ${expectedRoute}`,
      run: async (page) => {
        const actual = new URL(page.url()).pathname;
        return { passed: actual === expectedRoute, expected: expectedRoute, actual };
      },
    };
  },
  locatorVisible(selector: string): BrowserVerificationAssertion {
    return {
      id: `visible-${safeName(selector)}`,
      description: `${selector} is visible`,
      run: async (page) => {
        const visible = await page.locator(selector).first().isVisible().catch(() => false);
        return { passed: visible, expected: "visible", actual: visible ? "visible" : "not visible" };
      },
    };
  },
};
