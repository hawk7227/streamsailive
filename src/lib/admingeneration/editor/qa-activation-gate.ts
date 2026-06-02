export type QaGateCheck = {
  id: string;
  label: string;
  status: "pass" | "fail" | "needs_check" | "blocked";
  reason?: string;
};

export type QaActivationGateResult = {
  okToActivate: boolean;
  status: "pass" | "fail" | "needs_check" | "blocked";
  checks: QaGateCheck[];
  requiredBeforeActivation: string[];
};

function normalizeStatus(value: unknown): QaGateCheck["status"] {
  const text = String(value || "").toLowerCase();
  if (text.includes("pass") || text === "ok" || text === "ready") return "pass";
  if (text.includes("fail") || text.includes("error")) return "fail";
  if (text.includes("block")) return "blocked";
  return "needs_check";
}

export function evaluateQaActivationGate(input: {
  qc?: any;
  providerRuns?: any;
  selectedTarget?: any;
  version?: any;
}): QaActivationGateResult {
  const qc = input.qc || {};
  const checks: QaGateCheck[] = [
    { id: "identity", label: "Identity consistency", status: normalizeStatus(qc.identity) },
    { id: "hands", label: "Hands / gesture quality", status: normalizeStatus(qc.hands) },
    { id: "mouth_sync", label: "Mouth sync", status: normalizeStatus(qc.mouthSync || qc.mouth_sync) },
    { id: "audio_sync", label: "Audio sync", status: normalizeStatus(qc.audioSync || qc.audio_sync) },
    { id: "flicker", label: "Flicker / artifacts", status: normalizeStatus(qc.flicker) },
    { id: "continuity", label: "Scene continuity", status: normalizeStatus(qc.continuity) },
    { id: "aspect_ratio", label: "Aspect ratio", status: normalizeStatus(qc.aspectRatio || qc.aspect_ratio) },
    { id: "provider_output", label: "Provider output exists", status: input.providerRuns ? "needs_check" : "blocked", reason: input.providerRuns ? undefined : "Provider run data unavailable." },
  ];

  const failed = checks.filter((check) => check.status === "fail" || check.status === "blocked");
  const unknown = checks.filter((check) => check.status === "needs_check");

  if (failed.length) {
    return {
      okToActivate: false,
      status: "blocked",
      checks,
      requiredBeforeActivation: failed.map((check) => `${check.label}: ${check.reason || check.status}`),
    };
  }

  if (unknown.length) {
    return {
      okToActivate: false,
      status: "needs_check",
      checks,
      requiredBeforeActivation: unknown.map((check) => `${check.label} requires QA confirmation.`),
    };
  }

  return {
    okToActivate: true,
    status: "pass",
    checks,
    requiredBeforeActivation: [],
  };
}
