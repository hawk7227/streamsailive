export type GuidedCaptureStep = {
  id: string;
  title: string;
  instruction: string;
  referenceType: string;
};

export const SELF_REFERENCE_CAPTURE_STEPS: GuidedCaptureStep[] = [
  {
    id: "face-close-up",
    title: "Face close-up",
    instruction: "Look directly at the camera. Keep your full face visible, evenly lit, sharp, and unobstructed.",
    referenceType: "face-close-up",
  },
  {
    id: "mid-shot-speaker",
    title: "Mid-shot speaker",
    instruction: "Frame from chest or waist up. Keep mouth and hands visible enough for speaker motion and possible lip-sync.",
    referenceType: "mid-shot-speaker",
  },
  {
    id: "gesture-sample",
    title: "Natural gesture sample",
    instruction: "Speak naturally and use one simple open-hand gesture. Avoid fast hand movement and keep framing stable.",
    referenceType: "full-body-action-pose",
  },
];

export async function requestGuidedCaptureStream() {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new Error("Camera recording is not available in this browser.");
  }

  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user", width: { ideal: 1920 }, height: { ideal: 1080 } },
    audio: true,
  });
}

export function createGuidedRecorder(stream: MediaStream, onData: (blob: Blob) => void) {
  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("video/webm") ? "video/webm" : undefined });

  recorder.ondataavailable = (event) => {
    if (event.data?.size) chunks.push(event.data);
  };

  recorder.onstop = () => {
    onData(new Blob(chunks, { type: recorder.mimeType || "video/webm" }));
  };

  return recorder;
}

export async function uploadGuidedCapture(args: {
  blob: Blob;
  projectId: string;
  referenceType: string;
  fileName?: string;
}) {
  const form = new FormData();
  const file = new File([args.blob], args.fileName || `${args.referenceType}-${Date.now()}.webm`, { type: args.blob.type || "video/webm" });
  form.append("file", file);
  form.append("projectId", args.projectId);
  form.append("requestedProfile", "admin_full");
  form.append("referenceType", args.referenceType);

  const response = await fetch("/api/admingeneration/reference/upload-and-analyze", {
    method: "POST",
    body: form,
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || `Guided capture upload failed (${response.status}).`);
  }
  return data;
}
