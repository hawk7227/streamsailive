export async function analyzeText(prompt: string) {
  return {
    type: "text",
    summary: prompt,
    style: "unknown",
    structure: "single",
    keyElements: [prompt],
    recommendations: ["Refine prompt for better output"],
  };
}

export async function analyzeUrl(url: string) {
  return {
    type: "video",
    summary: "Reference video analyzed",
    style: "cinematic",
    structure: "multi-scene",
    keyElements: ["scene", "motion"],
    recommendations: ["Use image_to_video for cost savings"],
    url,
  };
}

export async function analyzeFile(file: File) {
  return {
    type: "file",
    summary: file.name,
    style: "detected",
    structure: "unknown",
    keyElements: [file.name],
    recommendations: [],
  };
}
