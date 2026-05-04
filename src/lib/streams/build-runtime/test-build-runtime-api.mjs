const base = process.cwd();

const createMod = await import(`${base}/.next/server/app/api/streams/build/tasks/route.js`);
const runMod = await import(`${base}/.next/server/app/api/streams/build/tasks/[id]/run/route.js`);
const checksMod = await import(`${base}/.next/server/app/api/streams/build/tasks/[id]/checks/route.js`);
const proofMod = await import(`${base}/.next/server/app/api/streams/build/tasks/[id]/proof/route.js`);

const createReq = new Request('http://local/api/streams/build/tasks', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({prompt:'audit only',activeSlice:'STREAMS General Builder Runtime Foundation',projectProfile:'streams_self_build'})});
const createRes = await createMod.default.routeModule.userland.POST(createReq);
const created = await createRes.json();
if (!created?.task?.id) throw new Error('task create failed');
const id = created.task.id;

const runReq = new Request(`http://local/api/streams/build/tasks/${id}/run`, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({checks:['git_diff_check']})});
const runRes = await runMod.default.routeModule.userland.POST(runReq,{params:Promise.resolve({id})});
const runData = await runRes.json();

const checksRes = await checksMod.default.routeModule.userland.GET(new Request(`http://local/api/streams/build/tasks/${id}/checks`),{params:Promise.resolve({id})});
const checksData = await checksRes.json();
const proofRes = await proofMod.default.routeModule.userland.GET(new Request(`http://local/api/streams/build/tasks/${id}/proof`),{params:Promise.resolve({id})});
const proofData = await proofRes.json();

const summary = {
  taskCreated: !!id,
  runExecuted: Array.isArray(runData.checks),
  checksAttached: (checksData.checks?.length ?? 0) > 0,
  proofHasChecks: (proofData.proof?.commandsRun?.length ?? 0) > 0,
  gateIncluded: !!runData.gate,
  deterministicRepairsIncluded: Array.isArray(runData.repairs),
  blockedCapabilitiesListed: Array.isArray(runData.proof?.blockedItems),
};

if (Object.values(summary).includes(false)) {
  console.error(JSON.stringify({summary, created, runData, checksData, proofData}, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({summary, taskId:id, gatePassed:runData.gate?.passed, checks:checksData.checks?.length, blockedItems:runData.proof?.blockedItems}, null, 2));
