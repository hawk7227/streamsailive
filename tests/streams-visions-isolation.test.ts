import { describe, expect, it } from "vitest";
import { STREAMS_VISIONS_EXPERIENCE_CONTRACT } from "../src/lib/streams-visions/experience-contract";
import { STREAMS_VISIONS_SYSTEM_PROMPT } from "../src/lib/streams-visions/prompts";

describe("Streams Visions isolation", () => {
  it("uses a separate route, APIs, storage and event namespace", () => {
    expect(STREAMS_VISIONS_EXPERIENCE_CONTRACT.route).toBe("/streams-ai/Visions");
    expect(STREAMS_VISIONS_EXPERIENCE_CONTRACT.messagesApi).toBe("/api/streams-ai/Visions/messages");
    expect(STREAMS_VISIONS_EXPERIENCE_CONTRACT.conversationsApi).toBe("/api/streams-ai/Visions/conversations");
    expect(STREAMS_VISIONS_EXPERIENCE_CONTRACT.storage.conversation).toBe("streams-visions.conversation.v1");
    expect(STREAMS_VISIONS_EXPERIENCE_CONTRACT.storage.mode).toBe("streams-visions.mode.v1");
    expect(Object.values(STREAMS_VISIONS_EXPERIENCE_CONTRACT.events).every((eventName) => eventName.startsWith("visions:"))).toBe(true);
  });

  it("remains isolated from the current Streams AI runtime", () => {
    expect(STREAMS_VISIONS_EXPERIENCE_CONTRACT.isolation.importsCurrentChatRuntime).toBe(false);
    expect(STREAMS_VISIONS_EXPERIENCE_CONTRACT.isolation.usesMainStreamsMessagesApi).toBe(false);
    expect(STREAMS_VISIONS_EXPERIENCE_CONTRACT.isolation.usesMainStreamsAssetCache).toBe(false);
    expect(STREAMS_VISIONS_SYSTEM_PROMPT).toContain("separate visual-conversation experience");
    expect(STREAMS_VISIONS_SYSTEM_PROMPT).toContain("conversation remains normal");
  });

  it("uses independent persistence contracts", () => {
    expect(STREAMS_VISIONS_EXPERIENCE_CONTRACT.persistence.conversationsTable).toBe("streams_visions_conversations");
    expect(STREAMS_VISIONS_EXPERIENCE_CONTRACT.persistence.messagesTable).toBe("streams_visions_messages");
    expect(STREAMS_VISIONS_EXPERIENCE_CONTRACT.persistence.activePreviewField).toBe("active_preview");
  });

  it("reveals visions without visible generator indicators", () => {
    expect(STREAMS_VISIONS_EXPERIENCE_CONTRACT.reveal.visibleGeneratorIndicators).toBe(false);
    expect(STREAMS_VISIONS_EXPERIENCE_CONTRACT.reveal.ambientClass).toBe("ambientDream");
    expect(STREAMS_VISIONS_EXPERIENCE_CONTRACT.reveal.futureSelfClass).toBe("futureSelf");
    expect(STREAMS_VISIONS_EXPERIENCE_CONTRACT.reveal.minimumMs).toBeGreaterThanOrEqual(4200);
    expect(STREAMS_VISIONS_EXPERIENCE_CONTRACT.reveal.maximumMs).toBeLessThanOrEqual(8000);
    expect(STREAMS_VISIONS_EXPERIENCE_CONTRACT.reveal.defaultMs).toBeGreaterThanOrEqual(STREAMS_VISIONS_EXPERIENCE_CONTRACT.reveal.minimumMs);
    expect(STREAMS_VISIONS_EXPERIENCE_CONTRACT.reveal.defaultMs).toBeLessThanOrEqual(STREAMS_VISIONS_EXPERIENCE_CONTRACT.reveal.maximumMs);
    expect(STREAMS_VISIONS_EXPERIENCE_CONTRACT.reveal.reducedMotionSupported).toBe(true);
    expect(STREAMS_VISIONS_SYSTEM_PROMPT).toContain("Do not announce generation, loading, progress");
  });

  it("keeps provider and technical generation details out of public errors", () => {
    expect(STREAMS_VISIONS_EXPERIENCE_CONTRACT.publicErrors.providerFailure).toBe("Visions could not shape that scene");
    expect(STREAMS_VISIONS_EXPERIENCE_CONTRACT.publicErrors.exposesProviderDetails).toBe(false);
  });
});
