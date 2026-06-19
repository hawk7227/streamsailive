export type WorkflowMode = "structured-production" | "freestyle-draft";

export type GenerationSetupType = {
  id: string;
  title: string;
  description: string;
  kind: "text-to-video" | "image-to-video" | "image" | "voice" | "motion" | "launch";
  provider: string;
  aspectRatio: "16:9" | "9:16" | "1:1" | "N/A";
  scriptRequired?: boolean;
  referenceRequired?: boolean;
};

export type VisualLibraryCard = {
  id: string;
  generationTypeId: string;
  title: string;
  description: string;
  bestUse: string;
  referenceTypes: string[];
  fieldPreset: Record<string, string>;
};

export type ReferenceSelectionCard = {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  referenceType: string;
  gradient: string;
  preview: string;
};

export type FieldOption = {
  label: string;
  value: string;
  providers?: string[];
  generationTypeIds?: string[];
  hint?: string;
};

export type SelfReferenceCaptureStep = {
  id: string;
  title: string;
  instruction: string;
  referenceType: string;
};

export const SELF_REFERENCE_CAPTURE_STEPS: SelfReferenceCaptureStep[] = [
  {
    id: "face-close-up",
    title: "Face close-up",
    instruction: "Look directly at the camera. Keep your full face visible, evenly lit, sharp, and unobstructed.",
    referenceType: "face-close-up",
  },
  {
    id: "mid-shot-speaker",
    title: "Mid-shot speaker",
    instruction: "Frame from chest or waist up. Keep mouth and hands visible enough for speaker motion and possible lip-sync.",
    referenceType: "mid-shot-speaker",
  },
  {
    id: "gesture-sample",
    title: "Natural gesture sample",
    instruction: "Speak naturally and use one simple open-hand gesture. Avoid fast hand movement and keep framing stable.",
    referenceType: "full-body-action-pose",
  },
];

export const REFERENCE_SELECTION_CARDS: ReferenceSelectionCard[] = [
  { id: "clear-character-anchor", number: 1, title: "Clear Character Anchor", subtitle: "Best for first-frame identity and scene control", referenceType: "clear-character-anchor", gradient: "linear-gradient(135deg,#2f4858,#86bbd8)", preview: "👤" },
  { id: "face-close-up", number: 2, title: "Face Close-Up", subtitle: "Best for identity, expression, and realism", referenceType: "face-close-up", gradient: "linear-gradient(135deg,#4b2e39,#d9a7a7)", preview: "🙂" },
  { id: "mid-shot-speaker", number: 3, title: "Mid-Shot Speaker", subtitle: "Best for talking-head and commercial scenes", referenceType: "mid-shot-speaker", gradient: "linear-gradient(135deg,#1f2937,#64748b)", preview: "🎙️" },
  { id: "full-body-action-pose", number: 4, title: "Full-Body Action Pose", subtitle: "Best for motion readability", referenceType: "full-body-action-pose", gradient: "linear-gradient(135deg,#334155,#94a3b8)", preview: "🚶" },
  { id: "product-object-hero", number: 5, title: "Product / Object Hero", subtitle: "Best for object consistency and detail", referenceType: "product-object-hero", gradient: "linear-gradient(135deg,#111827,#4b5563)", preview: "📷" },
  { id: "establishing-environment", number: 6, title: "Establishing Environment", subtitle: "Best for setting, depth, and scene layout", referenceType: "establishing-environment", gradient: "linear-gradient(135deg,#365314,#a7f3d0)", preview: "🏔️" },
  { id: "lighting-mood-frame", number: 7, title: "Lighting / Mood Frame", subtitle: "Best for style, ambiance, and tone", referenceType: "lighting-mood-frame", gradient: "linear-gradient(135deg,#111827,#f59e0b)", preview: "🌃" },
  { id: "composition-negative-space-frame", number: 8, title: "Composition / Negative Space Frame", subtitle: "Best for layout and camera composition", referenceType: "composition-negative-space-frame", gradient: "linear-gradient(135deg,#e5e7eb,#93c5fd)", preview: "▱" },
  { id: "multi-image-consistency-set", number: 9, title: "Multi-Image Consistency Set", subtitle: "Best for multi-image workflows and consistency", referenceType: "multi-image-consistency-set", gradient: "linear-gradient(135deg,#1e293b,#7c3aed)", preview: "▥" },
  { id: "tail-end-frame", number: 10, title: "Tail / End Frame", subtitle: "Best for end-frame guided animation", referenceType: "tail-end-frame", gradient: "linear-gradient(135deg,#78350f,#fbbf24)", preview: "🌅" },
  { id: "mask-friendly-clean-source", number: 11, title: "Mask-Friendly Clean Source", subtitle: "Best for localized motion or static protected areas", referenceType: "mask-friendly-clean-source", gradient: "linear-gradient(135deg,#f8fafc,#cbd5e1)", preview: "🐕" },
  { id: "context-workstation-use-case-frame", number: 12, title: "Context / Workstation / Use-Case Frame", subtitle: "Best for use-case grounding and story context", referenceType: "context-workstation-use-case-frame", gradient: "linear-gradient(135deg,#0f172a,#38bdf8)", preview: "💻" },
];

