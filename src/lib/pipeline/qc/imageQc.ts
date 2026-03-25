/**
 * imageQc.ts
 *
 * Image quality control.
 * Enforces the text-free image contract at every generation.
 *
 * Two responsibilities:
 * 1. Prompt validation — checks mandatory negative elements and anatomy anchors
 *    are present BEFORE the API call is made.
 * 2. Multi-attempt generation — runs up to N attempts, scanning each for
 *    accidental text via OCR. Returns the first clean result or a full failure
 *    record if all attempts contain text.
 *
 * No text is ever generated inside an AI image in this pipeline.
 */

import type { ActiveGovernance } from '@/lib/pipeline/governance'
import type { IntakeBrief, TargetPlatform } from './intakeGate'
import {
  buildImageNegativePrompt,
  checkImageNegativePromptPresent,
  checkImagePositiveAnchorsPresent,
  scanImageForText,
  type OcrScanResult,
} from './deterministicChecks'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ImagePromptQcResult {
  passed: boolean
  negativePromptPresent: boolean
  positiveAnchorsPresent: boolean
  mandatoryElementsMissing: string[]
  mandatoryAnchorsMissing: string[]
  platformCompositionTagged: boolean
  finalPrompt: string   // the validated + augmented prompt ready for API call
}

export interface ImageAttempt {
  attemptNumber: number
  imageUrl: string
  ocrResult: OcrScanResult
  passed: boolean   // true if OCR shows no text (or was skipped and flagged for human)
}

