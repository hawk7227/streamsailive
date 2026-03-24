import { sanitizeRealismPrompt, RealismMode, SubjectType } from "./realism-sanitizer";

export interface GenerateRealisticImageInput {
  rawPrompt: string;
  subjectAction?: string;
  mode?: RealismMode;
  subjectType?: SubjectType;
  n?: number;
}

export interface GenerateRealisticImageOutput {
  promptUsed: string;
  rejectedWords: string[];
  injectedRules: string[];
  images: Array<{ url?: string | null }>;
}

export async function generateRealisticImage(
  input: GenerateRealisticImageInput,
): Promise<GenerateRealisticImageOutput> {
  const apiKey = process.env.OPENAI_API_KEY_IMAGES || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const sanitizer = sanitizeRealismPrompt({
    rawPrompt: input.rawPrompt,
    subjectAction: input.subjectAction,
    mode: input.mode ?? "casual_phone_photo",
    subjectType: input.subjectType ?? "human",
    outputCount: input.n ?? 3,
    severity: "strict",
    preserveUserIntent: true,
    requireHumanRealism: true,
    requireEnvironmentRealism: true,
    requirePhoneCameraLook: true,
    banTextOverlays: true,
    banUiPanels: true,
  });

  // Generate n images and return all — caller picks the least polished
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: sanitizer.apiRecommendation.model,
      prompt: sanitizer.sanitizedPrompt,
      size: sanitizer.apiRecommendation.size,
      quality: sanitizer.apiRecommendation.quality,
      n: sanitizer.apiRecommendation.n,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(`OpenAI realism generation failed (${response.status}): ${err.error?.message ?? response.statusText}`);
  }

  const result = await response.json() as { data?: Array<{ url?: string }> };

  return {
    promptUsed: sanitizer.sanitizedPrompt,
    rejectedWords: sanitizer.rejectedWords,
    injectedRules: sanitizer.injectedRules,
    images: (result.data ?? []).map(item => ({ url: item.url ?? null })),
  };
}
