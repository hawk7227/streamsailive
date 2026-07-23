import { describe, expect, it } from "vitest";
import { STREAMS_VISIONS_EXPERIENCE_CONTRACT } from "../src/lib/streams-visions/experience-contract";
import { VISIONS_CAPTURE_TYPES, VISIONS_IDENTITY_NOTICE, canEnterVisions } from "../src/lib/streams-visions/identity";
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

  it("requires a private identity, likeness and device-lock gate", () => {
    const identity = STREAMS_VISIONS_EXPERIENCE_CONTRACT.identity;
    expect(identity.privateBucket).toBe("streams-visions-likeness");
    expect(identity.profileTable).toBe("streams_visions_identity_profiles");
    expect(identity.assetsTable).toBe("streams_visions_likeness_assets");
    expect(identity.eventsTable).toBe("streams_visions_identity_events");
    expect(identity.requiredCaptures).toBe(4);
    expect(VISIONS_CAPTURE_TYPES).toHaveLength(4);
    expect(identity.publicAssetUrls).toBe(false);
    expect(identity.legalIdentityClaim).toBe(false);
    expect(identity.requiresEmailVerification).toBe(true);
    expect(identity.requiresPhoneVerification).toBe(true);
    expect(identity.requiresAccountDetails).toBe(true);
    expect(identity.requiresIdentityNotice).toBe(true);
    expect(identity.requiresVerifiedLiveness).toBe(true);
    expect(identity.requiresApprovedLikeness).toBe(true);
    expect(identity.requiresDeviceLock).toBe(true);
  });

  it("does not unlock Visions until every required gate is satisfied", () => {
    const approved = {
      emailVerified: true,
      phoneVerified: true,
      accountDetailsComplete: true,
      noticeAccepted: true,
      livenessStatus: "verified" as const,
      likenessProfileStatus: "approved" as const,
      biometricLockEnabled: true,
    };
    expect(canEnterVisions(approved)).toBe(true);
    expect(canEnterVisions({ ...approved, phoneVerified: false })).toBe(false);
    expect(canEnterVisions({ ...approved, accountDetailsComplete: false })).toBe(false);
    expect(canEnterVisions({ ...approved, livenessStatus: "manual_review" })).toBe(false);
    expect(canEnterVisions({ ...approved, likenessProfileStatus: "pending_review" })).toBe(false);
    expect(canEnterVisions({ ...approved, biometricLockEnabled: false })).toBe(false);
  });

  it("uses the approved identity and privacy notice", () => {
    expect(VISIONS_IDENTITY_NOTICE.title).toBe("Identity and Privacy Notice");
    expect(VISIONS_IDENTITY_NOTICE.paragraphs.join(" ")).toContain("privacy-first company");
    expect(VISIONS_IDENTITY_NOTICE.paragraphs.join(" ")).toContain("does not allow blank, fake, misleading, or impersonated profile images");
    expect(VISIONS_IDENTITY_NOTICE.uses).toContain("Used to portray you consistently inside your private Streams Visions experiences");
    expect(VISIONS_IDENTITY_NOTICE.confirmations).toHaveLength(3);
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
