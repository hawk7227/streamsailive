import { uploadImageToSupabase } from '@/lib/supabase/storage';
import { runValidators } from '@/lib/enforcement/validatorRunner';
import { validateImagePromptPolicy } from '@/lib/enforcement/validators/image';
import { ASPECT_RATIO_TO_SIZE, REQUIRED_REALISM_ANCHORS, resolveForbiddenImageTerms } from './realismPolicy';
import { generateImageCandidatesFromProvider } from './generationClient';

export type ImageMode = 'responses' | 'images';
export type ReferencePriority = 'low' | 'medium' | 'high';
export type EnforcedImageRealismMode = 'strict' | 'balanced' | 'strict_everyday' | 'premium_commercial';

export interface ImageReference {
  kind: 'image';
  fileId: string;
  url?: string;
}

export interface GenerateEnforcedImageInput {
  prompt: string;
  apiKey: string;
  workspaceId: string;
  mode?: ImageMode;
  references?: ImageReference[];
  realismMode?: EnforcedImageRealismMode;
  aspectRatio?: keyof typeof ASPECT_RATIO_TO_SIZE;
  referencePriority?: ReferencePriority;
}

export interface PreparedEnforcedImagePrompt {
  finalPrompt: string;
  rewrittenPrompt: string;
  strippedTerms: string[];
  ledger: unknown;
}

export interface GenerateEnforcedImageResult extends PreparedEnforcedImagePrompt {
  outputUrl: string;
}

function normalizeRealismMode(mode?: EnforcedImageRealismMode): 'strict_everyday' | 'premium_commercial' {
  if (mode === 'premium_commercial') return 'premium_commercial';
  return 'strict_everyday';
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function classifyReference(url: string): 'usable' | 'risky' | 'reject' {
  const lower = url.toLowerCase();
  if (/text=|overlay=|caption=|ui=|label=/i.test(lower)) return 'reject';
  if (/cinematic|studio|glossy|polished|luxury|premium/i.test(lower)) return 'risky';
  return 'usable';
}

function sanitizeImagePrompt(raw: string, realismMode: 'strict_everyday' | 'premium_commercial'): { sanitized: string; stripped: string[] } {
  const stripped: string[] = [];
  let result = raw;
  for (const term of resolveForbiddenImageTerms(realismMode)) {
    const escaped = escapeRegExp(term).replace(/\s+/g, '\\s+');
    const regex = new RegExp(`(?:^|\\b|\\s)${escaped}(?:\\b|\\s|$)`, 'gi');
    if (regex.test(result)) {
      stripped.push(term);
      result = result.replace(regex, ' ').trim();
    }
  }
  return { sanitized: result.replace(/\s{2,}/g, ' ').trim(), stripped };
}

function isHumanSubjectPrompt(prompt: string): boolean {
  return /\b(woman|man|person|people|girl|boy|mother|father|doctor|patient|nurse|customer|user|portrait|face|selfie|human)\b/i.test(prompt);
}

function buildRewriteInstruction(realismMode: 'strict_everyday' | 'premium_commercial'): string {
  if (realismMode === 'premium_commercial') {
    return [
      'Rewrite this image prompt for premium commercial photorealism.',
      'Keep the core subject, action, setting, and product/composition intent.',
      'Preserve premium, editorial, controlled-lighting, shallow-depth, and product-forward language when it supports believable real photography.',
      'If the subject is a person, keep them fully human and photoreal, with believable skin texture, hands, hair detail, and proportions.',
      'Allow refined composition, clean premium framing, strong product readability, and polished but believable commercial clarity.',
      'Avoid CGI, render-like smoothness, artificial symmetry, fake beauty retouching, plastic skin, surreal gloss, or impossible luxury perfection.',
      'Return only the rewritten prompt.',
    ].join('\n- ');
  }

  return [
    'Rewrite this image prompt for strict everyday photorealism.',
    'Keep the core subject, action, and setting.',
    'Favor authentic human realism, natural asymmetry, realistic skin texture, believable hands, realistic hair detail, ordinary natural lighting, and candid composition.',
    'Allow minor imperfections and slight compositional looseness.',
    'Avoid glamour, beauty-campaign polish, CGI smoothness, over-retouching, hyper-symmetry, or artificial studio perfection.',
    'Prefer believable real-world photography over polished commercial presentation.',
    'Return only the rewritten prompt.',
  ].join('\n- ');
}

async function helperRewrite(prompt: string, apiKey: string, realismMode: 'strict_everyday' | 'premium_commercial'): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o',
      temperature: 0.2,
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `${buildRewriteInstruction(realismMode)}\n\nMode: ${realismMode}\nOriginal: ${prompt}`,
      }],
    }),
  });

  if (!response.ok) return prompt;
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return payload.choices?.[0]?.message?.content?.trim() || prompt;
}

