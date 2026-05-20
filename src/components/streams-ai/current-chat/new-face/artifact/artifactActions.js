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

export function moveArtifactToProject(artifactText = "") {
  const project = window.prompt("Move artifact to project:", "Streams");
  if (!project) return "Move canceled";
  const payload = { ...getArtifactPayload(artifactText), project };
  window.localStorage.setItem("streams.localArtifactProject", JSON.stringify(payload));
  return `Moved artifact to ${project}`;
}

export function pinArtifact(artifactText = "") {
  const payload = getArtifactPayload(artifactText);
  window.localStorage.setItem("streams.localPinnedArtifact", JSON.stringify(payload));
  return "Pinned artifact";
}

export function archiveArtifact(artifactText = "") {
  const payload = getArtifactPayload(artifactText);
  window.localStorage.setItem("streams.localArchivedArtifact", JSON.stringify(payload));
  return "Archived artifact";
}

export function deleteArtifact(setArtifactText) {
  if (!window.confirm("Delete the current local artifact from the editor?")) {
    return "Delete canceled";
  }
  if (typeof setArtifactText === "function") {
    setArtifactText("");
  }
  return "Deleted local artifact";
}