export const GENERATION_SETUP_TYPES: GenerationSetupType[] = [
  { id: "talking-head-founder-presenter", title: "Talking Head / Founder / Presenter", description: "Founder, doctor, operator, educator, or presenter speaking to camera.", kind: "image-to-video", provider: "fal", aspectRatio: "16:9", scriptRequired: true, referenceRequired: true },
  { id: "product-commercial", title: "Product Commercial", description: "Product hero, product reveal, demo, or object-focused commercial.", kind: "image-to-video", provider: "fal", aspectRatio: "16:9", referenceRequired: true },
  { id: "app-saas-promo", title: "App / SaaS Promo", description: "Software, dashboard, AI workspace, automation, or product walkthrough promo.", kind: "text-to-video", provider: "fal", aspectRatio: "16:9", scriptRequired: true },
  { id: "cinematic-scene", title: "Cinematic Scene", description: "Scene, mood, action, environment, and camera movement planning.", kind: "text-to-video", provider: "fal", aspectRatio: "16:9" },
  { id: "image-to-video", title: "Image to Video", description: "Animate an accepted anchor image or uploaded reference.", kind: "image-to-video", provider: "fal", aspectRatio: "16:9", referenceRequired: true },
  { id: "reference-still-storyboard", title: "Reference Still / Storyboard", description: "Generate or refine strong still frames before video generation.", kind: "image", provider: "openai", aspectRatio: "16:9" },
  { id: "freestyle-draft", title: "Freestyle Draft Clip", description: "Fast cheap 5-second brainstorming sample with minimal setup.", kind: "text-to-video", provider: "fal", aspectRatio: "16:9" },
];

