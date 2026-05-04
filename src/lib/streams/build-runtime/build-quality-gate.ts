export type BuildGateInput = {userRequest:string;assistantOutput:string;checksRun?:string[];classification?:string};
export type BuildGateResult = {passed:boolean;failures:string[];requiredFixes:string[];classificationOverride?:"Blocked"};
const NARROW=/\bonly\b.*\b(layout|interface|planning|inspect|shell|types?)\b/i;
export function runBuildQualityGate(input: BuildGateInput): BuildGateResult {
  const failures:string[]=[];
  const out=input.assistantOutput.toLowerCase();
  const fullRequired=!NARROW.test(input.userRequest);
  if (fullRequired && /(layout-only|shell-only|inventory-only|scaffold-only)/.test(out)) failures.push('under_scoped_build');
  if (/console\.log\(/.test(input.assistantOutput)) failures.push('console_log_only_action');
  if (/route-backed/.test(out) && !/route call|fetch\(|axios|client\.responses/.test(input.assistantOutput)) failures.push('route_claim_without_evidence');
  if (/persist/i.test(input.assistantOutput) && !/proof|artifact|session_id/i.test(input.assistantOutput)) failures.push('persistence_claim_without_proof');
  if (/proven/i.test(input.assistantOutput) && !/runtime proof|browser proof|output proof|persistence proof/i.test(input.assistantOutput)) failures.push('proven_without_required_proof');
  if (!input.checksRun?.length) failures.push('missing_checks');
  if (!/blocked|implemented but unproven|proven|rejected/i.test(input.classification ?? input.assistantOutput)) failures.push('missing_classification');
  return {passed: failures.length===0, failures, requiredFixes: failures.map(f=>`fix:${f}`), classificationOverride: failures.length? 'Blocked': undefined};
}
