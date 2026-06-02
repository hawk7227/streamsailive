export type ProfessionalReadinessItem = {
  id: string;
  label: string;
  status: "ready" | "needs_data" | "needs_provider" | "needs_worker";
  reason?: string;
};

export function buildProfessionalReadiness(input: {
  sync?: any;
  wordSpeaker?: any;
  subjectMotion?: any;
  objectMaskData?: any;
  activationGate?: any;
  exportProof?: any;
  providerReadiness?: any;
}) {
  const providers = Array.isArray(input.providerReadiness?.providers) ? input.providerReadiness.providers : [];
  const missingProviders = providers.filter((provider: any) => !provider.ready);

  const items: ProfessionalReadinessItem[] = [
    {
      id: "master_timeline_sync",
      label: "Master timeline sync",
      status: input.sync?.sync?.segments?.length ? "ready" : "needs_data",
      reason: input.sync?.sync?.segments?.length ? undefined : "Timeline segments are missing.",
    },
    {
      id: "word_speaker_map",
      label: "Word / speaker timestamp map",
      status: input.wordSpeaker?.map?.wordCount ? "ready" : "needs_data",
      reason: input.wordSpeaker?.map?.wordCount ? undefined : "Word timestamps are missing.",
    },
    {
      id: "subject_motion_binding",
      label: "Subject identity + motion profile binding",
      status: input.subjectMotion?.subjectMotion?.bindings?.length ? "ready" : "needs_data",
      reason: input.subjectMotion?.subjectMotion?.bindings?.length ? undefined : "Subject profiles are missing.",
    },
    {
      id: "mask_object_data",
      label: "Mask / object / background edit data",
      status: input.objectMaskData?.objectMaskData?.targets?.length ? "ready" : "needs_data",
      reason: input.objectMaskData?.objectMaskData?.targets?.length ? undefined : "Object masks/depth data are missing.",
    },
    {
      id: "provider_readiness",
      label: "Provider readiness",
      status: missingProviders.length ? "needs_provider" : "ready",
      reason: missingProviders.length ? `Missing providers: ${missingProviders.map((p: any) => p.id).join(", ")}` : undefined,
    },
    {
      id: "qa_activation_gate",
      label: "QA activation gate",
      status: input.activationGate?.gate?.okToActivate ? "ready" : "needs_data",
      reason: input.activationGate?.gate?.okToActivate ? undefined : "QA gate is not passing yet.",
    },
    {
      id: "export_proof",
      label: "Export proof",
      status: input.exportProof?.proof?.exportReady ? "ready" : "needs_worker",
      reason: input.exportProof?.proof?.exportReady ? undefined : "No real export output proof yet.",
    },
  ];

  return {
    ok: true,
    ready: items.every((item) => item.status === "ready"),
    items,
  };
}