export const VISUAL_LIBRARY_CARDS: VisualLibraryCard[] = [
  { id: "premium-saas-founder-promo", generationTypeId: "talking-head-founder-presenter", title: "Premium SaaS Founder Promo", description: "Founder speaks directly to camera with subtle product UI behind them.", bestUse: "High-trust business, SaaS, and AI product promos with later voiceover/lip-sync.", referenceTypes: ["mid-shot-speaker", "face-close-up", "context-workstation-use-case-frame"], fieldPreset: { scene: "Premium cinematic SaaS founder promo in a sleek modern tech studio.", subject: "Confident founder/operator speaking naturally to camera.", environment: "Modern studio with subtle dark-mode dashboard screens and clean technology reflections.", emotionalIntent: "Trust, clarity, confidence, intelligence, and momentum.", mood: "Premium, modern, polished, focused, high-tech.", shotType: "Medium close-up", cameraPosition: "Eye-level", cameraMovement: "Slow push in", lens: "50mm portrait lens feel", depthOfField: "Shallow cinematic depth of field", composition: "Centered speaker with clean negative space for UI context", primaryLighting: "Soft studio key light", accentLighting: "Subtle UI glow", rimLight: "Cool blue rim light", atmosphere: "Clean premium tech atmosphere", characterMotion: "Natural speaking gestures and controlled hand movement", environmentMotion: "Subtle animated dashboard glow and soft parallax", motionQuality: "Smooth cinematic human realism", visualStyle: "Photorealistic premium SaaS commercial", productionDesign: "Modern AI workspace / tech studio", humanRealism: "Natural face, accurate hands, stable identity", spokenIntent: "Introduce the product as an all-in-one AI business operator.", preScriptLine: "Meet Streams AI — your all-in-one AI business operator.", performanceBeat: "Founder looks into camera, speaks confidently, and slightly leans forward.", gestureDirection: "Natural open-hand gesture while explaining.", facialExpression: "Confident, warm, trustworthy.", lipSyncNeed: "Yes — visible speaker", voiceoverUseLater: "Yes" } },
  { id: "presenter-with-product-ui", generationTypeId: "talking-head-founder-presenter", title: "Presenter With Product UI", description: "Presenter framed beside a product dashboard or visual workflow.", bestUse: "Explaining features while showing app context behind the speaker.", referenceTypes: ["mid-shot-speaker", "context-workstation-use-case-frame"], fieldPreset: { scene: "Presenter explains a product workflow with UI panels behind them.", shotType: "Chest-up speaker frame", cameraMovement: "Locked-off commercial frame with subtle push-in", composition: "Speaker on one side with clean UI context on the other", spokenIntent: "Explain a feature benefit clearly.", lipSyncNeed: "Yes — visible speaker" } },
  { id: "product-hero-reveal", generationTypeId: "product-commercial", title: "Product Hero Reveal", description: "Premium product/object hero shot with clean camera movement.", bestUse: "Product commercials and object consistency shots.", referenceTypes: ["product-object-hero", "lighting-mood-frame", "tail-end-frame"], fieldPreset: { scene: "Premium product hero reveal on a clean studio surface.", shotType: "Product hero close-up", cameraMovement: "Slow reveal shot", lighting: "Premium product photography lighting", characterMotion: "No person; product remains stable and realistic.", lipSyncNeed: "No — voiceover only" } },
  { id: "ai-workspace-demo", generationTypeId: "app-saas-promo", title: "AI Workspace Demo", description: "Show an AI dashboard/workspace solving a real business task.", bestUse: "SaaS explainer, AI product walkthrough, and business automation videos.", referenceTypes: ["context-workstation-use-case-frame", "composition-negative-space-frame"], fieldPreset: { scene: "AI workspace dashboard comes alive as workstations coordinate together.", subject: "Streams AI interface, mobile chat, builder panels, and generation outputs.", cameraMovement: "Smooth parallax reveal across dashboard surfaces", spokenIntent: "Show how the product helps users build, create, automate, and launch.", lipSyncNeed: "No — voiceover only" } },
  { id: "cinematic-establishing-shot", generationTypeId: "cinematic-scene", title: "Cinematic Establishing Shot", description: "Wide scene frame with clear depth, atmosphere, and camera direction.", bestUse: "Scene openers, trailers, B-roll, and brand mood videos.", referenceTypes: ["establishing-environment", "lighting-mood-frame"], fieldPreset: { shotType: "Wide establishing shot", cameraMovement: "Slow cinematic push", composition: "Foreground, midground, and background depth", lipSyncNeed: "No — voiceover only" } },
  { id: "quick-draft-sample", generationTypeId: "freestyle-draft", title: "Quick Draft Sample", description: "One fast 5-second idea clip with minimal setup.", bestUse: "Brainstorming before committing to structured production.", referenceTypes: [], fieldPreset: { duration: "5", qualityGoal: "Draft / cheap sample", lipSyncNeed: "No — draft only", voiceoverUseLater: "Optional" } },
];

