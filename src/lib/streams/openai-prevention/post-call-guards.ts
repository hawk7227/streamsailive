export type GuardResult={passed:boolean;failures:string[]};
export function runPostCallGuards(output:string){
 const failures:string[]=[]; if(/console\.log\(/.test(output)) failures.push('console.log-only-action');
 if(/\bproven\b/i.test(output)&&!/proof/i.test(output)) failures.push('proven-without-proof');
 return {passed:failures.length===0,failures};
}
