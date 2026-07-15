import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("Streams Visions isolation", () => {
  it("mounts only on the separate Visions route", () => {
    const visionsPage = read("src/app/streams-ai/Visions/page.tsx");
    const streamsPage = read("src/app/streams-ai/page.tsx");
    expect(visionsPage).toContain("VisionsClient");
    expect(streamsPage).not.toContain("streams-visions");
    expect(streamsPage).not.toContain("VisionsClient");
  });

  it("uses separate API, browser storage, events and prompt namespaces", () => {
    const client = read("src/app/streams-ai/Visions/VisionsClient.tsx");
    const prompt = read("src/lib/streams-visions/prompts.ts");
    expect(client).toContain("/api/streams-ai/Visions/messages");
    expect(client).toContain("streams-visions.conversation.v1");
    expect(client).toContain("visions:preview-revealing");
    expect(client).not.toContain("/api/streams-ai/messages");
    expect(client).not.toContain("streams-ai.assets.cache.v1");
    expect(prompt).toContain("separate visual-conversation experience");
  });

  it("does not import current chat behavioral modules", () => {
    const client = read("src/app/streams-ai/Visions/VisionsClient.tsx");
    expect(client).not.toContain("components/streams-ai/current-chat");
    expect(client).not.toContain("useStreamsChatRuntime");
    expect(client).not.toContain("lib/streams-ai/runtime");
  });

  it("uses independent persistence tables and scoped CSS", () => {
    const migration = read("supabase/migrations/20260714_streams_visions_isolated.sql");
    const css = read("src/app/streams-ai/Visions/visions.module.css");
    expect(migration).toContain("streams_visions_conversations");
    expect(migration).toContain("streams_visions_messages");
    expect(migration).not.toContain("alter table public.streams_ai_");
    expect(css).toContain("[data-streams-visions-root]");
  });
});
