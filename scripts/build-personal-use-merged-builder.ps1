# Streams Builder personal-use merged chat build script
# Run from repo root: powershell -ExecutionPolicy Bypass -File scripts/build-personal-use-merged-builder.ps1
# This script writes complete files for the minimum personal-use merge adapters, then runs pnpm build.

$ErrorActionPreference = "Stop"

function Write-RepoFile {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Content
  )

  $directory = Split-Path -Parent $Path
  if ($directory -and -not (Test-Path $directory)) {
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
  }

  Set-Content -Path $Path -Value $Content -Encoding UTF8 -NoNewline
  Write-Host "WROTE $Path"
}

if (-not (Test-Path "package.json")) {
  throw "Run this script from the streamsailive repo root. package.json was not found."
}

$mergeTypes = @'
export type PersonalUseWorkspaceId =
  | "primary-builder"
  | "visual-editing"
  | "component-mapping"
  | "approval-center"
  | "browser-verification"
  | "repository-truth"
  | "projects-dashboard"
  | "truth-panel";

export type PersonalUsePreviewTarget = "builder-preview" | "chat-preview";

export type PersonalUseWorkstationContext = {
  workspaceId: PersonalUseWorkspaceId;
  workspaceLabel: string;
  previewTarget: PersonalUsePreviewTarget;
  route: string;
  component: string;
  file: string;
  projectId: string;
  conversationId?: string;
};

export type PersonalUseBridgeIntent =
  | "capability-plan"
  | "admingeneration-job"
  | "open-existing-route"
  | "status-only";

export type PersonalUseBridgeRequest = {
  intent: PersonalUseBridgeIntent;
  request: string;
  context: PersonalUseWorkstationContext;
  generation?: {
    kind?: string;
    provider?: string;
    prompt?: string;
    aspectRatio?: string;
    duration?: number;
    sourceImageUrl?: string;
    voiceId?: string;
  };
};

export type PersonalUseBridgeResult = {
  ok: boolean;
  intent: PersonalUseBridgeIntent;
  status: "planned" | "routed" | "blocked" | "failed";
  message: string;
  context: PersonalUseWorkstationContext;
  plan?: unknown;
  route?: string;
  artifact?: {
    kind: "image" | "video" | "audio" | "document" | "status";
    url?: string;
    id?: string;
    label: string;
  };
  blocker?: string;
  proof: string[];
};

export const PERSONAL_USE_ALLOWED_MISSING_PIECES = [
  "Center chat iframe embed",
  "Active workstation context",
  "Preview target flag",
  "Chat-to-builder request bridge",
  "Builder-to-existing-route adapter",
  "Artifact/status return object",
] as const;

export const PERSONAL_USE_WORKSPACES: Array<{
  id: PersonalUseWorkspaceId;
  number: string;
  label: string;
  route: string;
  component: string;
  file: string;
}> = [
  {
    id: "primary-builder",
    number: "1",
    label: "Primary Builder",
    route: "/streams-ai/streams-builder",
    component: "WorkspaceGrid",
    file: "src/components/streams-builder/WorkspaceGrid.tsx",
  },
  {
    id: "visual-editing",
    number: "2",
    label: "Visual Editing",
    route: "/streams-builder",
    component: "WorkspaceGrid",
    file: "src/components/streams-builder/WorkspaceGrid.tsx",
  },
  {
    id: "component-mapping",
    number: "3",
    label: "Component Mapping",
    route: "/streams-ai/streams-builder",
    component: "WorkspaceModulePanel",
    file: "src/components/streams-builder/workspace-modules/WorkspaceModulePanel.tsx",
  },
  {
    id: "approval-center",
    number: "4",
    label: "Approval Center",
    route: "/streams-builder",
    component: "BeforeAfterReviewPanel",
    file: "src/components/streams-builder/BeforeAfterReviewPanel.tsx",
  },
  {
    id: "browser-verification",
    number: "5",
    label: "Browser Verification",
    route: "/api/streams-builder/browser-verification",
    component: "BrowserVerification",
    file: "src/app/api/streams-builder/browser-verification/route.ts",
  },
  {
    id: "repository-truth",
    number: "6",
    label: "Repository Truth",
    route: "/api/streams-builder/source-truth",
    component: "SourceTruth",
    file: "src/app/api/streams-builder/source-truth/route.ts",
  },
  {
    id: "projects-dashboard",
    number: "7",
    label: "Projects Dashboard",
    route: "/streams-ai/streams-builder",
    component: "ProjectsDashboard",
    file: "src/components/streams-builder/WorkspaceGrid.tsx",
  },
  {
    id: "truth-panel",
    number: "T",
    label: "Truth Panel",
    route: "/api/streams-builder/env-readiness",
    component: "EnvReadinessMonitor",
    file: "src/components/streams-builder/EnvReadinessMonitor.tsx",
  },
];
'@

