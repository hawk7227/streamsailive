import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("Streams Builder live DevTools and patch playback", () => {
  it("keeps browser telemetry inside the existing workstation tab model", () => {
    const workstation = read("src/components/streams-builder/LiveFrontendWorkstation.tsx");
    const devtools = read("src/components/streams-builder/BrowserDevTools.tsx");

    expect(workstation).toContain('"devtools"');
    expect(workstation).toContain("<BrowserDevTools");
    expect(devtools).toContain('source: "streams-browser-devtools"');
    expect(devtools).toContain('type: "console"');
    expect(devtools).toContain('type: "network"');
    expect(devtools).toContain('type: "element"');
    expect(devtools).toContain("unhandledrejection");
    expect(devtools).toContain("Cross-origin preview");
  });

  it("animates worker content one changed line at a time and blocks wrong-file patches", () => {
    const workstation = read("src/components/streams-builder/LiveFrontendWorkstation.tsx");

    expect(workstation).toContain("Patch blocked: worker targeted");
    expect(workstation).toContain("for (const line of changed)");
    expect(workstation).toContain("setHighlightRange({ startLine: line, endLine: line })");
    expect(workstation).toContain('action: "locate"');
    expect(workstation).toContain("await new Promise");
    expect(workstation).toContain('window.addEventListener("streams-builder:worker-patch"');
    expect(workstation).toContain("await animatePatch(frame)");
  });

  it("synchronizes worker edits into the same source used by the visual editor", () => {
    const canvas = read("src/components/streams-builder/BuilderResearchCanvas.tsx");

    expect(canvas).toContain("onContentChange={updateContent}");
    expect(canvas).toContain('window.dispatchEvent(new CustomEvent("streams-builder:shared-source-change"');
    expect(canvas).toContain("content={activeFile.content}");
  });
});
