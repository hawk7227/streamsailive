import type { LongVideoPlan } from "./long-video-contract";
import type { LongVideoStitchPlan } from "./long-video-stitch-plan";

export function evaluateLongVideoReadiness(input: {
  plan?: LongVideoPlan | null;
  stitchPlan?: LongVideoStitchPlan | null;
}) {
  const plan = input.plan;
  const stitchPlan = input.stitchPlan;

  const checks = [
    {
      id: "plan",
      label: "Scene / shot plan",
      ready: Boolean(plan?.scenes?.length),
      reason: plan?.scenes?.length ? null : "No long-video plan exists.",
    },
    {
      id: "identity_lock",
      label: "Identity lock",
      ready: Boolean(plan?.identityLock),
      reason: plan?.identityLock ? null : "Identity lock not enabled.",
    },
    {
      id: "stitch_plan",
      label: "Auto stitch plan",
      ready: Boolean(stitchPlan?.ok),
      reason: stitchPlan?.ok ? null : "Stitch plan is missing or has no clips.",
    },
    {
      id: "seam_repair",
      label: "Seam repair",
      ready: Boolean(stitchPlan?.seamRepair),
      reason: stitchPlan?.seamRepair ? null : "Seam repair plan missing.",
    },
    {
      id: "audio_continuity",
      label: "Audio continuity",
      ready: Boolean(stitchPlan?.audioPlan?.preserveDialogueSync),
      reason: stitchPlan?.audioPlan?.preserveDialogueSync ? null : "Audio continuity plan missing.",
    },
  ];

  return {
    ok: true,
    ready: checks.every((check) => check.ready),
    checks,
  };
}
