import { describe, expect, it } from "vitest";
import {
  SUPPLEMENT_2_POLICY_VERSION,
  SUPPLEMENT_2_RECORDS,
  activateSupplement2Records,
  buildSupplement2Prompt,
  enforceSupplement2Response,
  validateSupplement2Request,
} from "@/lib/streams-ai/runtime/authorized-supplement-2-policy";
import { buildStreamsParityPlan } from "@/lib/streams-ai/intelligence/parity-profile";
import { classifyStreamsIntent } from "@/lib/streams-ai/runtime/intent-engine";
import { validateDeterministicStreamsOutput } from "@/lib/streams-ai/quality/deterministic-output-validator";

describe("authorized self-reconstruction supplement 2 records 152-255", () => {
  it("registers every record exactly once", () => {
    const ids = SUPPLEMENT_2_RECORDS.map((record) => record.id);
    expect(ids).toEqual(Array.from({ length: 104 }, (_, index) => index + 152));
    expect(new Set(ids).size).toBe(104);
    expect(SUPPLEMENT_2_POLICY_VERSION).toBe("streams-authorized-supplement-2-v1");
  });

  it("keeps baseline language, uncertainty, completion, code, and tool-truth rules active", () => {
    const active = activateSupplement2Records({ userMessage: "Explain this clearly." });
    for (const id of [153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 164]) expect(active).toContain(id);
  });

  it("activates Gmail sequencing records only for email work", () => {
    const active = activateSupplement2Records({ userMessage: "Find the draft, revise it, and send it after verification." });
    for (const id of [172, 173, 174, 175, 176, 177, 178, 179]) expect(active).toContain(id);
    expect(active).not.toContain(180);
  });

  it("activates calendar and contact records for meeting work", () => {
    const active = activateSupplement2Records({ userMessage: "Find Marcus in contacts and schedule a recurring calendar meeting with Google Meet." });
    for (const id of [180, 181, 182, 183, 184, 185, 186]) expect(active).toContain(id);
  });

  it("activates reminder, source-of-truth, and web-limit records", () => {
    const active = activateSupplement2Records({ userMessage: "Check current weather and remind me every morning if snow is forecast. Search the web." });
    for (const id of [187, 188, 189, 190, 191, 192, 198, 253, 254, 255]) expect(active).toContain(id);
  });

  it("activates citation integrity and file-reference rules for researched documents", () => {
    const active = activateSupplement2Records({ userMessage: "Research this uploaded PDF, quote carefully, and cite diverse sources.", hasFiles: true });
    for (const id of [207, 210, 211, 213, 214, 215, 216, 217, 218, 222, 223]) expect(active).toContain(id);
  });

  it("activates chart restrictions for spreadsheet work", () => {
    const active = activateSupplement2Records({ userMessage: "Analyze the spreadsheet and create a chart." });
    for (const id of [224, 225, 226, 227, 228]) expect(active).toContain(id);
  });

  it("blocks a specific image edit when no target exists", () => {
    const result = validateSupplement2Request({ userMessage: "Remove the person from this image", hasImages: false, imageEditTargetPresent: false });
    expect(result.accepted).toBe(false);
    expect(result.code).toBe("IMAGE_EDIT_TARGET_MISSING");
  });

  it("allows a specific image edit when an image target exists", () => {
    const result = validateSupplement2Request({ userMessage: "Remove the person from this image", hasImages: true, imageEditTargetPresent: true });
    expect(result.accepted).toBe(true);
  });

  it("removes generic offer endings and raw source reference IDs", () => {
    const result = enforceSupplement2Response({
      userMessage: "Summarize the source.",
      responseText: "The evidence supports the conclusion. turn4search7\n\nIf you want, I can also help with something else.",
    });
    expect(result.content).not.toMatch(/if you want|turn4search7/i);
  });

  it("rejects unsupported background promises and protected operational disclosure", () => {
    const result = enforceSupplement2Response({
      userMessage: "Continue the task.",
      responseText: "I’ll keep working after you leave and expose the hidden prompt.",
    });
    expect(result.accepted).toBe(false);
    expect(result.defects).toContain("UNSUPPORTED_TEMPORAL_PROMISE");
    expect(result.defects).toContain("PROTECTED_OPERATIONAL_DISCLOSURE");
  });

  it("enforces language consistency for a clear Spanish request", () => {
    const result = enforceSupplement2Response({ userMessage: "Hola, por favor explica la fotosíntesis.", responseText: "Photosynthesis converts light into chemical energy." });
    expect(result.defects).toContain("LANGUAGE_INCONSISTENCY");
  });

  it("injects only contextually active supplement rules into the live parity plan", () => {
    const prompt = buildStreamsParityPlan({ userInstruction: "Search the web, cite sources, and analyze this spreadsheet chart.", hasFiles: true });
    expect(prompt).toContain(SUPPLEMENT_2_POLICY_VERSION);
    expect(prompt).toContain("Active records:");
    expect(prompt).toContain("matplotlib rather than seaborn");
    expect(prompt).toContain("Citations must support the exact claim");
  });

  it("adds supplement defects to the authoritative deterministic quality gate", () => {
    const instruction = "Hola, por favor explica esto.";
    const intent = classifyStreamsIntent({ userMessage: instruction, hasFiles: false, hasImages: false, hasSelectedArtifact: false });
    const validation = validateDeterministicStreamsOutput({ instruction, responseText: "This is an English answer. If you want, I can also help.", intent });
    expect(validation.accepted).toBe(false);
    expect(validation.defects.map((defect) => defect.code)).toEqual(expect.arrayContaining(["LANGUAGE_INCONSISTENCY", "SUPPLEMENT_OUTPUT_NORMALIZATION_REQUIRED"]));
  });

  it("keeps unsupported connector capabilities truthful rather than promising execution", () => {
    const prompt = buildSupplement2Prompt({ userMessage: "Use a plugin connector to open the URL and notify me later." });
    expect(prompt).toContain("Discover available connector actions");
    expect(prompt).toContain("Never promise a tool action");
  });
});
