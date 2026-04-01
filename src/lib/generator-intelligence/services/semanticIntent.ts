import type { SemanticIntent, SemanticQaCheck } from "../types";

const uniq = (values: string[]) => [...new Set(values.filter(Boolean))];

export function analyzeSemanticIntent(prompt: string): SemanticIntent {
  const lower = prompt.toLowerCase();
  const requestedSubjects: string[] = [];
  const requestedEnvironment: string[] = [];
  const requestedObjects: string[] = [];
  let requestedGender: SemanticIntent["requestedGender"] = "unknown";
  let requestedDevice: SemanticIntent["requestedDevice"] = "unknown";

  if (/\bman\b/.test(lower)) { requestedGender = "man"; requestedSubjects.push("man"); }
  else if (/\bwoman\b/.test(lower)) { requestedGender = "woman"; requestedSubjects.push("woman"); }
  else if (/\bboy\b/.test(lower)) { requestedGender = "boy"; requestedSubjects.push("boy"); }
  else if (/\bgirl\b/.test(lower)) { requestedGender = "girl"; requestedSubjects.push("girl"); }
  else if (/\bperson\b|\bpeople\b|\bhuman\b/.test(lower)) { requestedGender = "person"; requestedSubjects.push("person"); }

  if (/\bcell phone\b|\bcell\b/.test(lower)) { requestedDevice = "cell phone"; requestedObjects.push("cell phone"); }
  else if (/\bsmartphone\b/.test(lower)) { requestedDevice = "smartphone"; requestedObjects.push("smartphone"); }
  else if (/\bphone\b|\bmobile\b/.test(lower)) { requestedDevice = "phone"; requestedObjects.push("phone"); }

  if (/\bliving room\b/.test(lower)) requestedEnvironment.push("living room");
  if (/\bcouch\b|\bsofa\b/.test(lower)) requestedEnvironment.push("couch");
  if (/\boutside\b|\byard\b|\bpark\b/.test(lower)) requestedEnvironment.push("outdoor");
  if (/\bdesk\b|\boffice\b/.test(lower)) requestedEnvironment.push("desk");

  return {
    requestedSubjects: uniq(requestedSubjects),
    requestedEnvironment: uniq(requestedEnvironment),
    requestedObjects: uniq(requestedObjects),
    requestedGender,
    requestedDevice,
  };
}

export function buildSemanticQaChecks(intent: SemanticIntent): SemanticQaCheck[] {
  const checks: SemanticQaCheck[] = [];
  if (intent.requestedGender !== "unknown") checks.push({ label: "subject match", expected: intent.requestedGender, rejectOnMismatch: true });
  if (intent.requestedDevice !== "unknown") checks.push({ label: "device match", expected: intent.requestedDevice, rejectOnMismatch: true });
  for (const env of intent.requestedEnvironment) checks.push({ label: "environment match", expected: env, rejectOnMismatch: false });
  return checks;
}
