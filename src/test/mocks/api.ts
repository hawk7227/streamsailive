import { vi } from 'vitest'

// ── Kling mock responses ──────────────────────────────────────────────────
export const mockKlingImageSubmit = {
  code: 0, message: 'success',
  data: { task_id: 'kling-img-task-001' }
}
export const mockKlingImagePending = {
  code: 0, data: { task_id: 'kling-img-task-001', task_status: 'processing' }
}
export const mockKlingImageComplete = {
  code: 0, data: {
    task_id: 'kling-img-task-001', task_status: 'succeed',
    task_result: { images: [{ url: 'https://cdn.klingai.com/test-image.png', index: 0 }] }
  }
}
export const mockKlingImageFailed = {
  code: 0, data: { task_id: 'kling-img-task-fail', task_status: 'failed', task_status_msg: 'Content policy' }
}
export const mockKlingVideoSubmit = {
  code: 0, message: 'success',
  data: { task_id: 'kling-vid-task-001' }
}
export const mockKlingVideoStatus = {
  code: 0, data: { task_id: 'kling-vid-task-001', task_status: 'processing', task_progress: 45 }
}
export const mockKlingVideoComplete = {
  code: 0, data: {
    task_id: 'kling-vid-task-001', task_status: 'succeed',
    task_result: { videos: [{ url: 'https://cdn.klingai.com/test-video.mp4', duration: 5 }] }
  }
}
export const mockKlingI2VSubmit = {
  code: 0, message: 'success',
  data: { task_id: 'kling-i2v-task-001' }
}

// ── Runway mock responses ─────────────────────────────────────────────────
export const mockRunwayVideoSubmit = { id: 'runway-task-001', status: 'RUNNING' }
export const mockRunwayVideoComplete = {
  id: 'runway-task-001', status: 'SUCCEEDED',
  output: ['https://runway-cdn.com/test-video.mp4']
}
export const mockRunwayVideoFailed = { id: 'runway-task-001', status: 'FAILED', error: 'Content moderation' }

// ── OpenAI mock responses ─────────────────────────────────────────────────
export const mockOpenAIScript = {
  choices: [{ message: { content: 'Private care from home. A licensed provider reviews your intake. Next steps after review.', role: 'assistant' } }]
}
export const mockOpenAIStrategyOutput = {
  choices: [{ message: { content: JSON.stringify({
    stepName: 'strategy', rulesetVersion: 'telehealth-production-v1',
    strategySummary: 'Privacy and convenience focus',
    targetAudience: 'Adults 25-54 seeking private healthcare',
    funnelStage: 'awareness',
    primaryPainPoint: 'Time and privacy barriers',
    desiredOutcome: 'Book first visit',
    corePromise: 'Private, convenient care with licensed provider review',
    objectionHandled: 'Is this real care?',
    proofTypeAllowed: 'process-based only',
    ctaDirection: 'Start your visit',
    disclaimerNeed: 'conditional',
    visualDirection: 'Clean, premium, medical-adjacent.',
    riskFlags: []
  }) } }]
}
export const mockOpenAICopyOutput = {
  choices: [{ message: { content: JSON.stringify({
    stepName: 'copy', rulesetVersion: 'telehealth-production-v1',
    variants: [
      { variantId: 'v1', headline: 'Private Care, From Home', subheadline: 'A licensed provider reviews your intake', bullets: ['Secure online intake', 'Provider review', 'Clear next steps'], cta: 'Start Your Visit', microcopy: 'No commitment required', disclaimer: 'Treatment decisions made when clinically appropriate', riskNotes: [] },
      { variantId: 'v2', headline: 'Care Without the Wait', subheadline: 'Secure intake, licensed review', bullets: ['Private experience', 'Licensed provider review', 'Next steps shared'], cta: 'Begin Intake', microcopy: 'After provider review', disclaimer: 'Eligibility may vary', riskNotes: [] },
      { variantId: 'v3', headline: 'Online Care, Simplified', subheadline: 'Discreet, fast, provider-reviewed', bullets: ['Secure process', 'Licensed review', 'Treatment when appropriate'], cta: 'Get Started', microcopy: 'Private and secure', disclaimer: 'Prescription based on clinical eligibility', riskNotes: [] }
    ]
  }) } }]
}
export const mockOpenAIValidatorPass = {
  choices: [{ message: { content: JSON.stringify({
    stepName: 'validator', rulesetVersion: 'telehealth-production-v1',
    status: 'pass', severity: null, issues: [], fixInstructions: '',
    approvedOutput: { headline: 'Private Care, From Home', cta: 'Start Your Visit' }
  }) } }]
}
export const mockOpenAIValidatorBlock = {
  choices: [{ message: { content: JSON.stringify({
    stepName: 'validator', rulesetVersion: 'telehealth-production-v1',
    status: 'block', severity: 'block',
    issues: [{ field: 'headline', code: 'DIAGNOSIS_CLAIM', message: 'Headline implies diagnostic certainty', triggeredRule: 'noDiagnosticClaims' }],
    fixInstructions: 'Remove diagnostic implication.',
    approvedOutput: null
  }) } }]
}
export const mockOpenAIValidatorSoftFail = {
  choices: [{ message: { content: JSON.stringify({
    stepName: 'validator', rulesetVersion: 'telehealth-production-v1',
    status: 'fail', severity: 'softFail',
    issues: [{ field: 'headline', code: 'LENGTH_OVERFLOW', message: 'Headline exceeds 8 words', triggeredRule: 'headlineMaxWords' }],
    fixInstructions: 'Shorten headline to 8 words or fewer.',
    approvedOutput: null
  }) } }]
}
export const mockOpenAIPromptPreview = {
  choices: [{ message: { content: JSON.stringify({
    originalIntent: 'generate a video of a doctor welcoming a patient',
    rewrittenPrompt: 'Licensed provider in clean minimal clinic. Warm gesture toward camera. Soft natural light. Camera: slow dolly-in. Mood: calm, reassuring, premium.',
    negativePrompt: 'text overlays, harsh lighting, cluttered background, distorted hands',
    providerSelected: 'kling_t2v',
    reasoning: 'Kling T2V: superior face physics, subtle motion, HIPAA-safe.',
    warnings: [],
    estimatedCost: 0.20,
    mode: 'standard'
  }) } }]
}
export const mockOpenAIIntakeAnalysis = {
  choices: [{ message: { content: JSON.stringify({
    analysisResult: 'Healthcare telehealth platform. Clean professional aesthetic. Premium dark theme. Key messaging: privacy, convenience, licensed providers.',
    suggestedStrategy: 'Lead with privacy and ease of access. Focus on trusted provider review.',
    suggestedImagePrompt: 'Licensed provider in minimal clean clinic. Soft lighting. Premium aesthetic.',
    suggestedVideoDirection: 'Slow dolly-in on provider. Calm atmosphere.',
    detectedStyle: 'premium-healthcare',
    sourceType: 'url'
  }) } }]
}
export const mockOpenAIQAApproved = {
  choices: [{ message: { content: JSON.stringify({
    stepName: 'qa', rulesetVersion: 'telehealth-production-v1',
    status: 'approved',
    issues: [],
    checklistResults: {
      approvedFactsUsed: true, noBannedPhrases: true, noMedicalClaims: true,
      qualifiersPresent: true, toneMatches: true, fieldLimits: true,
      ctaLowFriction: true, imageAnatomicallyCorrect: 'human-review-required',
      exportSpecsMatch: true
    },
    finalNotes: 'Asset approved for distribution. Image anatomical review flagged for human QA.'
  }) } }]
}
export const mockOpenAIAssistantAction = {
  choices: [{ message: { content: JSON.stringify({
    message: 'Generating an image for Concept 1 using the telehealth governance rules.',
    actions: [{ type: 'generate_image', prompt: 'Licensed provider in clean minimal clinic', conceptId: 'c1' }]
  }) } }]
}

