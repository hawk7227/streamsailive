# Streams Builder Unified Orchestrator Architecture

This keeps the current visual editor foundation and builds upward around it.

## Core rule

One OpenAI orchestrator is the planner/controller. Tools execute scoped work and report results. Tools do not become separate brains.

## Order of system layers

1. Universal layer mapper
2. Exact source range resolver
3. Safety and recommendation engine
4. Chat intervention events
5. Mode selector
6. Tool registry
7. Stateful build/repair loop
8. Trace and observability
9. Validation and rollback

## Mode behavior

Conversation mode stays free flowing. The user should not have to choose a model or tool manually.

The orchestrator silently switches modes based on intent:

- Conversation: answer, plan, explain, brainstorm.
- Inspect: find, look, locate, analyze, review. Read only.
- Build: add, fix, update, remove, wire, implement. Scoped writes allowed after safety checks.
- Repair: build failed, Vercel failed, frontend still wrong, errors appear.
- Visual edit: selected frontend layer, replace image, delete section, parent/child scope.
- Safety intervention: action is risky, unclear, too broad, or source mapping is unsafe.

## Visual editor relationship

The existing visual editor bridge remains the frontend selection foundation. The orchestrator wraps it instead of replacing it.

The visual editor sends layer selections and safety alerts. The orchestrator decides whether to inspect, block, recommend, ask for approval, or apply a scoped edit.

## Safety behavior

Unsafe actions are blocked before writing. Chat is alerted with:

- selected layer
- attempted action
- source file/range if known
- risk reason
- child/parent options
- recommended safe scopes

## Tool registry rule

Every tool must expose:

- name
- category
- supported modes
- risk level
- approval requirement
- availability
- description

## Validation and rollback

Any build, repair, or visual source edit must have validation and rollback steps:

- selected scope matches source scope
- no unrelated files touched
- build/test status captured when available
- previous file SHA or commit is known
- rollback touches only changed files
