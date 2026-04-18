import type {
  CameraLogic,
  DepthLogic,
  FramingLogic,
  LightingFamily,
  MediaIntent,
  NormalizedMediaPrompt,
} from "../media/types";

// Re-export shared types for consumers that import from here
export type {
  CameraLogic,
  DepthLogic,
  FramingLogic,
  LightingFamily,
  MediaIntent as ImageIntent,
  NormalizedMediaPrompt,
};

export type ImageSceneClass =
  | "wide landscape photograph"
  | "environmental portrait photograph"
  | "studio product photograph"
  | "food editorial photograph"
  | "architectural/interior photograph"
  | "macro/detail photograph"
  | "flat graphic image"
  | "stylized illustration"
  | "cinematic concept image"
  | "realistic photograph";

export type ImageShotSize =
  | "wide shot"
  | "medium shot"
  | "medium close-up"
  | "close-up"
  | "detail shot"
  | "product hero shot";

export type ImageSize =
  | "1024x1024"
  | "1536x1024"
  | "1024x1536"
  | "auto";

export type ImageQuality = "low" | "medium" | "high";

export type ImageOutputFormat = "png" | "jpeg" | "webp";

export type CompiledImagePromptState = {
  normalized: NormalizedMediaPrompt;
  intent: MediaIntent;
  sceneClass: ImageSceneClass;
  shotSize: ImageShotSize;
  camera: CameraLogic;
  framing: FramingLogic;
  depth: DepthLogic;
  lighting: LightingFamily;
  // Three stacks — never collapsed
  realismStack: string[];
  microDetailStack: string[];
  negativeBank: string[];
  compiledPrompt: string;
  size: ImageSize;
  quality: ImageQuality;
  outputFormat: ImageOutputFormat;
};

export type CompileImagePromptOptions = {
  forceIntent?: MediaIntent;
  forceSceneClass?: ImageSceneClass;
  size?: ImageSize;
  quality?: ImageQuality;
  outputFormat?: ImageOutputFormat;
};

export type ImageGenerationResult = {
  ok: true;
  url: string;
  storagePath: string;
  prompt: string;
  model: string;
  size: ImageSize;
  quality: ImageQuality;
} | {
  ok: false;
  errorCode:
    | "MISSING_PROVIDER_CREDENTIALS"
    | "PROVIDER_REQUEST_FAILED"
    | "EMPTY_PROVIDER_OUTPUT"
    | "STORAGE_FAILED"
    | "DB_WRITE_FAILED";
  message: string;
  retriable: boolean;
};