function compileFinalPrompt(
  prompt: string,
  references: ImageReference[],
  referencePriority: ReferencePriority,
  realismMode: 'strict_everyday' | 'premium_commercial',
): string {
  const anchors = REQUIRED_REALISM_ANCHORS.join(', ');
  const refGuidance = references.length > 0 && referencePriority !== 'low'
    ? `Reference guidance (${referencePriority} priority): ${references.length} reference image(s) provided for loose appearance/composition alignment only.`
    : '';

  const modeLocks = realismMode === 'premium_commercial'
    ? [
        'Human realism lock: if a person is shown, they must remain fully photoreal and believable, with natural skin texture, realistic hands, realistic hair detail, and human proportions.',
        'Photo realism lock: this must read as a premium commercial photograph with controlled but believable lighting, refined composition, sharp product readability, and polished yet natural real-world detail.',
        'Failure conditions: CGI/render/illustration feel, plastic skin, impossible symmetry, fake beauty retouching, surreal gloss, artificial smoothness, or luxury-fashion unreality.',
        'Composition lock: allow clean premium framing, deliberate product-forward composition, realistic lens behavior, and believable environment detail.',
      ]
    : [
        'Human realism lock: if a person is shown, they must look like a real everyday human being, not a model, not a polished portrait, not a beauty campaign, and not an AI-generated face.',
        'Photo realism lock: this must read as a candid real-world photograph with natural imperfections, uneven lighting, realistic skin texture, realistic hands, and slight facial asymmetry.',
        'Failure conditions: centered glamour portrait, studio beauty lighting, perfect skin, polished ad look, over-symmetry, fake smoothness, CGI/render/illustration feel.',
        'Composition lock: prefer ordinary framing, slightly off-center composition, natural camera feel, believable environment detail.',
      ];

  return [
    prompt,
    `Strict realism anchors: ${anchors}.`,
    refGuidance,
    ...modeLocks,
    'Do not include text, UI elements, overlays, labels, or watermarks in the image.',
  ].filter(Boolean).join(' ');
}

export async function prepareEnforcedImagePrompt(input: GenerateEnforcedImageInput): Promise<PreparedEnforcedImagePrompt> {
  const references = input.references ?? [];
  const MAX_REFERENCES = 3;
  if (references.length > MAX_REFERENCES) {
    throw new Error(`Maximum ${MAX_REFERENCES} image references allowed.`);
  }

  const rejectedReferences = references.filter((reference) => classifyReference(reference.url ?? reference.fileId) === 'reject');
  if (rejectedReferences.length > 0) {
    throw new Error('One or more references were rejected because they appear to contain baked-in text/UI or incompatible style instructions.');
  }

  const usableReferences = references.filter((reference) => classifyReference(reference.url ?? reference.fileId) !== 'reject');
  const normalizedMode = normalizeRealismMode(input.realismMode);
  const { sanitized, stripped } = sanitizeImagePrompt(input.prompt.trim(), normalizedMode);
  const rewritten = await helperRewrite(sanitized, input.apiKey, normalizedMode);
  const humanLock = normalizedMode === 'premium_commercial'
    ? ' Real-person lock: show a believable real person with natural skin texture, realistic hands, realistic facial detail, and premium commercial polish that still reads as genuine photography.'
    : ' Real-person lock: show a believable everyday person with natural facial asymmetry, visible skin texture, non-model appearance, and candid real-life camera realism.';
  const finalPrompt = compileFinalPrompt(
    rewritten + (isHumanSubjectPrompt(rewritten) ? humanLock : ''),
    usableReferences,
    input.referencePriority ?? 'medium',
    normalizedMode,
  );

  const ledger = runValidators('image', [{
    name: 'image-policy',
    result: validateImagePromptPolicy({
      originalPrompt: input.prompt,
      finalPrompt,
      strippedTerms: stripped,
      referencesUsed: usableReferences.length,
    }),
  }], { mode: input.mode ?? 'images', referencesUsed: usableReferences.length });

  const blocking = (ledger as { issues: Array<{ severity: string; message: string }> }).issues.find((issue) => issue.severity === 'error');
  if (blocking) throw new Error(blocking.message);

  return { finalPrompt, rewrittenPrompt: rewritten, strippedTerms: stripped, ledger };
}

export async function generateEnforcedImage(input: GenerateEnforcedImageInput): Promise<GenerateEnforcedImageResult> {
  const prepared = await prepareEnforcedImagePrompt(input);
  const candidates = await generateImageCandidatesFromProvider({ prompt: prepared.finalPrompt, aspectRatio: input.aspectRatio ?? '1:1', attempts: 1 });
  const generated = candidates[0];
  const outputUrl = generated?.url
    ? await uploadImageToSupabase(generated.url, input.workspaceId).catch(() => generated.url)
    : null;

  if (!outputUrl) throw new Error('Image generation returned no usable output URL');

  return { ...prepared, outputUrl };
}
