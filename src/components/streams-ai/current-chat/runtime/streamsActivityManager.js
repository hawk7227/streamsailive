const ACTIVITY_LABELS = {
  chat: {
    starting: ["Thinking", "I’m working through your request now."],
    streaming: ["Writing response", "I’m streaming the answer as it is generated."],
    complete: ["Ready", "The response is ready."],
    error: ["Error", "The request did not complete successfully."],
  },
  image: {
    starting: ["Preparing image generation", "I’m setting up your image request now."],
    rendering: ["Generating image", "Your image is actively being created."],
    polling: ["Finalizing image", "I’m preparing the finished image output."],
    complete: ["Image ready", "Your generated image is ready."],
    error: ["Image generation failed", "The image request did not complete successfully."],
  },
  video: {
    starting: ["Preparing video generation", "I’m setting up your video request now."],
    rendering: ["Rendering video", "Your video is actively being created."],
    polling: ["Finalizing video", "I’m preparing the finished video output."],
    complete: ["Video ready", "Your generated video is ready."],
    error: ["Video generation failed", "The video request did not complete successfully."],
  },
  artifact: {
    starting: ["Preparing artifact", "I’m setting up the artifact workspace."],
    rendering: ["Building artifact", "I’m preparing the code or preview artifact."],
    complete: ["Artifact ready", "The artifact is ready to review."],
    error: ["Artifact failed", "The artifact request did not complete successfully."],
  },
};

export function createActivity({ mode = "chat", phase = "starting", statusText } = {}) {
  const safeMode = ACTIVITY_LABELS[mode] ? mode : "chat";
  const group = ACTIVITY_LABELS[safeMode];
  const [title, subtitle] = group[phase] || group.starting;

  return {
    id: `activity_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    mode: safeMode,
    phase,
    title: statusText || title,
    subtitle,
    statusText: statusText || title,
    createdAt: new Date().toISOString(),
  };
}

export function isGenerationActivity(activity) {
  return activity?.mode === "image" || activity?.mode === "video";
}
