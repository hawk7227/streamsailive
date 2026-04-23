# STREAMS — System Upgrade Roadmap
## Project-Bound Builder Workspace OS

---

## Target Layers

Immediate dependency-critical layers (build in this order):

1. Approval + Audit Layer
2. Project Context Container
3. Memory System
4. Artifact Registry
5. Task + Assignment Engine
6. Builder Runtime
7. Connector Action Layer

Then on top: Builder Workspace, Preview Runtime, Visual QA Layer, Office/Document Artifact Generation.

---

## Current State

From the existing STREAMS handoff, the system already has:
- Real assistant orchestration path
- Workspace shell
- Chat as control surface
- Preview direction
- Proof-first rules
- Operator/build execution direction

**Critical foundations that are still missing or thin:**
- Project Context Container — missing/thin
- Memory System — missing
- Task + Assignment Engine — missing/thin
- Approval + Audit Layer — only partial
- Connector Action Layer — only partial
- Visual QA Layer — missing/tooling-dependent

---

## Gap

This is not a cosmetic pass and not ChatTab compliance work. It is a system upgrade from "chat + tools" into a **persistent project operating system**.

### Missing foundational persistence
- Project records, settings, rules, sessions
- Project startup context loader
- Memory retrieval/write-back
- Artifacts with versions/status/proof state
- Tasks with dependency/approval structure

### Missing governed integration
- Identity layer
- Connected accounts
- Secure encrypted credential storage
- Project-level GitHub/Vercel/Supabase bindings
- Runtime auto-resolution of repo/branch/project/db bindings
- Permission scopes, action logs, reconnect/revoke flows

### Missing runtime binding
- Project resolution before each action
- Context load before model call
- One runtime path for build/chat actions
- Structured write-back to memory/tasks/artifacts/proof logs
- Proof classification on every action

### Missing operator-grade execution
- First-class pre-push workflow
- Visible proof/audit layer
- Workspace panels for real state
- Dedicated preview panel
- Visual QA/runtime browser verification
- Editable office/document artifact generation

---

## Build Plan

### Phase 1 — Approval + Audit Layer

Build first:
- `proof_records`
- `audit_records`
- `violation_records`
- `action_logs`
- `approval_gates`

Status enum: `Proven` | `ImplementedButUnproven` | `Blocked` | `Rejected`

Also build:
- Proof panel data model
- Runtime helper for classifying every major action/result
- Audit hook points for later layers

**Why first:** this becomes the truth gate for all later claims.

---

### Phase 2 — Project Context Container

Build:
- `projects`
- `project_settings`
- `project_rules`
- `project_chat_sessions`
- `project_bindings`
- `project_startup_context_loader`

Minimum project binding fields:
- GitHub repo + branch
- Vercel project
- Supabase project
- Storage bucket
- Environment

Also add:
- Project ownership
- Workspace ownership linkage
- Active project resolution contract

**Purpose:** every STREAMS session starts inside a real project boundary and loads the right standards automatically.

---

### Phase 3 — Memory System

Build:
- `project_memory_rules`
- `decision_log`
- `issue_history`
- `latest_handoffs`
- `session_summaries`
- `pinned_project_facts`

Runtime features:
- Retrieval at chat/build start
- Write-back after important work
- Pinned facts loader
- Handoff generation/storage
- Summary creation/update

**Purpose:** continuity comes from persistent system memory, not chat history.

---

### Phase 4 — Artifact Registry

Build:
- `artifacts`
- `artifact_versions`

Artifact type enum: `code` | `doc` | `image` | `video` | `svg` | `react` | `html` | `schema` | `prompt_pack`

Also define:
- Canonical artifact identity
- Current version vs historical versions
- Editable vs generated state
- Preview target reference
- Proof state on artifact/version
- Linked session/task/output references

**Purpose:** outputs become persistent build objects, not transient chat emissions.

---

### Phase 5 — Task + Assignment Engine

Build:
- `tasks`
- Task status + priority
- Dependencies
- Recurring schedule support
- Assigned owner (user, ai, system)
- Approval state
- Task-to-artifact links
- Task-to-proof links

Also add:
- Task timeline/history
- Blocked reason field
- Open next step field

**Purpose:** ongoing builder work becomes structured and queryable.

---

### Phase 6 — Builder Runtime Upgrade

Upgrade runtime so every meaningful action does this:

1. Resolve `projectId`
2. Load project context
3. Load memory
4. Classify required task/artifact involvement
5. Execute through one runtime path
6. Write results back to memory/tasks/artifacts/proof logs

Build:
- Project resolver middleware/service
- Context assembly service
- Runtime action envelope
- Tool continuation loop
- Proof/status classification per action
- Prohibition on direct route-level model calls for build actions

**Purpose:** the runtime stops behaving like generic chat and becomes a project-bound build operator.

---

### Phase 7 — Connector Action Layer

Build:
- Identity layer
- `connected_accounts`
- Secure secrets store / encrypted credential references

Provider adapters:
- GitHub
- Vercel
- Supabase

`connected_accounts` minimum fields:
- `provider`
- `user_id`
- `workspace_id`
- `scopes`
- `encrypted_credentials`
- `status`
- `last_validated_at`

Requirements:
- Encrypted at rest
- Never exposed to chat
- Project-scoped usage
- Revocable and rotatable
- Sessionless reuse
- Runtime auto-resolution
- Destructive action governance

