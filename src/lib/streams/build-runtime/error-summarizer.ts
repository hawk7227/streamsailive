export function summarizeCheckFailure(output: string) {
  if (/scope-guard/i.test(output)) return { type: "scope_guard_failure", repairAllowed: true };
  if (/generated-file/i.test(output)) return { type: "generated_file_failure", repairAllowed: true };
  if (/TS\d+|typescript/i.test(output)) return { type: "type_error", repairAllowed: true };
  return { type: "unknown", repairAllowed: false };
}
