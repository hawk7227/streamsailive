export const IMAGE_EDITOR_ACTIONS = Object.freeze([
  {
    id: "image_analyze",
    label: "Analyze",
    target: "image",
    capability: "analysis",
    route: "/api/streams/image/analyze",
    method: "POST",
    requires: ["assetId", "imageUrl"],
    output: "analysis",
    enabled: true,
  },
  {
    id: "image_micro_analyze",
    label: "Micro Analyze",
    target: "image",
    capability: "analysis",
    route: "/api/streams/image/analyze",
    method: "POST",
    requires: ["assetId", "imageUrl"],
    output: "analysis",
    detail: "original",
    enabled: true,
  },
  {
    id: "image_edit_prompt",
    label: "Prompt Edit",
    target: "image",
    capability: "image_to_image",
    route: "/api/streams/media/create",
    method: "POST",
    requires: ["assetId", "prompt"],
    output: "image",
    enabled: true,
  },
  {
    id: "image_remove_object",
    label: "Remove Object",
    target: "image",
    capability: "image_to_image",
    route: "/api/streams/media/create",
    method: "POST",
    requires: ["assetId", "selection", "prompt"],
    output: "image",
    enabled: true,
  },
  {
    id: "image_replace_object",
    label: "Replace Object",
    target: "image",
    capability: "image_to_image",
    route: "/api/streams/media/create",
    method: "POST",
    requires: ["assetId", "selection", "prompt"],
    output: "image",
    enabled: true,
  },
  {
    id: "image_expand_canvas",
    label: "Expand Canvas",
    target: "image",
    capability: "image_to_image",
    route: "/api/streams/media/create",
    method: "POST",
    requires: ["assetId", "aspectRatio", "prompt"],
    output: "image",
    enabled: true,
  },
  {
    id: "image_background_remove",
    label: "Remove Background",
    target: "image",
    capability: "image_to_image",
    route: "/api/streams/media/create",
    method: "POST",
    requires: ["assetId"],
    output: "image",
    enabled: true,
  },
  {
    id: "image_to_video",
    label: "Animate Image",
    target: "image",
    capability: "image_to_video",
    route: "/api/streams/media/create",
    method: "POST",
    requires: ["assetId", "motionPrompt"],
    output: "video",
    enabled: true,
  },
  {
    id: "image_layer_mask",
    label: "Layer Mask",
    target: "image",
    capability: "masking",
    route: "",
    method: "LOCAL",
    requires: ["selection"],
    output: "mask",
    enabled: false,
    blockedReason: "Layer mask editing requires the canvas mask model to be connected.",
  },
  {
    id: "image_version_save",
    label: "Save Version",
    target: "image",
    capability: "versioning",
    route: "",
    method: "POST",
    requires: ["artifactId"],
    output: "version",
    enabled: false,
    blockedReason: "Version save requires an artifactId-backed version route.",
  },
]);

export function getImageEditorAction(id) {
  return IMAGE_EDITOR_ACTIONS.find((action) => action.id === id) || null;
}

export function getEnabledImageEditorActions() {
  return IMAGE_EDITOR_ACTIONS.filter((action) => action.enabled);
}

export function getBlockedImageEditorActions() {
  return IMAGE_EDITOR_ACTIONS.filter((action) => !action.enabled);
}

export function buildImageEditorState(asset = {}) {
  return {
    asset,
    selectedTool: "inspect",
    selectedActionId: "",
    selectedLayerId: asset?.id || "",
    zoom: 1,
    compareMode: "current",
    activeSelection: null,
    actions: IMAGE_EDITOR_ACTIONS,
  };
}