**Purpose:** connect once, bind once, use automatically inside project context.

---

### Phase 8 — Pre-Push Operator Workflow

Add first-class action: **Run pre-push audit**

It executes:
1. `npx tsc --noEmit` + STREAMS error filter
2. `git status --short` + imported-untracked-file check
3. Repo root check
4. Branch check
5. Remote check
6. Pattern audit
7. Commit if clean
8. Push
9. Confirm commit landed
10. Poll Vercel if connected

Runs through:
- Runtime action system
- Connector bindings
- Audit/proof records
- Action logs

**Purpose:** operator workflow becomes a governed system action, not manual chat instructions.

---

### Phase 9 — Chat Control Plane

Only after the above exists:
- Bind chat to real project/session/task/artifact state
- Persistent session list
- Context-aware chat start
- Approval prompts for governed actions
- Memory-backed continuity
- No generic stateless session behavior

**This is where chat actually becomes the control plane.**

---

### Phase 10 — Builder Workspace

Upgrade `/streams` into a real workspace with panels for:
- Project sidebar
- Persistent session list
- Artifact list
- Task list
- Proof/audit panel
- Connected service status
- Active artifact panel
- Live activity stream

**Important:** these panels must reflect real state from the layers above, not decorative placeholders.

---

### Phase 11 — Preview Runtime

Build:
- Dedicated preview panel
- Artifact-preview binding
- React/HTML preview
- Image/video preview
- Document preview
- Output sync from real artifact version
- Refresh from real runtime output

**This is later because preview trust depends on artifact identity and version truth.**

---

### Phase 12 — Visual QA Layer

Build:
- Playwright runtime
- Screenshot capture
- DOM inspection
- Computed CSS inspection
- Mobile/viewport checks
- Overflow checks
- Spacing/token checks
- Visual regression snapshots

**This is how STREAMS stops relying on source-only verification.**

---

### Phase 13 — Office / Document Artifact Generation

Build support for:
- `.docx`, `.xlsx`, `.pptx`, `.pdf`
- Markdown docs
- Export/download flow
- Artifact versioning for documents

**Sits on top of Artifact Registry + Preview Runtime.**

---

## Proof Required

### Approval + Audit Layer
- Source proof: schema + runtime enforcement code exists
- Runtime proof: actions produce proof/audit/violation records
- Output proof: proof panel shows real records

### Project Context Container
- Source proof: project/binding/settings models exist
- Persistence proof: project state is stored and retrievable
- Runtime proof: chat/build actions resolve correct project context automatically

### Memory System
- Persistence proof: decisions, handoffs, facts, summaries survive sessions
- Runtime proof: memory is loaded at start and written back after important work

### Artifact Registry
- Persistence proof: artifacts and versions are stored with identity/history
- Output proof: generated work is accessible/editable through registry state

### Task Engine
- Persistence proof: statuses/dependencies/approvals are stored and queryable
- Runtime proof: actions create/update linked tasks

### Connector Action Layer
- Security proof: encrypted secrets, rotation/revoke paths, no credential leakage into chat
- Persistence proof: account bindings survive sessions
- Runtime proof: project actions auto-resolve repo/Vercel/Supabase without token prompts
- Audit proof: governed actions are logged with permission checks

### Builder Runtime Upgrade
- Source proof: one runtime path, no bypasses
- Runtime proof: actions resolve project, load context, execute, write back
- Fake-layer removal proof: no generic direct model paths presented as project-bound operator actions

### Pre-Push Operator Workflow
- Runtime proof: the command runs end-to-end
- Output proof: real verification results, commit/push/Vercel status where connected
- Audit proof: action/result records captured

### Workspace / Preview / Visual QA / Office Output
- Output proof is essential for all of these, not just source proof

---

## Status Classification

| Layer | Status |
|---|---|
| Approval + Audit Layer | ImplementedButUnproven — must be formalized into records, gates, visible proof state |
| Project Context Container | Blocked — missing implementation depth |
| Memory System | Blocked — explicitly missing |
| Artifact Registry | Blocked/thin — concept exists, persistent formal system missing |
| Task + Assignment Engine | Blocked — missing/thin |
| Connector Action Layer | Blocked — insufficient for signed-in project-bound model |
| Identity Layer | Blocked — required and missing |
| Secure Credential System | Blocked — required and missing |
| Project Bindings | Blocked — required and missing |
| Builder Runtime Upgrade | ImplementedButUnproven — orchestration engine exists, not bound to real project objects |
| Builder Workspace | ImplementedButUnproven — shell direction exists, not stateful workspace OS |
| Preview Runtime | Blocked/thin — partial direction only |
| Visual QA Layer | Blocked — missing/tooling-dependent |
| Office / Document Artifact Generation | Blocked — until Artifact Registry and preview/output flows formalized |

---

## One-Line Implementation Instruction

Build STREAMS into a project-bound signed-in builder workspace OS by adding Approval + Audit, Project Context, persistent Memory, Artifact Registry, Task Engine, secure Connected Accounts with GitHub/Vercel/Supabase bindings, a project-bound Builder Runtime, governed pre-push operator workflow, stateful Workspace panels, Preview Runtime, Visual QA, and editable document artifact generation — strictly in that order.
