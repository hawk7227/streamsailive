import { ENTERPRISE_REALISM_POLICY } from "./image-generation-policy";

export type RealismMode = "casual_phone_photo" | "indoor_portrait" | "candid";
export type SubjectType = "human" | "environment" | "unknown";

export interface SanitizeInput {
  rawPrompt: string;
  subjectAction?: string; // e.g. "a woman in her early 30s sitting on a couch"
  mode?: RealismMode;
  subjectType?: SubjectType;
  outputCount?: number;
  severity?: "strict" | "moderate";
  requireHumanRealism?: boolean;
  requireEnvironmentRealism?: boolean;
  requirePhoneCameraLook?: boolean;
  banTextOverlays?: boolean;
  banUiPanels?: boolean;
  preserveUserIntent?: boolean;
}

export interface SanitizeOutput {
  sanitizedPrompt: string;
  rejectedWords: string[];
  injectedRules: string[];
  apiRecommendation: {
    model: "dall-e-3";
    size: "1024x1024" | "1792x1024" | "1024x1792";
    quality: "standard";
    n: number;
  };
}

const FULL_REALISM_PROMPT = (subjectAction: string): string => `Create a photograph that looks like a real, ordinary, unpolished image of a real human being in a real environment.

SUBJECT:
${subjectAction}

PRIMARY GOAL:
The only goal is realism. Do not make the image artistic, cinematic, dramatic, luxury, premium, editorial, glamorous, fashionable, or visually impressive. The image should look like a normal real-life photograph of a real person, taken in an everyday moment.

HUMAN REALISM REQUIREMENTS:
The person must look fully human and not AI-stylized.
Show natural skin texture, visible pores, slight unevenness in skin tone, natural facial asymmetry, natural hair strands, realistic hands, realistic eyes, realistic teeth, and realistic clothing folds.
Do not beautify the face.
Do not smooth the skin.
Do not airbrush the skin.
Do not make the face too symmetrical.
Do not make the subject look like a fashion model.
Do not make the expression overly polished or posed.
The body posture must feel natural, casual, and slightly imperfect.

LIGHTING REQUIREMENTS:
Use flat, ordinary, natural-looking lighting.
Prefer normal window light coming from the side of the room.
Lighting should be even or slightly uneven in a believable way.
Allow mild overexposure near the window if natural.
Shadows should be soft and minimal.
Do not use dramatic shadows.
Do not use cinematic lighting.
Do not use studio lighting.
Do not use glow effects.
Do not make the image look intentionally lit for a production shoot.

CAMERA REQUIREMENTS:
The image should feel like a normal photo taken with a phone camera.
No cinematic lens look.
No dramatic depth of field.
No exaggerated background blur.
No ultra-sharp studio clarity.
No artificial crispness.
Keep most of the image naturally in focus.
The image should feel like a real snapshot, not a movie still.

ENVIRONMENT REQUIREMENTS:
The setting is a normal lived-in living room.
Include a couch, possibly a blanket or pillow, a coffee table, and small everyday items like a remote or cup.
The environment should be slightly imperfect and believable, not staged, not luxury-designed, and not showroom-clean.
Materials should look real with natural imperfections.

POSE AND COMPOSITION:
Sitting in a relaxed position, slightly leaning back or forward naturally.
Posture is casual and not perfectly straight.
Framing is slightly off-center, like a real handheld photo.
Do not perfectly center the subject.
Allow slight imperfection in alignment or cropping.

COLOR REQUIREMENTS:
Use neutral, realistic colors.
No color grading.
No cinematic tones.
No high contrast.
No glossy or polished finish.

TEXTURE AND DETAIL:
Preserve realistic fabric texture, skin texture, and hair detail.
Hands must look anatomically correct.
Eyes must look natural and not glassy.
Nothing should look plastic, waxy, or rendered.

STRICT NEGATIVE RULES:
No cinematic lighting. No dramatic shadows. No studio lighting. No editorial photography.
No fashion photography. No glamour styling. No beauty retouching. No perfect or airbrushed skin.
No luxury or premium aesthetic. No movie still look. No film look. No glossy commercial polish.
No hyper-detailed rendering. No CGI or rendered look. No AI-art look.
No exaggerated blur or depth of field. No perfectly staged environment.
No floating UI, panels, overlays, text, captions, or mockups.

FINAL LOCK:
If the image looks impressive, cinematic, glamorous, or polished, it is wrong.
If it looks plain, human, believable, and like a normal phone photo, it is correct.`;

export function sanitizeRealismPrompt(input: SanitizeInput): SanitizeOutput {
  const policy = ENTERPRISE_REALISM_POLICY;
  const rejectedWords: string[] = [];
  const injectedRules: string[] = [];

  // Scan raw prompt for banned words
  const rawLower = input.rawPrompt.toLowerCase();
  for (const word of policy.rejectPromptIfContains) {
    if (rawLower.includes(word.toLowerCase())) {
      rejectedWords.push(word);
    }
  }

  // Use subjectAction if provided, otherwise extract intent from rawPrompt
  const subjectAction = input.subjectAction ??
    "a woman in her early 30s sitting on a couch in her living room, casually holding her smartphone and reading something on the screen";

  // Build the fully locked sanitized prompt
  const sanitizedPrompt = FULL_REALISM_PROMPT(subjectAction);

  injectedRules.push(
    "visible pores + natural skin texture",
    "no beauty retouching",
    "flat natural lighting",
    "phone camera feel",
    "lived-in environment",
    "no text/UI overlays",
  );

  return {
    sanitizedPrompt,
    rejectedWords,
    injectedRules,
    apiRecommendation: {
      model: "dall-e-3",
      size: "1024x1024",
      quality: "standard",
      n: Math.min(input.outputCount ?? 3, 4),
    },
  };
}
