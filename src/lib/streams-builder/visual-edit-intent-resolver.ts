export type VisualEditScope = "usage_site" | "component_definition" | "data_config" | "style_only" | "unknown";

export type VisualEditIntentResolution = {
  matched: boolean;
  reason: string;
  repo?: string;
  branch?: string;
  path?: string;
  route?: string;
  scope?: VisualEditScope;
  visualIntent?: string;
  visualAnchors?: string[];
  safePatchTarget?: string;
  doNotTouch?: string[];
  proofRequired?: string[];
  enrichedPrompt?: string;
};

type SourceHint = {
  repo?: string;
  branch?: string;
  path?: string;
  route?: string;
  selectedText?: string;
  selectedTag?: string;
  nearestHeading?: string;
};

const GLOBAL_BUILDER_UNDERSTANDING = [
  "GLOBAL AI BUILDER UNDERSTANDING:",
  "You are resolving a visual frontend edit before any repair/build queue starts.",
  "Do not treat the user request as a generic chat response. Map visual language to source truth.",
  "Identify the rendered thing, its nearest visual anchors, route, source page, component usage, reusable component risk, and smallest safe patch.",
  "Prefer editing the JSX usage site for one visible instance. Edit a shared component only when the user clearly wants a global component change.",
  "When removing a rendered instance of a reusable component, remove that instance from the page/section and preserve the reusable component file.",
  "Preserve booking, payment, intake, provider, overlay, route, API, auth, and business logic unless it is proven dead local wiring for the removed instance.",
  "Minimal patch mode is required when the user says only/remove this/don't touch anything else/keep unchanged.",
  "Produce source diff, build proof, browser proof, and stop at approval before commit or push.",
].join("\n");

function hasAll(text: string, words: string[]) {
  return words.every((word) => text.includes(word));
}

function hasAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

function unique(items: string[]) {
  return [...new Set(items.filter(Boolean))];
}

function normalizeRoute(value?: string) {
  const route = (value || "/").trim().replace(/[.,;:!?]+$/g, "");
  return route.startsWith("/") ? route : `/${route}`;
}

function inferAction(text: string) {
  if (/\b(remove|delete|hide|take\s+out|get\s+rid\s+of)\b/.test(text)) return "remove";
  if (/\b(replace|swap|change)\b/.test(text)) return "replace";
  if (/\b(move|reorder|put|place)\b/.test(text)) return "move";
  if (/\b(make|style|color|size|space|align|bold|white|green|purple)\b/.test(text)) return "style";
  return "edit";
}

function inferVisualAnchors(text: string, source: SourceHint) {
  const anchors: string[] = [];
  if (source.nearestHeading) anchors.push(`selected nearest heading: ${source.nearestHeading}`);
  if (source.selectedText) anchors.push(`selected text: ${source.selectedText}`);
  if (hasAll(text, ["healthcare", "personal", "again"])) anchors.push('heading: "Healthcare That Feels Personal Again"');
  if (hasAll(text, ["doctor", "image"])) anchors.push("doctor/provider image");
  if (/hero|top|provider|doctor/.test(text)) anchors.push("hero/provider section");
  if (/below|under|beneath/.test(text)) anchors.push("below/under visual relationship");
  if (/above/.test(text)) anchors.push("above visual relationship");
  if (/second|repeated|bottom|lower/.test(text)) anchors.push("specific repeated/lower instance");
  return unique(anchors);
}

function inferPatientLandingTarget(text: string, source: SourceHint) {
  const patientContext = /patient|doctor|provider|healthcare|visit|rx|refill|follow\s*up|private\s+review|assessment/.test(text);
  const likelyPatientRepo = source.repo === "hawk7227/patientpanel" || (!source.repo || source.repo === "hawk7227/streamsailive") && patientContext;
  if (!likelyPatientRepo) return null;
  return {
    repo: "hawk7227/patientpanel",
    branch: "master",
    path: "src/app/page.tsx",
    route: "/",
  };
}

function inferScope(text: string) : VisualEditScope {
  const oneInstance = /\b(this|that|below|under|beneath|above|second|top|bottom|lower|in this section|on this page|these|those|2|two)\b/.test(text);
  const global = /\b(global|everywhere|all pages|all instances|component itself|whole component|sitewide)\b/.test(text);
  const data = /\b(add option|remove option|rename option|reorder|list item|array|menu item)\b/.test(text);
  const style = /\b(color|font|bold|spacing|gap|width|height|align|center|white|green|purple|layout only)\b/.test(text);
  if (global) return "component_definition";
  if (data) return "data_config";
  if (style && !/\b(remove|delete|hide)\b/.test(text)) return "style_only";
  if (oneInstance) return "usage_site";
  return "usage_site";
}

