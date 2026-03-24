export interface ImageGenerationPolicy {
  rejectPromptIfContains: string[];
  requireAtLeastOne: string[];
  requireAllForHumanRealism: string[];
  preferredSelectionHeuristics: string[];
  hardRules: string[];
}

export const ENTERPRISE_REALISM_POLICY: ImageGenerationPolicy = {
  rejectPromptIfContains: [
    "cinematic","dramatic lighting","movie still","film still","editorial",
    "fashion photography","vogue","glossy","luxury aesthetic","masterpiece",
    "award-winning","hyper detailed","8k","rendered","cgi","concept art",
    "airbrushed skin","perfect skin","flawless skin","shallow depth of field",
    "bokeh","studio lighting","premium","beautiful","stunning","dramatic",
    "luxury","polished","high-end","ultra-detailed","sharp focus","moody",
    "filmic","professional portrait","depth of field","soft lighting",
    "clean composition","warm tones","color grade","lifestyle photography",
  ],
  requireAtLeastOne: [
    "real","natural","casual","unposed","ordinary","everyday",
  ],
  requireAllForHumanRealism: [
    "visible pores","natural skin texture","no smoothing","no beauty retouching",
  ],
  preferredSelectionHeuristics: [
    "Choose the least glamorous image.",
    "Choose the least cinematic image.",
    "Choose the flattest believable lighting.",
    "Choose the image with the most natural skin texture.",
    "Choose the image with the most ordinary environment.",
    "Choose the image that looks most like a real phone or everyday photo.",
  ],
  hardRules: [
    "Do not let user prompt style words bypass realism enforcement.",
    "Do not pass through cinematic language even if requested.",
    "Do not allow luxury staging words to survive rewrite.",
    "Always add negative realism rules.",
    "Always add human imperfection rules for human subjects.",
    "Always add environment imperfection rules for indoor scenes.",
    "Always select standard quality over higher polish for realism-first generation.",
  ],
};