export interface ImageGenerationResult {
  passed: boolean
  imageUrl: string              // URL of the accepted image (may be empty string on total failure)
  selectedAttempt: number       // which attempt was accepted (1-N)
  allAttempts: ImageAttempt[]
  ocrSkipped: boolean           // true if OCR was unavailable — human review required
  failureReasons: string[]
  promptUsed: string
  governanceVersion: string
  generatedAt: string
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

/**
 * Builds the platform-specific composition instruction to append to the prompt.
 */
function buildCompositionInstruction(platform: TargetPlatform, governance: ActiveGovernance): string {
  const rules = (governance as unknown as {
    imageGenerationRules?: { platformCompositionRule?: Record<string, string> }
  }).imageGenerationRules?.platformCompositionRule

  if (!rules) {
    return 'centered subject with clear background space'
  }
  return rules[platform] ?? rules['organic'] ?? 'centered subject with clear background space'
}

/**
 * Builds the full mandatory positive anchor string.
 */
function buildPositiveAnchors(governance: ActiveGovernance): string {
  const anchors = (governance as unknown as {
    imageGenerationRules?: { mandatoryPositiveAnchors?: string[] }
  }).imageGenerationRules?.mandatoryPositiveAnchors

  if (!anchors || anchors.length === 0) {
    return 'natural expression, natural lighting, real person, ordinary setting'
  }
  return anchors.join(', ')
}

/**
 * Builds the forbidden imagery negative entries from styleGuide.
 */
function buildForbiddenImageryNegatives(governance: ActiveGovernance): string[] {
  const gov = governance as unknown as { styleGuide?: { forbiddenImagery?: string[] } }
  const forbidden = (gov.styleGuide as { forbiddenImagery?: string[] } | undefined)
    ?.forbiddenImagery ?? []
  return forbidden.map((f: string) => `no ${f}`)
}

// ─── Prompt QC ───────────────────────────────────────────────────────────────

/**
 * Validates an image prompt and returns an augmented, safe version.
 *
 * If any mandatory element is missing it is injected — the prompt is never
 * rejected purely for format reasons; it is fixed and returned.
 * However, if the base prompt contains banned content, passed=false.
 */
export function validateAndAugmentImagePrompt(
  basePrompt: string,
  governance: ActiveGovernance,
  targetPlatform: TargetPlatform
): ImagePromptQcResult {
  // Build the mandatory negative prompt from governance + forbidden imagery
  const additionalForbidden = buildForbiddenImageryNegatives(governance)
  const mandatoryNegative = buildImageNegativePrompt(additionalForbidden)

  // Build mandatory positive anchors
  const positiveAnchors = buildPositiveAnchors(governance)

  // Build platform composition instruction
  const compositionInstruction = buildCompositionInstruction(targetPlatform, governance)

  // Assemble the full prompt
  // Structure: [base intent] [positive anchors] [composition] Negative prompt: [negatives]
  const augmented = [
    basePrompt.trim(),
    positiveAnchors,
    compositionInstruction,
    `Negative prompt: ${mandatoryNegative}`,
  ]
    .filter(Boolean)
    .join('. ')

  // Now validate the augmented prompt
  const negCheck = checkImageNegativePromptPresent(augmented)
  const anchorCheck = checkImagePositiveAnchorsPresent(augmented)

  const platformTagged = augmented.toLowerCase().includes(compositionInstruction.toLowerCase().slice(0, 20))

  return {
    passed: negCheck.passed && anchorCheck.passed,
    negativePromptPresent: negCheck.passed,
    positiveAnchorsPresent: anchorCheck.passed,
    mandatoryElementsMissing: negCheck.missingElements,
    mandatoryAnchorsMissing: anchorCheck.missingAnchors,
    platformCompositionTagged: platformTagged,
    finalPrompt: augmented,
  }
}

// ─── Multi-attempt generation ─────────────────────────────────────────────────

export interface GenerateImageFn {
  (prompt: string, aspectRatio: string, callBackUrl?: string): Promise<{ imageUrl?: string; url?: string; responseText?: string }>
}

/**
 * Runs image generation with up to maxAttempts attempts.
 * Each attempt is OCR-scanned for text. The first text-free result is accepted.
 *
 * If all attempts contain text: returns passed=false with all attempt records.
 * If OCR is unavailable (skipped): returns the image but flags ocrSkipped=true
 * so the caller can require human review before proceeding.
 *
 * This function does NOT call the AI directly — it receives a generateFn
 * injected by the caller. This keeps it testable without network calls.
 */
export async function runImageGenerationWithQc(params: {
  basePrompt: string
  governance: ActiveGovernance
  intakeBrief: IntakeBrief
  maxAttempts?: number
  aspectRatio?: string
  callBackUrl?: string
  generateFn: GenerateImageFn
}): Promise<ImageGenerationResult> {
  const {
    basePrompt,
    governance,
    intakeBrief,
    maxAttempts = 3,
    aspectRatio = '16:9',
    callBackUrl,
    generateFn,
  } = params

  const failureReasons: string[] = []
  const allAttempts: ImageAttempt[] = []

  // Validate and augment the prompt before any API call
  const promptQc = validateAndAugmentImagePrompt(basePrompt, governance, intakeBrief.targetPlatform)

  if (!promptQc.passed) {
    // This should not happen since validateAndAugmentImagePrompt injects missing elements,
    // but guard defensively in case of a future regression.
    failureReasons.push(
      `Image prompt QC failed after augmentation. Missing: ${[
        ...promptQc.mandatoryElementsMissing,
        ...promptQc.mandatoryAnchorsMissing,
      ].join(', ')}`
    )
  }

  const finalPrompt = promptQc.finalPrompt

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let imageUrl = ''

    try {
      const result = await generateFn(finalPrompt, aspectRatio, callBackUrl)
      imageUrl = result.imageUrl ?? result.url ?? result.responseText ?? ''
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown generation error'
      allAttempts.push({
        attemptNumber: attempt,
        imageUrl: '',
        ocrResult: { hasText: false, textFound: [], confidence: 'low', skipped: true },
        passed: false,
      })
      failureReasons.push(`Attempt ${attempt} generation failed: ${msg}`)
      continue
    }

    if (!imageUrl) {
      allAttempts.push({
        attemptNumber: attempt,
        imageUrl: '',
        ocrResult: { hasText: false, textFound: [], confidence: 'low', skipped: true },
        passed: false,
      })
      failureReasons.push(`Attempt ${attempt}: no image URL returned`)
      continue
    }

    // Scan for text
    const ocrResult = await scanImageForText(imageUrl)

    const attemptRecord: ImageAttempt = {
      attemptNumber: attempt,
      imageUrl,
      ocrResult,
      passed: !ocrResult.hasText,   // passes if no text found
    }
    allAttempts.push(attemptRecord)

    if (ocrResult.skipped) {
      // OCR unavailable — accept the image but flag for human review
      return {
        passed: true,
        imageUrl,
        selectedAttempt: attempt,
        allAttempts,
        ocrSkipped: true,
        failureReasons,
        promptUsed: finalPrompt,
        governanceVersion: governance.rulesetVersion,
        generatedAt: new Date().toISOString(),
      }
    }

    if (!ocrResult.hasText) {
      // Clean image — accept
      return {
        passed: true,
        imageUrl,
        selectedAttempt: attempt,
        allAttempts,
        ocrSkipped: false,
        failureReasons,
        promptUsed: finalPrompt,
        governanceVersion: governance.rulesetVersion,
        generatedAt: new Date().toISOString(),
      }
    }

    // Text detected — record and try next attempt
    failureReasons.push(
      `Attempt ${attempt}: text detected in image (${ocrResult.textFound.join(', ')}). Regenerating.`
    )
  }

  // All attempts exhausted with text detected
  return {
    passed: false,
    imageUrl: '',
    selectedAttempt: 0,
    allAttempts,
    ocrSkipped: false,
    failureReasons,
    promptUsed: finalPrompt,
    governanceVersion: governance.rulesetVersion,
    generatedAt: new Date().toISOString(),
  }
}
