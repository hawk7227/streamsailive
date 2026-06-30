import { readUniversalRuntimeEvents } from "@/lib/streams-ai/runtime-events";

type RepoListProvider = { list: (scope: any, args?: any) => Promise<any[]> };

type GuardArgs = {
  userContent: string;
  sessionId: string;
  scope: any;
  attachments?: any[];
  jobs?: RepoListProvider;
  assets?: RepoListProvider;
  providerRuns?: RepoListProvider;
};

type GuardResult = {
  handled: boolean;
  content: string;
  toolResults?: Array<{ name: string; ok: boolean; result: Record<string, unknown> }>;
};

function clean(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function pathJoin(...parts: string[]) {
  return parts.filter(Boolean).join("/").replace(/\/+/g, "/");
}

function latestWorkspace(events: Record<string, unknown>[]) {
  const reversed = [...events].reverse();
  const state = reversed.find((event) => event.filePath || event.path || event.repo || event.branch || event.route || event.previewBuildState || event.patchState) || {};
  return {
    repo: clean(state.repo || state.repository),
    branch: clean(state.branch) || "main",
    filePath: clean(state.filePath || state.path || state.sourceFile),
    route: clean(state.route) || "/",
    patchState: clean(state.patchState) || "unknown",
    previewBuildState: clean(state.previewBuildState || state.previewState) || "unknown",
    selectedText: clean(state.selectedText || state.selectedElement || state.selectedLayerId || state.selectedLayerType),
    liveUrl: clean(state.liveUrl || state.previewUrl || state.deploymentUrl || state.url),
    pushBlockedReason: clean(state.pushBlockedReason),
  };
}

async function rows(provider: RepoListProvider | undefined, scope: any, args: Record<string, unknown>) {
  try { return provider ? await provider.list(scope, args) : []; } catch { return []; }
}

async function readRawFile(repo: string, branch: string, filePath: string) {
  if (!repo || !branch || !filePath) return { ok: false, status: 0, error: "Missing repo, branch, or file path." };
  const url = `https://raw.githubusercontent.com/${repo}/${encodeURIComponent(branch)}/${filePath.split("/").map(encodeURIComponent).join("/")}`;
  try {
    const response = await fetch(url, { cache: "no-store" });
    const text = response.ok ? await response.text() : "";
    return { ok: response.ok, status: response.status, url, text, bytes: text.length };
  } catch (error) {
    return { ok: false, status: 0, url, error: error instanceof Error ? error.message : String(error) };
  }
}

function hasRealArtifact(assetRows: any[], kind: string) {
  return assetRows.find((asset) => String(asset.kind || asset.mime_type || asset.name || "").toLowerCase().includes(kind));
}

function describeAssets(assetRows: any[], attachments: any[]) {
  const normalized = [
    ...attachments.map((item) => ({ name: item?.name || item?.filename || item?.id || "attachment", kind: item?.kind || item?.mimeType || item?.mime_type || "attachment", source: "request" })),
    ...assetRows.map((item) => ({ name: item?.name || item?.filename || item?.id || "asset", kind: item?.kind || item?.mime_type || item?.mimeType || "asset", source: "asset-record" })),
  ];
  if (!normalized.length) return "No uploaded conversation files or asset attachments are recorded for this chat turn. The active repo file is not the same thing as an uploaded attachment.";
  return ["Recorded uploaded/attached files:", ...normalized.slice(0, 12).map((item, index) => `${index + 1}. ${item.name} (${item.kind}, ${item.source})`)].join("\n");
}

function exactBlocker(state: ReturnType<typeof latestWorkspace>) {
  if (state.pushBlockedReason) return state.pushBlockedReason;
  if (!/generated|ready|succeeded/i.test(state.patchState) || !/succeeded|verified|ready/i.test(state.previewBuildState)) return "Save Draft must generate a patch and real temporary preview before push.";
  return "No blocker is proven in the latest runtime state.";
}

export async function maybeAnswerGroundedRuntimeRequest({ userContent, sessionId, scope, attachments = [], jobs, assets, providerRuns }: GuardArgs): Promise<GuardResult | null> {
  const text = userContent.toLowerCase();
  const events = await readUniversalRuntimeEvents(sessionId) as Record<string, unknown>[];
  const state = latestWorkspace(events);
  const assetRows = await rows(assets, scope, { sessionId });
  const jobRows = await rows(jobs, scope, { sessionId });
  const providerRunRows = await rows(providerRuns, scope, {});

  if (/what files? (did i upload|are attached)|what file did i upload|attachments?/.test(text)) {
    return { handled: true, content: describeAssets(assetRows, attachments), toolResults: [{ name: "attachments_read", ok: true, result: { attachmentCount: attachments.length, assetCount: assetRows.length } }] };
  }

  if (/search (online|web)|latest .* cite|cite sources|links\/sources|sources you used|did you search/.test(text)) {
    const prior = events.slice().reverse().find((event) => event.phase === "web-search.completed" || event.source === "web-search");
    const content = prior
      ? `Verified web-search source record found:\n${JSON.stringify(prior, null, 2)}`
      : "Web search is not available in this Streams runtime turn, and no verified web-search source record exists in runtime events. I did not search the web for this answer, so I will not fabricate citations or source links.";
    return { handled: true, content, toolResults: [{ name: "web_search_sources_read", ok: Boolean(prior), result: { available: Boolean(prior), sourceRecord: prior || null } }] };
  }

  if (/read .*active file|pull .*active repo file|exact file path|syntax errors?|parse/.test(text)) {
    const read = await readRawFile(state.repo, state.branch, state.filePath);
    const syntaxLine = /syntax errors?|parse/.test(text)
      ? "Syntax status: unverified. The file content was read, but no parser/typecheck proof ran in this request, so I will not claim the file has zero syntax errors."
      : "";
    const content = read.ok
      ? [`Active file path: ${state.filePath}`, `Repo: ${state.repo}`, `Branch: ${state.branch}`, `Read proof: fetched raw file successfully (${read.bytes} bytes).`, syntaxLine].filter(Boolean).join("\n")
      : [`Active file path: ${state.filePath || "unknown"}`, `Repo: ${state.repo || "unknown"}`, `Branch: ${state.branch || "unknown"}`, `Read proof: failed/unavailable (${read.error || read.status}).`, "Status: unverified until file content is read successfully."].join("\n");
    return { handled: true, content, toolResults: [{ name: "active_file_read", ok: Boolean(read.ok), result: read as Record<string, unknown> }] };
  }

  if (/generate .*patch|patch .*do not push|create .*patch/.test(text)) {
    const hasGeneratedPatch = /generated|ready|succeeded/i.test(state.patchState) || jobRows.some((job) => /patch|diff/i.test(String(job.kind || job.name || "")) && /complete|succeeded|done/i.test(String(job.status || "")));
    const content = hasGeneratedPatch
      ? `Patch proof exists. File: ${state.filePath}. Patch state: ${state.patchState}. No push is authorized by this response.`
      : `Patch generation is not proven complete. File: ${state.filePath}. Current patchState: ${state.patchState}. Current previewBuildState: ${state.previewBuildState}. I will not say a patch was generated until a real diff/patch artifact or completed patch job exists.`;
    return { handled: true, content, toolResults: [{ name: "patch_state_read", ok: true, result: { filePath: state.filePath, patchState: state.patchState, jobs: jobRows.slice(0, 10) } }] };
  }

  if (/run .*build|run .*validation|validation\/build|exact result/.test(text)) {
    const finished = jobRows.find((job) => /build|validation|typecheck|lint/i.test(String(job.kind || job.name || "")) && /complete|succeeded|failed|error/i.test(String(job.status || "")));
    const content = finished
      ? `Validation/build result: ${JSON.stringify(finished, null, 2)}`
      : "No verified build/validation result is available in the runtime job records. I did not run a build in this turn, and I will not claim a pass/fail result without build proof.";
    return { handled: true, content, toolResults: [{ name: "build_validation_read", ok: Boolean(finished), result: { finished: finished || null, jobs: jobRows.slice(0, 12) } }] };
  }

  if (/create .*text file|downloadable file|create .*zip|zip .*changed|pdf report|create .*pdf|generate an image|attach .*conversation/.test(text)) {
    const kind = /zip/.test(text) ? "zip" : /pdf/.test(text) ? "pdf" : /image|photo/.test(text) ? "image" : "text";
    const artifact = hasRealArtifact(assetRows, kind);
    const content = artifact
      ? `Verified ${kind} artifact exists: ${JSON.stringify(artifact, null, 2)}`
      : `No verified ${kind} artifact exists in the asset records for this conversation. I will not show a fake download link or claim the ${kind} was created until a real stored asset is returned.`;
    return { handled: true, content, toolResults: [{ name: "artifact_asset_read", ok: Boolean(artifact), result: { requestedKind: kind, artifact: artifact || null, assetCount: assetRows.length } }] };
  }

  if (/what file changed|changed files?|what changed/.test(text)) {
    const patchJobs = jobRows.filter((job) => /patch|diff|file|repo|code/i.test(String(job.kind || job.name || "")));
    const content = patchJobs.length
      ? `Changed-file proof records found. Active file: ${state.filePath}. Jobs:\n${JSON.stringify(patchJobs.slice(0, 8), null, 2)}`
      : `No verified changed-file diff/patch record exists. Active file from workspace state: ${state.filePath || "unknown"}. Patch state: ${state.patchState}.`;
    return { handled: true, content, toolResults: [{ name: "changed_files_read", ok: patchJobs.length > 0, result: { activeFile: state.filePath, patchJobs } }] };
  }

  if (/preview url|deployment|deploy url|live url|what .*url exists/.test(text)) {
    const previewJob = jobRows.find((job) => /preview|deploy|vercel|browser/i.test(String(job.kind || job.name || "")));
    const content = state.liveUrl || previewJob
      ? [`Live/preview URL from workspace: ${state.liveUrl || "none recorded"}`, previewJob ? `Preview/deploy job: ${JSON.stringify(previewJob, null, 2)}` : "No preview/deploy job record found."].join("\n")
      : "No verified preview/deployment URL exists in the current runtime state. Preview remains unverified until a real browser/deploy proof record is present.";
    return { handled: true, content, toolResults: [{ name: "preview_deploy_read", ok: Boolean(state.liveUrl || previewJob), result: { liveUrl: state.liveUrl, previewJob: previewJob || null } }] };
  }

  if (/what did i select|selected .*card|selected visual|selected element/.test(text)) {
    const content = [`Selected visual target: ${state.selectedText || "unverified"}`, `Repo: ${state.repo || "unknown"}`, `File: ${state.filePath || "unknown"}`, `Route: ${state.route}`, "Source/component range: unverified unless the visual selection event includes DOM path/source range metadata."].join("\n");
    return { handled: true, content, toolResults: [{ name: "visual_selection_read", ok: Boolean(state.selectedText), result: { selectedText: state.selectedText, filePath: state.filePath, route: state.route } }] };
  }

  if (/why .*push blocked|what .*blocking push|exact blocker|push blocked/.test(text)) {
    const content = [`File: ${state.filePath || "unknown"}`, `Blocker: ${exactBlocker(state)}`, `patchState: ${state.patchState}`, `previewBuildState: ${state.previewBuildState}`, "Next action: Save Draft, then generate Browser Review. Status remains unverified until patch and preview proof are recorded."].join("\n");
    return { handled: true, content, toolResults: [{ name: "push_blocker_read", ok: true, result: { filePath: state.filePath, blocker: exactBlocker(state), patchState: state.patchState, previewBuildState: state.previewBuildState } }] };
  }

  return null;
}