$bridgeRoute = @'
import { NextRequest, NextResponse } from "next/server";
import { executeInternalCapabilityEngine } from "@/lib/assistant-core/internalCapabilityExecutor";
import type { PersonalUseBridgeRequest, PersonalUseBridgeResult } from "@/lib/streams-builder/personal-use-merge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, payload: PersonalUseBridgeResult) {
  return NextResponse.json(payload, { status });
}

function makeProof(input: PersonalUseBridgeRequest, extra: string[] = []) {
  return [
    "Standalone /streams-ai remains untouched.",
    "Standalone /admingeneration remains untouched.",
    `Active workstation context received: ${input.context.workspaceLabel}.`,
    `Preview target received: ${input.context.previewTarget}.`,
    ...extra,
  ];
}

async function forwardToAdmingeneration(req: NextRequest, input: PersonalUseBridgeRequest) {
  const adminKey = process.env.ADMIN_GENERATION_KEY;
  if (!adminKey) {
    return json(200, {
      ok: false,
      intent: input.intent,
      status: "blocked",
      message: "Admingeneration route exists, but ADMIN_GENERATION_KEY is not available to the bridge.",
      context: input.context,
      blocker: "ADMIN_GENERATION_KEY missing",
      proof: makeProof(input, ["No new generation system was created.", "Existing /api/admingeneration/jobs route was selected."]),
    });
  }

  const url = new URL("/api/admingeneration/jobs", req.url);
  const generation = input.generation ?? {};
  const payload = {
    kind: generation.kind ?? "image-to-video",
    provider: generation.provider ?? "auto",
    prompt: generation.prompt ?? input.request,
    aspectRatio: generation.aspectRatio ?? "9:16",
    duration: generation.duration ?? 5,
    sourceImageUrl: generation.sourceImageUrl,
    voiceId: generation.voiceId,
    projectId: input.context.projectId,
    metadata: {
      workspaceId: input.context.workspaceId,
      workspaceLabel: input.context.workspaceLabel,
      conversationId: input.context.conversationId,
      previewTarget: input.context.previewTarget,
      sourceRoute: input.context.route,
      sourceComponent: input.context.component,
      sourceFile: input.context.file,
      request: input.request,
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-admin-generation-key": adminKey,
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);

  return json(response.ok ? 200 : 502, {
    ok: response.ok,
    intent: input.intent,
    status: response.ok ? "routed" : "failed",
    message: response.ok
      ? "Request routed to existing /api/admingeneration/jobs."
      : "Existing /api/admingeneration/jobs returned a failed response.",
    context: input.context,
    route: "/api/admingeneration/jobs",
    artifact: {
      kind: "status",
      id: typeof data?.jobId === "string" ? data.jobId : typeof data?.id === "string" ? data.id : undefined,
      url: typeof data?.url === "string" ? data.url : typeof data?.artifactUrl === "string" ? data.artifactUrl : undefined,
      label: "Admingeneration job status",
    },
    proof: makeProof(input, [
      "Existing admingeneration job route was called by the Builder bridge.",
      "No new provider router was created.",
      "Status/artifact envelope returned to active workstation.",
    ]),
  });
}

export async function POST(req: NextRequest) {
  try {
    const input = (await req.json()) as PersonalUseBridgeRequest;

    if (!input?.request || !input?.context?.workspaceId || !input?.context?.previewTarget) {
      return NextResponse.json(
        {
          ok: false,
          error: "request, context.workspaceId, and context.previewTarget are required",
        },
        { status: 400 },
      );
    }

    if (input.intent === "admingeneration-job") {
      return forwardToAdmingeneration(req, input);
    }

    if (input.intent === "open-existing-route") {
      return json(200, {
        ok: true,
        intent: input.intent,
        status: "routed",
        message: `Open existing route ${input.context.route} for ${input.context.workspaceLabel}.`,
        context: input.context,
        route: input.context.route,
        artifact: {
          kind: "status",
          label: "Existing route target",
          url: input.context.route,
        },
        proof: makeProof(input, ["Existing route selected. No new workflow was created."]),
      });
    }

    const plan = executeInternalCapabilityEngine({
      request: input.request,
      intent: input.intent,
      context: input.context,
    });

    return json(200, {
      ok: true,
      intent: input.intent,
      status: plan.ready ? "planned" : "blocked",
      message: plan.ready
        ? `Capability plan selected ${plan.engineLabel}.`
        : `Capability plan selected ${plan.engineLabel}, but blockers were returned.`,
      context: input.context,
      plan,
      artifact: {
        kind: "status",
        label: "Capability engine plan",
        id: plan.engineId,
      },
      blocker: plan.blockers.length ? plan.blockers.join(", ") : undefined,
      proof: makeProof(input, [
        "Existing capability engine route used as planning layer.",
        "No new chat system was created.",
      ]),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "personal-use bridge failed",
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/streams-builder/personal-use-bridge",
    purpose: "Minimum personal-use chat-to-builder bridge. It routes to existing systems only.",
    allowedMissingPieces: [
      "Center chat iframe embed",
      "Active workstation context",
      "Preview target flag",
      "Chat-to-builder request bridge",
      "Builder-to-existing-route adapter",
      "Artifact/status return object",
    ],
  });
}
'@

$centerChat = @'
"use client";

import { useMemo, useState } from "react";
import type {
  PersonalUseBridgeIntent,
  PersonalUseBridgeResult,
  PersonalUsePreviewTarget,
  PersonalUseWorkstationContext,
} from "@/lib/streams-builder/personal-use-merge";

type BuilderCenterChatProps = {
  context: PersonalUseWorkstationContext;
  onResult?: (result: PersonalUseBridgeResult) => void;
};

const SAMPLE_REQUESTS: Array<{ label: string; intent: PersonalUseBridgeIntent; request: string }> = [
  {
    label: "Plan",
    intent: "capability-plan",
    request: "Use the active workstation and create the smallest plan for this task without rebuilding existing systems.",
  },
  {
    label: "Image → Video",
    intent: "admingeneration-job",
    request: "Use the active workstation to turn this uploaded image into a video.",
  },
  {
    label: "Open Route",
    intent: "open-existing-route",
    request: "Open the existing route for the active workstation without rebuilding it.",
  },
  {
    label: "Status",
    intent: "status-only",
    request: "Show the reachable backend/workflow status for the active workstation.",
  },
];

export default function BuilderCenterChat({ context, onResult }: BuilderCenterChatProps) {
  const [request, setRequest] = useState("Use this workstation to build through existing backend tools and return status here.");
  const [previewTarget, setPreviewTarget] = useState<PersonalUsePreviewTarget>(context.previewTarget);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<PersonalUseBridgeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const iframeSrc = useMemo(() => {
    const params = new URLSearchParams({
      builderMode: "1",
      workspaceId: context.workspaceId,
      workspaceLabel: context.workspaceLabel,
      previewTarget,
      projectId: context.projectId,
    });
    return `/streams-ai?${params.toString()}`;
  }, [context.workspaceId, context.workspaceLabel, context.projectId, previewTarget]);

  async function submit(intent: PersonalUseBridgeIntent, nextRequest = request) {
    setPending(true);
    setError(null);

    const payload = {
      intent,
      request: nextRequest,
      context: {
        ...context,
        previewTarget,
      },
      generation:
        intent === "admingeneration-job"
          ? {
              kind: "image-to-video",
              provider: "auto",
              prompt: nextRequest,
              aspectRatio: "9:16",
              duration: 5,
            }
          : undefined,
    };

    try {
      const response = await fetch("/api/streams-builder/personal-use-bridge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as PersonalUseBridgeResult;
      setResult(data);
      onResult?.(data);
      if (!response.ok || !data.ok) {
        setError(data.blocker ?? data.message ?? "Bridge request did not complete.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bridge request failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="builderCenterChat" aria-label="Merged center chat bridge">
      <header className="bridgeHeader">
        <div>
          <b>MERGED CENTER CHAT</b>
          <span>{context.workspaceLabel} owns this request</span>
        </div>
        <div className="activePill">ACTIVE</div>
      </header>

      <div className="phoneShell" aria-label="Streams AI mobile chat frame">
        <iframe title={`Streams AI chat for ${context.workspaceLabel}`} src={iframeSrc} />
      </div>

      <div className="targetRow" role="group" aria-label="Preview target">
        <button
          type="button"
          className={previewTarget === "builder-preview" ? "selected" : ""}
          onClick={() => setPreviewTarget("builder-preview")}
        >
          Builder Preview
        </button>
        <button
          type="button"
          className={previewTarget === "chat-preview" ? "selected" : ""}
          onClick={() => setPreviewTarget("chat-preview")}
        >
          Chat Preview
        </button>
      </div>

      <label className="requestBox">
        <span>Bridge request</span>
        <textarea value={request} onChange={(event) => setRequest(event.target.value)} />
      </label>

      <div className="actionRow">
        {SAMPLE_REQUESTS.map((item) => (
          <button
            key={item.label}
            type="button"
            disabled={pending}
            onClick={() => {
              setRequest(item.request);
              void submit(item.intent, item.request);
            }}
          >
            {pending ? "Working..." : item.label}
          </button>
        ))}
      </div>

      <section className="statusPanel" aria-live="polite">
        <b>Status / artifact return</b>
        {error ? <p className="error">{error}</p> : null}
        {result ? (
          <div className="resultGrid">
            <p><span>State</span>{result.status}</p>
            <p><span>Intent</span>{result.intent}</p>
            <p><span>Route</span>{result.route ?? "capability engine"}</p>
            <p><span>Artifact</span>{result.artifact?.label ?? "status object"}</p>
            <p className="wide"><span>Message</span>{result.message}</p>
            <p className="wide"><span>Proof</span>{result.proof.join(" • ")}</p>
          </div>
        ) : (
          <p className="empty">No bridge request sent yet.</p>
        )}
      </section>

      <style jsx>{`
        .builderCenterChat {
          display: grid;
          gap: 10px;
          min-width: 0;
          color: #fff;
        }

        .bridgeHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          border: 1px solid rgba(34, 197, 94, 0.22);
          border-radius: 14px;
          background: rgba(6, 78, 59, 0.14);
          padding: 10px;
        }

        .bridgeHeader b,
        .statusPanel b,
        .requestBox span {
          display: block;
          color: #6ee7b7;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .bridgeHeader span {
          display: block;
          margin-top: 3px;
          color: #cbd5e1;
          font-size: 11px;
        }

        .activePill {
          border-radius: 999px;
          background: #16a34a;
          padding: 6px 9px;
          font-size: 10px;
          font-weight: 900;
        }

        .phoneShell {
          width: min(100%, 430px);
          height: min(62dvh, 720px);
          min-height: 520px;
          justify-self: center;
          overflow: hidden;
          border: 1px solid rgba(148, 163, 184, 0.28);
          border-radius: 34px;
          background: #020617;
          box-shadow: 0 28px 90px rgba(0, 0, 0, 0.45);
        }

        iframe {
          display: block;
          width: 100%;
          height: 100%;
          border: 0;
          background: #020617;
        }

        .targetRow,
        .actionRow {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }

        .actionRow {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        button {
          border: 1px solid rgba(148, 163, 184, 0.22);
          border-radius: 12px;
          background: #0f172a;
          color: #e2e8f0;
          padding: 9px 8px;
          font-size: 11px;
          font-weight: 900;
          cursor: pointer;
        }

        button.selected,
        button:hover:not(:disabled) {
          border-color: rgba(167, 139, 250, 0.62);
          background: #6d28d9;
          color: #fff;
        }

        button:disabled {
          cursor: wait;
          opacity: 0.62;
        }

        .requestBox {
          display: grid;
          gap: 7px;
        }

        textarea {
          width: 100%;
          min-height: 78px;
          resize: vertical;
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 14px;
          background: rgba(2, 6, 23, 0.82);
          color: #fff;
          padding: 10px;
          font-size: 12px;
          line-height: 1.45;
          outline: none;
        }

        textarea:focus {
          border-color: rgba(167, 139, 250, 0.72);
        }

        .statusPanel {
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 14px;
          background: rgba(15, 23, 42, 0.78);
          padding: 10px;
          min-width: 0;
        }

        .empty,
        .error {
          margin: 8px 0 0;
          color: #cbd5e1;
          font-size: 11px;
        }

        .error {
          color: #fecaca;
        }

        .resultGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin-top: 10px;
        }

        .resultGrid p {
          min-width: 0;
          margin: 0;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 10px;
          background: rgba(2, 6, 23, 0.62);
          padding: 8px;
          color: #e2e8f0;
          font-size: 11px;
          overflow-wrap: anywhere;
        }

        .resultGrid p.wide {
          grid-column: 1 / -1;
        }

        .resultGrid span {
          display: block;
          margin-bottom: 3px;
          color: #93c5fd;
          font-size: 9px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        @media (max-width: 980px) {
          .phoneShell {
            min-height: 460px;
            height: 58dvh;
          }

          .actionRow {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>
    </section>
  );
}
'@

$modulePanel = @'
"use client";

import EnvReadinessMonitor from "../EnvReadinessMonitor";
import type { PersonalUseBridgeResult, PersonalUseWorkstationContext } from "@/lib/streams-builder/personal-use-merge";

export type WorkspaceModuleName =
  | "Primary Builder"
  | "Visual Editing"
  | "Component Mapping"
  | "Approval Center"
  | "Browser Verification"
  | "Repository Truth"
  | "Projects Dashboard"
  | "Truth Panel";

export default function WorkspaceModulePanel({
  moduleName,
  context,
  bridgeResult,
}: {
  moduleName: WorkspaceModuleName;
  context: PersonalUseWorkstationContext;
  bridgeResult: PersonalUseBridgeResult | null;
}) {
  return (
    <section className="streamsModulePanel">
      <header>
        <div>
          <b>{moduleName}</b>
          <span>Proof-aware module ready.</span>
        </div>
        <em>{context.previewTarget}</em>
      </header>

      <p>This module receives the center chat context and returns status/output without replacing standalone systems.</p>

      <div className="contextGrid">
        <p><strong>Route</strong>{context.route}</p>
        <p><strong>Component</strong>{context.component}</p>
        <p><strong>File</strong>{context.file}</p>
        <p><strong>Project</strong>{context.projectId}</p>
      </div>

      {bridgeResult ? (
        <div className="bridgeReturn">
          <b>Latest bridge return</b>
          <p><strong>Status</strong>{bridgeResult.status}</p>
          <p><strong>Message</strong>{bridgeResult.message}</p>
          <p><strong>Artifact</strong>{bridgeResult.artifact?.label ?? "status object"}</p>
        </div>
      ) : null}

      <div className="monitorSlot">
        <EnvReadinessMonitor />
      </div>

      <style jsx>{`
        .streamsModulePanel {
          margin-top: 8px;
          border: 1px solid rgba(16, 185, 129, 0.18);
          border-radius: 14px;
          background: rgba(6, 78, 59, 0.08);
          color: #fff;
          padding: 10px;
          font-size: 10px;
        }

        header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        b,
        strong {
          color: #6ee7b7;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        header span,
        p {
          color: #cbd5e1;
          margin: 4px 0 0;
        }

        em {
          border-radius: 999px;
          background: rgba(124, 58, 237, 0.32);
          color: #ddd6fe;
          padding: 5px 8px;
          font-style: normal;
          font-weight: 900;
        }

        .contextGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
          margin-top: 10px;
        }

        .contextGrid p,
        .bridgeReturn p {
          min-width: 0;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 10px;
          background: rgba(2, 6, 23, 0.45);
          padding: 8px;
          overflow-wrap: anywhere;
        }

        strong {
          display: block;
          margin-bottom: 4px;
        }

        .bridgeReturn {
          margin-top: 10px;
          border: 1px solid rgba(59, 130, 246, 0.24);
          border-radius: 12px;
          background: rgba(30, 64, 175, 0.1);
          padding: 8px;
        }

        .monitorSlot {
          margin-top: 10px;
        }

        @media (max-width: 980px) {
          .contextGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>
    </section>
  );
}
'@

$workspaceGrid = @'
"use client";

import { useMemo, useState } from "react";
import BuilderCenterChat from "./BuilderCenterChat";
import GitHubRepositoryPicker from "./GitHubRepositoryPicker";
import WorkspaceModulePanel, { type WorkspaceModuleName } from "./workspace-modules/WorkspaceModulePanel";
import {
  PERSONAL_USE_WORKSPACES,
  type PersonalUseBridgeResult,
  type PersonalUsePreviewTarget,
  type PersonalUseWorkspaceId,
  type PersonalUseWorkstationContext,
} from "@/lib/streams-builder/personal-use-merge";

export default function WorkspaceGrid() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<PersonalUseWorkspaceId>("primary-builder");
  const [previewTarget, setPreviewTarget] = useState<PersonalUsePreviewTarget>("builder-preview");
  const [bridgeResult, setBridgeResult] = useState<PersonalUseBridgeResult | null>(null);

  const activeWorkspace = useMemo(
    () => PERSONAL_USE_WORKSPACES.find((workspace) => workspace.id === activeWorkspaceId) ?? PERSONAL_USE_WORKSPACES[0],
    [activeWorkspaceId],
  );

  const context: PersonalUseWorkstationContext = useMemo(
    () => ({
      workspaceId: activeWorkspace.id,
      workspaceLabel: activeWorkspace.label,
      previewTarget,
      route: activeWorkspace.route,
      component: activeWorkspace.component,
      file: activeWorkspace.file,
      projectId: "personal-use-builder",
    }),
    [activeWorkspace, previewTarget],
  );

  const shellClass = sidebarOpen
    ? "streamsBuilderShell sidebarOpen"
    : "streamsBuilderShell sidebarClosed";

  return (
    <main className={shellClass}>
      <aside className="leftRail">
        <button
          className="toggleButton"
          type="button"
          onClick={() => setSidebarOpen((value) => !value)}
        >
          {sidebarOpen ? "Close" : "Open"}
        </button>

        <nav aria-label="Builder workstations">
          {PERSONAL_USE_WORKSPACES.map((workspace) => (
            <button
              type="button"
              key={workspace.id}
              className={workspace.id === activeWorkspaceId ? "active" : ""}
              onClick={() => {
                setActiveWorkspaceId(workspace.id);
                setBridgeResult(null);
              }}
              title={workspace.label}
            >
              <span>{workspace.number}</span>
              {sidebarOpen ? <b>{workspace.label}</b> : null}
            </button>
          ))}
        </nav>
      </aside>

      <section className="centerWorkspace">
        <div className="topStrip">
          <GitHubRepositoryPicker />
          <div className="activeContext">
            <span>Active workstation</span>
            <b>{activeWorkspace.label}</b>
          </div>
        </div>

        <div className="mergeLayout">
          <section className="workstationPane">
            <div className="paneHeader">
              <b>{activeWorkspace.label}</b>
              <span>{activeWorkspace.route}</span>
            </div>
            <div className="previewTargetSwitch">
              <button
                type="button"
                className={previewTarget === "builder-preview" ? "selected" : ""}
                onClick={() => setPreviewTarget("builder-preview")}
              >
                Builder Preview
              </button>
              <button
                type="button"
                className={previewTarget === "chat-preview" ? "selected" : ""}
                onClick={() => setPreviewTarget("chat-preview")}
              >
                Chat Preview
              </button>
            </div>
            <WorkspaceModulePanel
              moduleName={activeWorkspace.label as WorkspaceModuleName}
              context={context}
              bridgeResult={bridgeResult}
            />
          </section>

          <BuilderCenterChat context={context} onResult={setBridgeResult} />
        </div>
      </section>

      <aside className="settingsRail">
        <h2>Personal Merge</h2>

        <p>
          <b>Mode</b>
          <span>Minimum backend reachability only</span>
        </p>

        <p>
          <b>Active</b>
          <span>{activeWorkspace.label}</span>
        </p>

        <p>
          <b>Preview Target</b>
          <span>{previewTarget}</span>
        </p>

        <p>
          <b>Chat Rule</b>
          <span>Center chat sends active workstation context; standalone /streams-ai remains independent.</span>
        </p>

        <p>
          <b>Bridge Rule</b>
          <span>Use existing routes first. Add only the six minimum adapters.</span>
        </p>

        <p>
          <b>Status</b>
          <span>{bridgeResult ? `${bridgeResult.status}: ${bridgeResult.message}` : "Waiting for bridge request."}</span>
        </p>
      </aside>

      <style jsx>{`
        .streamsBuilderShell {
          width: 100vw;
          height: 100dvh;
          max-width: 100vw;
          max-height: 100dvh;
          min-height: 0;
          display: grid;
          grid-template-columns: 56px minmax(0, 1fr) 220px;
          gap: 6px;
          overflow: hidden;
          background: #020713;
          color: #fff;
          padding: 6px;
          box-sizing: border-box;
        }

        .streamsBuilderShell.sidebarOpen {
          grid-template-columns: 210px minmax(0, 1fr) 220px;
        }

        .leftRail,
        .centerWorkspace,
        .settingsRail {
          min-width: 0;
          min-height: 0;
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 14px;
          background: rgba(15, 23, 42, 0.78);
          overflow: hidden;
          box-sizing: border-box;
        }

        .leftRail {
          padding: 6px;
        }

        .toggleButton {
          width: 100%;
          height: 34px;
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 10px;
          background: #7c3aed;
          color: #fff;
          font-size: 10px;
          font-weight: 900;
          cursor: pointer;
        }

        nav {
          display: grid;
          gap: 8px;
          margin-top: 10px;
        }

        nav button {
          min-width: 0;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 12px;
          background: #020617;
          color: #fff;
          cursor: pointer;
        }

        nav button.active {
          background: linear-gradient(135deg, #7c3aed, #4c1d95);
          border-color: rgba(167, 139, 250, 0.55);
          box-shadow: 0 0 0 1px rgba(167, 139, 250, 0.22);
        }

        nav span {
          width: 28px;
          height: 28px;
          display: grid;
          place-items: center;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.08);
          font-size: 13px;
          font-weight: 900;
          flex: 0 0 auto;
        }

        nav b {
          flex: 1;
          min-width: 0;
          text-align: left;
          font-size: 11px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .centerWorkspace {
          padding: 6px;
          overflow: hidden;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr);
          gap: 6px;
        }

        .topStrip {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 240px;
          gap: 6px;
          min-width: 0;
        }

        .activeContext {
          border: 1px solid rgba(34, 197, 94, 0.22);
          border-radius: 12px;
          background: rgba(6, 78, 59, 0.12);
          padding: 8px 10px;
        }

        .activeContext span,
        .paneHeader span {
          display: block;
          color: #94a3b8;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .activeContext b,
        .paneHeader b {
          display: block;
          margin-top: 3px;
          color: #f8fafc;
          font-size: 13px;
        }

        .mergeLayout {
          min-height: 0;
          display: grid;
          grid-template-columns: minmax(320px, 1fr) minmax(390px, 450px);
          gap: 8px;
          overflow: hidden;
        }

        .workstationPane {
          min-width: 0;
          min-height: 0;
          overflow: auto;
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 14px;
          background: rgba(2, 6, 23, 0.42);
          padding: 8px;
        }

        .paneHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 8px;
        }

        .previewTargetSwitch {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }

        .previewTargetSwitch button {
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 10px;
          background: #0f172a;
          color: #cbd5e1;
          padding: 8px;
          font-size: 11px;
          font-weight: 900;
          cursor: pointer;
        }

        .previewTargetSwitch button.selected {
          border-color: rgba(167, 139, 250, 0.62);
          background: #6d28d9;
          color: #fff;
        }

        .settingsRail {
          padding: 10px;
          overflow: auto;
          font-size: 11px;
          line-height: 1.35;
        }

        .settingsRail h2 {
          margin: 0 0 12px;
          font-size: 14px;
        }

        .settingsRail p {
          margin: 0 0 12px;
          color: #cbd5e1;
        }

        .settingsRail b {
          display: block;
          color: #6ee7b7;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 3px;
        }

        .settingsRail span {
          display: block;
        }

        @media (max-width: 1180px) {
          .streamsBuilderShell,
          .streamsBuilderShell.sidebarOpen {
            grid-template-columns: 56px minmax(0, 1fr);
          }

          .settingsRail {
            display: none;
          }

          .mergeLayout {
            grid-template-columns: 1fr;
            overflow: auto;
          }
        }
      `}</style>
    </main>
  );
}
'@

Write-RepoFile -Path "src/lib/streams-builder/personal-use-merge.ts" -Content $mergeTypes
Write-RepoFile -Path "src/app/api/streams-builder/personal-use-bridge/route.ts" -Content $bridgeRoute
Write-RepoFile -Path "src/components/streams-builder/BuilderCenterChat.tsx" -Content $centerChat
Write-RepoFile -Path "src/components/streams-builder/workspace-modules/WorkspaceModulePanel.tsx" -Content $modulePanel
Write-RepoFile -Path "src/components/streams-builder/WorkspaceGrid.tsx" -Content $workspaceGrid

Write-Host "Running production build..."
pnpm build

Write-Host "Personal-use merged Builder script completed. Review git diff, then deploy when ready."
