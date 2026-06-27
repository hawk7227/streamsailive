export type VisualEditIntentResolution = {
  matched: boolean;
  reason: string;
  repo?: string;
  branch?: string;
  path?: string;
  route?: string;
  enrichedPrompt?: string;
};

type SourceHint = {
  repo?: string;
  branch?: string;
  path?: string;
  route?: string;
};

function hasAll(text: string, words: string[]) {
  return words.every((word) => text.includes(word));
}

export function resolveVisualEditIntent(prompt: string, source: SourceHint = {}): VisualEditIntentResolution {
  const text = String(prompt || "").toLowerCase();

  const asksToRemove = /\b(remove|delete|hide|take\s+out|get\s+rid\s+of)\b/.test(text);
  const mentionsVisitCards = /visit\s+cards?|cards?\s+below|two\s+cards?|2\s+cards?/.test(text);
  const anchorsHeroCopy = hasAll(text, ["healthcare", "personal", "again"]) || hasAll(text, ["doctor", "image"]);
  const patientLandingContext = /patient|doctor|provider|healthcare|visit|rx|refill|follow\s*up|private\s+review/.test(text);

  if (asksToRemove && mentionsVisitCards && (anchorsHeroCopy || patientLandingContext)) {
    const repo = source.repo && source.repo !== "hawk7227/streamsailive" ? source.repo : "hawk7227/patientpanel";
    const branch = source.branch && source.repo === repo ? source.branch : "master";
    const path = source.path && source.repo === repo ? source.path : "src/app/page.tsx";
    const route = source.route || "/";
    return {
      matched: true,
      reason: "Remove only the landing-page VisitCards instance below the doctor/hero section, not the global VisitCards component.",
      repo,
      branch,
      path,
      route,
      enrichedPrompt: [
        prompt.trim(),
        "",
        "SYSTEM VISUAL-EDIT RESOLUTION:",
        "The user is referring to the two VisitCards rendered below the doctor/provider image and the heading \"Healthcare That Feels Personal Again\" on the patient landing page.",
        "Correct source target: repo hawk7227/patientpanel, branch master, file src/app/page.tsx, route /.",
        "Apply the edit only at the JSX usage site in src/app/page.tsx: remove the <VisitCards ... /> block in that section below the doctor/hero area.",
        "Do not delete, rename, or globally modify src/components/home/VisitCards.tsx because the component may be reused elsewhere.",
        "Do not remove BookingOverlay, handleConditionClick, pricing, intake, or visit-type logic unless it is only dead local wiring for that removed landing-page block.",
        "Stop at diff/approval. Do not commit. Do not push.",
      ].join("\n"),
    };
  }

  return { matched: false, reason: "No specific visual edit rule matched." };
}
