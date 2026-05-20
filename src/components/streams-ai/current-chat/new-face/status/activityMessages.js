export const ACTIVITY_MESSAGES = {
  chat: {
    ready: {
      label: "READY",
      title: "Ready",
      subtitle: "Ask anything when you are ready.",
    },
    thinking: {
      label: "THINKING",
      title: "Thinking",
      subtitle: "I’m working through your request now.",
    },
    working: {
      label: "WORKING",
      title: "Working on it",
      subtitle: "I’m keeping the session active while the answer is prepared.",
    },
    responding: {
      label: "RESPONDING",
      title: "Writing response",
      subtitle: "I’m streaming the answer as it is generated.",
    },
    complete: {
      label: "COMPLETE",
      title: "Complete",
      subtitle: "The response is ready.",
    },
    error: {
      label: "ERROR",
      title: "Something went wrong",
      subtitle: "The request did not complete successfully.",
    },
  },

  image: {
    starting: {
      label: "IMAGE GENERATION",
      title: "Preparing image generation",
      subtitle: "I’m setting up your image request now.",
    },
    generating: {
      label: "IMAGE GENERATION",
      title: "Generating image",
      subtitle: "Your image is actively being created.",
    },
    finalizing: {
      label: "IMAGE GENERATION",
      title: "Finalizing image",
      subtitle: "I’m preparing the finished image output.",
    },
    complete: {
      label: "IMAGE READY",
      title: "Image ready",
      subtitle: "Your generated image is ready.",
    },
    error: {
      label: "IMAGE ERROR",
      title: "Image generation failed",
      subtitle: "The image request did not complete successfully.",
    },
  },

  video: {
    starting: {
      label: "VIDEO GENERATION",
      title: "Preparing video generation",
      subtitle: "I’m setting up your video request now.",
    },
    rendering: {
      label: "VIDEO GENERATION",
      title: "Rendering video",
      subtitle: "Your video is actively being created.",
    },
    finalizing: {
      label: "VIDEO GENERATION",
      title: "Finalizing video",
      subtitle: "I’m preparing the finished video output.",
    },
    complete: {
      label: "VIDEO READY",
      title: "Video ready",
      subtitle: "Your generated video is ready.",
    },
    error: {
      label: "VIDEO ERROR",
      title: "Video generation failed",
      subtitle: "The video request did not complete successfully.",
    },
  },
};

export function getActivityMessage({ mode = "chat", phase = "working", statusText } = {}) {
  const normalizedMode = mode === "image-edit" ? "image" : mode;
  const group = ACTIVITY_MESSAGES[normalizedMode] || ACTIVITY_MESSAGES.chat;
  const message = group[phase] || group.working || ACTIVITY_MESSAGES.chat.working;

  if (statusText && statusText !== "Ready") {
    return {
      ...message,
      title: statusText,
    };
  }

  return message;
}