// ── Supabase mock rows ────────────────────────────────────────────────────
export const mockWorkspace = { id: 'workspace-1', name: 'Test Workspace', plan: 'pro' }
export const mockUser = { id: 'user-001', email: 'test@test.com' }

export const mockGenerationPending = {
  id: 'gen-001', type: 'image', prompt: 'Premium telehealth brand image',
  title: null, status: 'pending', aspect_ratio: '16:9', duration: null,
  quality: null, style: null, favorited: false, output_url: null,
  external_id: 'kling-img-task-001', progress: null, is_preview: false,
  provider: 'kling', concept_id: 'c1', mode: 'standard', cost_estimate: 0.04,
  created_at: new Date().toISOString()
}
export const mockGenerationComplete = {
  ...mockGenerationPending, status: 'completed',
  output_url: 'https://dggunmqrbimlsuaohkpx.supabase.co/storage/v1/object/public/generations/workspace-1/gen-001.png'
}
export const mockGenerationFailed = { ...mockGenerationPending, status: 'failed', output_url: null }

export const mockVideoPending = {
  id: 'gen-002', type: 'video', prompt: 'Calm doctor welcoming gesture',
  status: 'pending', external_id: 'kling-vid-task-001', provider: 'kling',
  concept_id: 'c1', mode: 'standard', cost_estimate: 0.20, output_url: null,
  created_at: new Date().toISOString()
}
export const mockVideoComplete = {
  ...mockVideoPending, status: 'completed',
  output_url: 'https://dggunmqrbimlsuaohkpx.supabase.co/storage/v1/object/public/generations/workspace-1/gen-002.mp4'
}

export const mockFileUploadResponse = {
  data: {
    id: 'file-001', workspace_id: 'workspace-1', name: 'test-image.jpg',
    type: 'asset', file_path: 'workspace-1/uuid-test-image.jpg',
    public_url: 'https://dggunmqrbimlsuaohkpx.supabase.co/storage/v1/object/public/copilot-assets/workspace-1/test.jpg',
    mime_type: 'image/jpeg', size: 204800
  }
}

export const mockNiche = {
  id: 'niche-001', workspace_id: 'workspace-1', name: 'Telehealth Master',
  pipeline_type: 'telehealth', brand_tone: 'Premium, calm, clinical, warm, trustworthy',
  approved_facts: ['Secure online intake is available.', 'A licensed provider may review submitted information.'],
  banned_phrases: ['guaranteed cure', 'instant prescription'],
  ruleset_version: 'telehealth-production-v1', created_at: new Date().toISOString()
}

export const mockPipelineSession = {
  id: 'session-001', workspace_id: 'workspace-1', niche_id: 'telehealth',
  selected_concept_id: 'c1',
  prompts: { strategy: 'Build 3 safe concepts', copy: 'Write compliant copy', image: 'Premium healthcare scene', video: 'Subtle motion only', qa: 'Check all compliance' },
  step_states: { strategy: 'complete', copy: 'running', validator: 'queued', imagery: 'queued', i2v: 'queued', assets: 'queued', qa: 'queued' },
  outputs: { script: null, image: null, video: null },
  pipeline_status: 'running', current_step_id: 'copy',
  created_at: new Date().toISOString(), updated_at: new Date().toISOString()
}
