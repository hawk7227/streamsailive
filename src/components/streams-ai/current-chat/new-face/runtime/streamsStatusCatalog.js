export const STREAMS_STATUS_CATALOG = {
  core: {
    idle: "Ready",
    submitted: "Thinking…",
    understanding: "Understanding your request…",
    preparing: "Preparing response…",
    thinking: "Thinking…",
    streaming: "Writing…",
    complete: "Complete",
    delayed: "Still working on it…",
    failed: "Request failed.",
    cancelled: "Stopped",
    saved: "Saved",
  },

  webSearch: {
    requested: "Searching the web…",
    domain: (domain) => `Searching ${domain}`,
    recent: "Checking recent sources…",
    opening: "Opening source…",
    reading: "Reading source…",
    comparing: "Comparing sources…",
    citations: "Extracting citations…",
    summarizing: "Summarizing results…",
    complete: "Search complete",
    empty: "No useful results found.",
    failed: (reason) => `Web search failed${reason ? `: ${reason}` : ""}`,
  },

  files: {
    selecting: "Selecting files…",
    uploading: "Uploading files…",
    uploadingImage: "Uploading image…",
    uploadingVideo: "Uploading video…",
    uploadingAudio: "Uploading audio…",
    saved: "Upload saved",
    failed: "Upload failed",
    extractingText: "Extracting text…",
    readingPdf: "Reading PDF…",
    analyzingImage: "Analyzing image…",
    samplingVideo: "Sampling video frames…",
    transcribingAudio: "Transcribing audio…",
    ready: "File ready",
  },

  image: {
    detected: "Preparing image request…",
    prompt: "Preparing image prompt…",
    policy: "Checking image request…",
    starting: "Starting image generation…",
    generating: "Generating image…",
    preview: "Receiving preview…",
    saving: "Saving image…",
    ready: "Image ready",
    failed: "Image generation failed",
  },

  video: {
    detected: "Preparing video request…",
    scene: "Preparing scene…",
    checkingReference: "Checking reference image…",
    starting: "Starting video generation…",
    rendering: "Rendering video…",
    checkingStatus: "Checking video status…",
    processing: "Processing video…",
    saving: "Saving video…",
    ready: "Video ready",
    failed: "Video generation failed",
  },

  voice: {
    idle: "Voice is idle.",
    requestingMic: "Requesting microphone permission…",
    micDenied: "Microphone permission denied.",
    creatingSession: "Creating secure voice session…",
    connecting: "Connecting voice stream…",
    listening: "Listening. Speak naturally.",
    userSpeaking: "Listening…",
    assistantSpeaking: "STREAMS is speaking.",
    ended: "Voice session ended.",
    failed: "Realtime session failed.",
  },

  build: {
    preparing: "Preparing build…",
    readingFiles: "Reading files…",
    inspecting: "Inspecting project…",
    applying: "Applying changes…",
    checking: "Running checks…",
    passed: "Build passed",
    failed: "Build failed",
    preparingCommit: "Preparing commit…",
    pushing: "Pushing changes…",
    deploying: "Deploying…",
    deployPassed: "Deployment passed",
    deployFailed: "Deployment failed",
  },

  github: {
    checkingRepo: "Checking repository…",
    readingFile: "Reading file…",
    searchingRepo: "Searching repository…",
    creatingBranch: "Creating branch…",
    updatingFile: "Updating file…",
    openingPr: "Opening pull request…",
    complete: "GitHub update complete",
    failed: "GitHub action failed",
  },

  account: {
    loading: "Loading account…",
    loadingCredits: "Loading credits…",
    checkingPlan: "Checking plan…",
    openingPortal: "Opening billing portal…",
    startingCheckout: "Starting checkout…",
    billingUnavailable: "Billing is unavailable.",
    creditsUpdated: "Credits updated",
    usageLoading: "Loading usage…",
  },

  project: {
    loading: "Loading projects…",
    opening: "Opening project…",
    moving: "Moving to project…",
    saved: "Project saved",
    loadingLibrary: "Loading library…",
    refreshingLibrary: "Refreshing library…",
    assetSaved: "Asset saved",
  },

  chatActions: {
    copying: "Copying…",
    copied: "Copied",
    savingFeedback: "Saving feedback…",
    feedbackSaved: "Feedback saved",
    regenerating: "Regenerating…",
    branching: "Branching chat…",
    readingAloud: "Preparing audio…",
    pinning: "Pinning chat…",
    archiving: "Archiving chat…",
    deleting: "Deleting chat…",
  },

  mobile: {
    checkingDevice: "Checking device…",
    installAvailable: "App install available",
    standalone: "Installed app mode",
    offline: "You are offline.",
    online: "Back online",
  },
};

export function resolveStreamsStatus(domain, key, payload) {
  const group = STREAMS_STATUS_CATALOG[domain];
  if (!group) return "Working…";

  const value = group[key];
  if (!value) return "Working…";

  return typeof value === "function" ? value(payload) : value;
}
