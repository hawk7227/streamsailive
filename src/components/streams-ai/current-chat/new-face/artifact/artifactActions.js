function blockedArtifactAction(actionName) {
  window.alert(`Blocked: durable artifact ${actionName} route missing. This action needs a real server-side artifact/project API before it can be enabled.`);
  return `Blocked: durable artifact ${actionName} route missing`;
}

export function getArtifactPayload(artifactText = "") {
  const text = String(artifactText || "");
  return {
    title: "Preview Section Sample",
    language: "typescript",
    text,
    size: text.length,
    updatedAt: new Date().toISOString(),
  };
}

export async function copyArtifactText(artifactText = "") {
  await navigator.clipboard?.writeText(String(artifactText || ""));
  return "Copied artifact code";
}

export async function shareArtifactText(artifactText = "") {
  const payload = getArtifactPayload(artifactText);
  await navigator.clipboard?.writeText(
    `Streams artifact: ${payload.title}\n\n${payload.text}`
  );
  return "Copied share payload";
}

export function downloadArtifactText(artifactText = "", filename = "PreviewSectionSample.tsx") {
  const blob = new Blob([String(artifactText || "")], {
    type: "text/plain;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  return "Downloaded artifact";
}

export function viewArtifactInfo(artifactText = "") {
  const payload = getArtifactPayload(artifactText);
  window.alert(
    `Artifact file\n\nTitle: ${payload.title}\nLanguage: ${payload.language}\nSize: ${payload.size} characters`
  );
  return "Viewed artifact info";
}

export function moveArtifactToProject() {
  return blockedArtifactAction("move-to-project");
}

export function pinArtifact() {
  return blockedArtifactAction("pin");
}

export function archiveArtifact() {
  return blockedArtifactAction("archive");
}

export function deleteArtifact() {
  return blockedArtifactAction("delete");
}
