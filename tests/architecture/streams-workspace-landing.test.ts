import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("Streams Workspace public landing", () => {
  it("uses the approved Streams and A.S.K. product language without provider marketing", () => {
    const landing = read("src/components/home/StreamsWorkspaceLanding.tsx");
    expect(landing).toContain("Your intelligent workspace");
    expect(landing).toContain("Streams Workspace, hosted by");
    expect(landing).toContain("A.S.K. Knock");
    expect(landing).toContain("Ask");
    expect(landing).toContain("Seek");
    expect(landing).not.toMatch(/Veo|OpenAI|Claude|Codex|ElevenLabs|Runway|Kling/);
  });

  it("keeps the landing mobile-first and panel-free", () => {
    const styles = read("src/components/home/streams-workspace-landing.module.css");
    expect(styles).toContain("@media(max-width:560px)");
    expect(styles).toContain("grid-template-columns:1fr");
    expect(styles).not.toContain("backdrop-filter");
    expect(styles).not.toContain("border-radius:24px");
  });

  it("makes the new experience authoritative at the root route", () => {
    const page = read("src/app/page.tsx");
    expect(page).toContain("StreamsWorkspaceLanding");
    expect(page).not.toContain("<Hero />");
    expect(page).not.toContain("<Features />");
  });
});