function inferComponentRisk(text: string) {
  const risks: string[] = [];
  if (/visit\s*cards?|cards?/.test(text)) risks.push("src/components/home/VisitCards.tsx");
  if (/overlay|booking/.test(text)) risks.push("BookingOverlay and booking-flow logic");
  if (/payment|intake|appointment|rx|refill|follow\s*up|video|phone/.test(text)) risks.push("payment, intake, appointment, and visit-type logic");
  risks.push("unrelated page sections and shared components");
  return unique(risks);
}

export function resolveVisualEditIntent(prompt: string, source: SourceHint = {}): VisualEditIntentResolution {
  const raw = String(prompt || "").trim();
  const text = raw.toLowerCase();
  const action = inferAction(text);
  const anchors = inferVisualAnchors(text, source);
  const scope = inferScope(text);
  const patientTarget = inferPatientLandingTarget(text, source);
  const mentionsVisualEdit = /\b(remove|delete|hide|take\s+out|get\s+rid\s+of|replace|change|move|make|style|resize|align)\b/.test(text);
  const visualLanguage = /\b(card|cards|button|image|section|hero|below|under|above|top|bottom|second|doctor|provider|heading|text|icon|panel|layout)\b/.test(text);
  const matched = mentionsVisualEdit && visualLanguage;

  if (!matched) return { matched: false, reason: "No visual edit intent matched." };

  const repo = patientTarget?.repo || source.repo || "hawk7227/streamsailive";
  const branch = patientTarget?.branch || source.branch || "main";
  const path = patientTarget?.path || source.path || "src/app/page.tsx";
  const route = normalizeRoute(patientTarget?.route || source.route || "/");
  const targetIsCards = /visit\s*cards?|cards?/.test(text);
  const safePatchTarget = scope === "usage_site"
    ? `Edit the local JSX usage in ${path}; do not edit the reusable component definition unless source search proves the user asked for a global change.`
    : scope === "component_definition"
      ? "Edit the shared component only after source search proves a global component change is intended."
      : scope === "data_config"
        ? "Edit the data/config item that renders the visible option, preserving the component shell."
        : scope === "style_only"
          ? "Patch only the local styling/classes needed for the visual result."
          : "Map the visual target to its nearest source owner before patching.";

  const reason = targetIsCards && patientTarget
    ? "Resolved visual landing-page card request to the patient page usage site, while protecting reusable VisitCards and booking logic."
    : "Resolved visual edit intent to a source-aware safe patch plan before repository execution.";

  const doNotTouch = inferComponentRisk(text);
  const proofRequired = [
    "source file read",
    "component usage/source owner identified",
    "small diff generated",
    "build/typecheck attempted",
    "preview route checked",
    "target visual result verified",
    "unrelated surrounding sections verified unchanged",
    "approval required before commit or push",
  ];

  return {
    matched: true,
    reason,
    repo,
    branch,
    path,
    route,
    scope,
    visualIntent: `${action} visual target described by user`,
    visualAnchors: anchors,
    safePatchTarget,
    doNotTouch,
    proofRequired,
    enrichedPrompt: [
      raw,
      "",
      GLOBAL_BUILDER_UNDERSTANDING,
      "",
      "STRUCTURED VISUAL-EDIT RESOLUTION:",
      `visualIntent: ${action} the visible target described by the user`,
      `repo: ${repo}`,
      `branch: ${branch}`,
      `route: ${route}`,
      `sourceFile: ${path}`,
      `scope: ${scope}`,
      `visualAnchors: ${anchors.length ? anchors.join(" | ") : "derive from source route and selected context"}`,
      `safePatchTarget: ${safePatchTarget}`,
      `doNotTouch: ${doNotTouch.join(" | ")}`,
      `proofRequired: ${proofRequired.join(" | ")}`,
      "If the target is one rendered instance of a reusable component, patch the usage site, not the reusable component file.",
      "Stop at diff/approval. Do not commit. Do not push.",
    ].join("\n"),
  };
}