export const FIELD_OPTIONS: Record<string, FieldOption[]> = {
  shotType: [
    { label: "Medium close-up", value: "Medium close-up", hint: "Strong for presenters and later lip-sync." },
    { label: "Chest-up speaker frame", value: "Chest-up speaker frame" },
    { label: "Product hero close-up", value: "Product hero close-up" },
    { label: "Wide establishing shot", value: "Wide establishing shot" },
  ],
  cameraMovement: [
    { label: "Slow push in", value: "Slow push in", hint: "Safe, readable motion for most providers." },
    { label: "Locked-off commercial frame", value: "Locked-off commercial frame" },
    { label: "Smooth lateral move", value: "Smooth lateral move" },
    { label: "Gentle orbit", value: "Gentle orbit" },
    { label: "Parallax reveal", value: "Parallax reveal" },
  ],
  primaryLighting: [
    { label: "Soft studio key light", value: "Soft studio key light" },
    { label: "Natural window light", value: "Natural window light" },
    { label: "Premium product lighting", value: "Premium product photography lighting" },
    { label: "Cinematic low-key lighting", value: "Cinematic low-key lighting" },
  ],
  visualStyle: [
    { label: "Photorealistic premium commercial", value: "Photorealistic premium commercial" },
    { label: "Cinematic realism", value: "Cinematic realism" },
    { label: "Documentary realism", value: "Documentary realism" },
    { label: "Clean SaaS product video", value: "Clean SaaS product video" },
  ],
  lipSyncNeed: [
    { label: "Yes — visible speaker", value: "Yes — visible speaker" },
    { label: "No — voiceover only", value: "No — voiceover only" },
    { label: "Optional", value: "Optional" },
    { label: "Skip — no visible mouth", value: "Skip — no visible mouth" },
  ],
  gestureDirection: [
    { label: "Natural open-hand gesture", value: "Natural open-hand gesture while explaining." },
    { label: "Minimal movement", value: "Minimal movement with stable posture." },
    { label: "Point lightly toward screen", value: "Point lightly toward the product UI or screen." },
    { label: "Confident forward lean", value: "Confident forward lean on the key line." },
  ],
  facialExpression: [
    { label: "Confident", value: "Confident, clear, and trustworthy." },
    { label: "Warm", value: "Warm, friendly, and approachable." },
    { label: "Focused", value: "Focused, premium, and intelligent." },
    { label: "Excited", value: "Excited but still natural and believable." },
  ],
};

export const PROVIDER_MAX_CLIP_SECONDS: Record<string, number> = { fal: 10, kling: 10, runway: 10, veo: 8, openai: 0, elevenlabs: 0 };

export function getVisualCardsForType(generationTypeId: string) { return VISUAL_LIBRARY_CARDS.filter((card) => card.generationTypeId === generationTypeId); }
export function getFieldOptions(fieldId: string) { return FIELD_OPTIONS[fieldId] || []; }
export function getReferenceSelectionCards() { return REFERENCE_SELECTION_CARDS; }

export function parseDurationSeconds(value: unknown, fallback = 5) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.round(value);
  const text = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!text) return fallback;
  const minute = text.match(/(\d+(?:\.\d+)?)\s*(m|min|minute|minutes)/);
  if (minute) return Math.round(Number(minute[1]) * 60);
  const second = text.match(/(\d+(?:\.\d+)?)\s*(s|sec|second|seconds)/);
  if (second) return Math.round(Number(second[1]));
  const plain = text.match(/\d+/);
  return plain ? Number(plain[0]) : fallback;
}

export function buildSetupDurationPlan(input: { duration?: unknown; provider?: string; workflowMode?: WorkflowMode }) {
  const requestedDurationSeconds = input.workflowMode === "freestyle-draft" ? 5 : parseDurationSeconds(input.duration, 10);
  const providerMaxClipSeconds = PROVIDER_MAX_CLIP_SECONDS[String(input.provider || "fal").toLowerCase()] || 10;
  const requiredClipCount = providerMaxClipSeconds > 0 ? Math.max(1, Math.ceil(requestedDurationSeconds / providerMaxClipSeconds)) : 1;
  const requiresStitching = input.workflowMode !== "freestyle-draft" && requiredClipCount > 1;
  return { requestedDurationSeconds, providerMaxClipSeconds, requiredClipCount, requiresStitching, recommendedWorkflow: requiresStitching ? "longform-multi-clip" as const : "single-clip" as const, userMessage: requiresStitching ? `${requestedDurationSeconds}s requires ${requiredClipCount} clips at ${providerMaxClipSeconds}s max per clip. Long-video stitching will be used.` : `${requestedDurationSeconds}s fits a single provider clip.` };
}
