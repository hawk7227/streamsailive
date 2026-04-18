import { classifyMediaIntent } from "../../media/compile/classifyIntent";
import { normalizeMediaPrompt } from "../../media/compile/normalize";
import {
  selectCamera,
  selectDepth,
  selectFraming,
  selectLighting,
} from "../../media/compile/selectPhysical";
import {
  selectMicroDetailStack,
  selectNegativeBank,
  selectRealismStack,
} from "../../media/compile/selectStacks";
import { assertNoDuplicates, validateCompiledPrompt, validateRawPrompt } from "../../media/guards";
import type { MediaIntent } from "../../media/types";
import { validateCompileOptions } from "../validate";
import {
  IMAGE_ASPECT_RATIO_TO_SIZE,
  IMAGE_DEFAULT_FORMAT,
  IMAGE_DEFAULT_MODEL,
  IMAGE_DEFAULT_QUALITY,
  IMAGE_EXTRA_NEGATIVES,
  IMAGE_SCENE_CLASS_MAP,
  IMAGE_SHOT_MAP,
} from "../constants";
import type {
  CompiledImagePromptState,
  CompileImagePromptOptions,
  ImageSceneClass,
  ImageSize,
} from "../types";

function selectSceneClass(intent: MediaIntent): ImageSceneClass {
  return IMAGE_SCENE_CLASS_MAP[intent];
}

function assembleFinalPrompt(state: Omit<CompiledImagePromptState, "compiledPrompt">): string {
  const parts: string[] = [];

  parts.push(`${state.sceneClass} of ${state.normalized.subjectPrompt}`);
  parts.push(state.shotSize);
  parts.push(state.camera.lens);
  parts.push(state.camera.viewpoint);
  parts.push(...state.camera.notes);
  parts.push(...state.framing.compositionRules);
  parts.push(...state.framing.subjectRules);
  parts.push(...state.framing.environmentRules);

  if (state.depth !== "not_applicable") {
    parts.push(state.depth);
  }

  parts.push(state.lighting);

  // Three stacks — assembled in strict order, never collapsed
  parts.push(...state.realismStack);
  if (state.microDetailStack.length > 0) {
    parts.push(...state.microDetailStack);
  }
  parts.push(...state.negativeBank);

  return parts.filter(Boolean).join(", ");
}

export function compileImagePrompt(
  rawPrompt: string,
  options: CompileImagePromptOptions = {},
): CompiledImagePromptState {
  const validatedPrompt = validateRawPrompt(rawPrompt);
  const validatedOptions = validateCompileOptions(options);

  const normalized = normalizeMediaPrompt(validatedPrompt);
  const classification = classifyMediaIntent(normalized);
  const intent: MediaIntent = validatedOptions.forceIntent ?? classification.intent;
  const sceneClass: ImageSceneClass = validatedOptions.forceSceneClass ?? selectSceneClass(intent);
  const shotSize = IMAGE_SHOT_MAP[intent];
  const camera = selectCamera(intent);
  const framing = selectFraming(intent);
  const depth = selectDepth(intent);
  const lighting = selectLighting(intent, normalized);

  // Three stacks — selected independently, never collapsed
  const realismStack = selectRealismStack(intent);
  const microDetailStack = selectMicroDetailStack(intent);
  const negativeBank = [
    ...selectNegativeBank(intent, normalized),
    ...IMAGE_EXTRA_NEGATIVES,
  ];

  const size: ImageSize =
    IMAGE_ASPECT_RATIO_TO_SIZE[validatedOptions.aspectRatio ?? "16:9"] ?? "1536x1024";

  const stateWithoutPrompt: Omit<CompiledImagePromptState, "compiledPrompt"> = {
    normalized,
    intent,
    sceneClass,
    shotSize,
    camera,
    framing,
    depth,
    lighting,
    realismStack,
    microDetailStack,
    negativeBank,
    size,
    quality: validatedOptions.quality ?? IMAGE_DEFAULT_QUALITY,
    outputFormat: validatedOptions.outputFormat ?? IMAGE_DEFAULT_FORMAT,
  };

  const rawCompiledPrompt = assembleFinalPrompt(stateWithoutPrompt);
  const compiledPrompt = validateCompiledPrompt(rawCompiledPrompt, "image");
  assertNoDuplicates(realismStack, "realismStack");
  assertNoDuplicates(microDetailStack, "microDetailStack");
  assertNoDuplicates(negativeBank, "negativeBank");

  return { ...stateWithoutPrompt, compiledPrompt };
}

export { IMAGE_DEFAULT_MODEL };
