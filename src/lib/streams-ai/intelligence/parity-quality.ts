export const STREAMS_PARITY_QUALITY_VERSION = "streams-parity-quality-v1";

export type ParityQualityInput = {
  userInstruction: string;
  assistantContent: string;
  hasImages?: boolean;
  hasFiles?: boolean;
  usedMemory?: boolean;
  usedRuntimeContext?: boolean;
  exactStructureRequired?: boolean;
};

export type ParityQualityResult = {
  version: string;
  score: number;
  passed: boolean;
  dimensions: {
    nonEmpty: number;
    directness: number;
    instructionFit: number;
    grounding: number;
    structure: number;
    style: number;
  };
  flags: string[];
};

const GENERIC_OPENING = /^(certainly|of course|absolutely|great question|i(?:'d| would) be happy to help)[,!.\s]/i;
const GENERIC_CLOSING = /(?:please let me know|let me know if|if you want|if you need|feel free to ask|happy to help further)[^\n]*$/i;
const UNSUPPORTED_ACTION_CLAIM = /\b(i (?:have )?(?:browsed|searched|fetched|inspected|modified|updated|committed|deployed|called|validated|completed)|done\b|successfully deployed)\b/i;
const EXACT_FORMAT_SIGNAL = /\b(exact|exactly|only|same order|table|columns?|json|xml|csv|code block|blockquote|numbered sections?|headings?)\b/i;
const EXHAUSTIVE_SIGNAL = /\b(full|complete|non[- ]?compressed|non[- ]?condensed|exhaustive|end[- ]?to[- ]?end|nothing omitted)\b/i;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function hasRequestedStructure(instruction: string, output: string) {
  const text = instruction.toLowerCase();
  if (/\bjson\b/.test(text)) return /^\s*[\[{]/.test(output.trim());
  if (/\btable|columns?\b/.test(text)) return /\|[^\n]+\|\n\|[-:| ]+\|/.test(output);
  if (/\bcode block\b/.test(text)) return /```[\s\S]*```/.test(output);
  if (/\bblockquote\b/.test(text)) return /^>\s/m.test(output);
  if (/\bnumbered sections?\b/.test(text)) return /^\s*1[.)]\s/m.test(output);
  return true;
}

export function assessStreamsParityQuality(input: ParityQualityInput): ParityQualityResult {
  const instruction = String(input.userInstruction || "").trim();
  const output = String(input.assistantContent || "").trim();
  const flags: string[] = [];

  const nonEmpty = output.length > 0 ? 100 : 0;
  if (!output) flags.push("empty_response");

  let directness = 100;
  if (GENERIC_OPENING.test(output)) { directness -= 20; flags.push("generic_opening"); }
  if (GENERIC_CLOSING.test(output)) { directness -= 20; flags.push("generic_closing"); }
  if (output.length > 180 && output.slice(0, 180).toLowerCase().includes(instruction.slice(0, 80).toLowerCase())) {
    directness -= 10;
    flags.push("request_restatement");
  }

  let instructionFit = 100;
  const exactRequired = input.exactStructureRequired === true || EXACT_FORMAT_SIGNAL.test(instruction);
  if (exactRequired && !hasRequestedStructure(instruction, output)) {
    instructionFit -= 45;
    flags.push("requested_structure_missing");
  }
  if (EXHAUSTIVE_SIGNAL.test(instruction) && output.length < 900) {
    instructionFit -= 30;
    flags.push("exhaustive_request_underanswered");
  }

  let grounding = 100;
  if (UNSUPPORTED_ACTION_CLAIM.test(output) && !input.usedRuntimeContext) {
    grounding -= 50;
    flags.push("unverified_action_claim");
  }
  if (input.hasImages && /\b(definitely|proves?|confirmed|fully working|secure)\b/i.test(output) && !/does not independently verify|cannot verify|not verified/i.test(output)) {
    grounding -= 30;
    flags.push("image_claim_overstated");
  }

  let structure = 100;
  if (output.length > 1600 && !/\n#{1,4}\s|\n\d+[.)]\s|\n[-*]\s/.test(output)) {
    structure -= 15;
    flags.push("long_unstructured_response");
  }
  if (input.hasImages && !/the screenshot (shows|displays)|the visible interface states|the image (shows|displays)/i.test(output)) {
    structure -= 20;
    flags.push("image_attribution_missing");
  }

  let style = 100;
  if ((output.match(/\bhowever\b/gi) || []).length > 6) { style -= 10; flags.push("repetitive_transition"); }
  if ((output.match(/\bimportant\b/gi) || []).length > 8) { style -= 10; flags.push("repetitive_emphasis"); }

  const dimensions = {
    nonEmpty: clamp(nonEmpty),
    directness: clamp(directness),
    instructionFit: clamp(instructionFit),
    grounding: clamp(grounding),
    structure: clamp(structure),
    style: clamp(style),
  };

  const score = clamp(
    dimensions.nonEmpty * 0.2 +
    dimensions.directness * 0.15 +
    dimensions.instructionFit * 0.25 +
    dimensions.grounding * 0.2 +
    dimensions.structure * 0.1 +
    dimensions.style * 0.1,
  );

  return {
    version: STREAMS_PARITY_QUALITY_VERSION,
    score,
    passed: score >= 85 && !flags.includes("empty_response") && !flags.includes("unverified_action_claim"),
    dimensions,
    flags,
  };
}
