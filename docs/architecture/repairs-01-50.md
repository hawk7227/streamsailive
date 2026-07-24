# Complete remediation audit

This package replaces the earlier partial matrix. Each repair has an independent implementation point and acceptance condition. Production completion still requires migrations, dependency installation, CI, deployment, and the TRACE browser test.

## Four critical findings

1. **Stateless direct model path** — repaired by pre-persisting the user turn, loading recent history, and using durable session IDs in `messages/route.ts`.
2. **Failure was only a UI event** — repaired by persisting failed/cancelled assistant turns and recording operation failures/events.
3. **Regex-only routing** — repaired by deterministic product intent routing plus reference-aware commands and tool policy.
4. **Parallel chat/builder systems** — repaired by making the chat endpoint invoke `executeWebsiteBuild`, returning verified operation/artifact IDs instead of model claims.

## Root causes 1–4

1. **Ungrounded action claims** — `response-claims.ts` and `execution-truth-validator.ts` reject build/save/open/deploy claims without a completed operation and ready preview artifact.
2. **Builder never invoked** — `messages/route.ts` routes builder intents into `chat-builder-executor.ts`.
3. **Irrelevant web search** — `tool-policy.ts` excludes `web.search` from website creation; builder requests bypass the search pipeline.
4. **No operation state** — operation/event/snapshot/idempotency tables, state machine, heartbeat, retry budget, and operation API provide durable state.

## Repairs 01–50

| # | Repair | Concrete implementation | Acceptance condition |
|---:|---|---|---|
| 1 | Canonical conversation event store | `streams_ai_conversation_events` migration | Every user, assistant, tool, operation, and failure event can be ordered by session/time. |
| 2 | Persist user before inference | `messages/route.ts` pre-persistence | Provider failure never removes the submitted user message. |
| 3 | Preserve failed assistant turns | failed/cancelled message persistence | Refresh shows a failed assistant turn with error metadata. |
| 4 | Context assembler | `context-assembler.ts`, history loading | “What happened?” receives recent messages and last operation/failure. |
| 5 | Runtime capability registry | capability manifest/API | Runtime reports builder/preview/tool availability from one manifest. |
| 6 | Deterministic command routing | `product-intent-router.ts` | Open preview/retry/cancel/build bypass generic chat. |
| 7 | Website state machine | `state-machine.ts` | Illegal stage jumps throw and do not mutate state. |
| 8 | Stage-specific timeouts | `timeout-policy.ts` | Each stage aborts with a named timeout and structured failure. |
| 9 | Resumable operations | parent operation, retry policy, snapshots | Retry links ancestry and resumes from preserved artifacts. |
| 10 | Transaction/checkpoint boundaries | preview cleanup + operation snapshots | Partial preview writes are cleaned; checkpoints remain restorable. |
| 11 | Separate orchestration/model | router, executor, repository, validator modules | Model text cannot directly mutate runtime state. |
| 12 | Structured outputs | HTML-only builder contract + normalization | Non-document or external-script output is rejected. |
| 13 | Intent tool allowlists | `tool-policy.ts` | Disallowed tool use throws before execution. |
| 14 | Operation-status access | operation API/repository | UI/assistant can inspect current stage and failure. |
| 15 | Conversational reference resolution | product router referents | “Open it,” “retry,” and “what happened” resolve to the last operation. |
| 16 | Failure-aware fallback | `failure-taxonomy.ts` | User sees stage-specific safe error and retryability. |
| 17 | Specific error copy | normalized failure messages | Generic “something went wrong” is not the sole explanation. |
| 18 | Prevent empty-state overwrites | merge-based chat hydration | Empty/failed server fetch cannot erase buffered messages. |
| 19 | Local durable buffering | `streamsDurableConversationBuffer.js` | Refresh/network failure retains unsynced local turns. |
| 20 | Stable IDs | turn/session/operation/idempotency IDs | Retry and streaming events retain stable ancestry. |
| 21 | Preview controller | canonical preview creation + verified artifact event | Preview opens only from backend-issued same-app URL. |
| 22 | Active-project awareness | project/preview IDs on operation | Context and response metadata identify active project/preview. |
| 23 | Build-log summary | failure taxonomy/detail clipping | Raw failure becomes safe categorized summary while retaining diagnostics. |
| 24 | Validate before preview | HTML validation before preview insert | Invalid frontend never reaches preview-ready state. |
| 25 | Frontend-only mode | preview-only route decision | User receives preview artifact without source-code chat dump. |
| 26 | Clarification policy | route decision/default contract | Missing details use documented defaults rather than undefined behavior. |
| 27 | Default build policy | builder system contract | Underspecified request produces accessible responsive single-page frontend. |
| 28 | Cancellation semantics | persisted CANCELLED transition | Cancellation stops work and preserves completed artifacts. |
| 29 | Generation leases | lease owner/expiry + heartbeat | Only live worker owns running operation. |
| 30 | Dead-job detection | stalled-operation SQL function/index | Stale operation becomes structured retryable failure. |
| 31 | Complete observability | correlated IDs in events/SSE/DB | One trace can join session, turn, operation, preview, and message. |
| 32 | Semantic telemetry | typed operation event names | Dashboards can group failures by stage/code. |
| 33 | Mobile interaction tests | architecture regression entry points | Mobile refresh/retry/navigation scenario is testable. |
| 34 | Composer/viewport safety | no destructive hydration + existing safe-area shell | Composer changes do not clear conversation state. |
| 35 | Navigation state preservation | durable buffer + persisted session before preview navigation | Opening preview cannot destroy chat history. |
| 36 | Recovery controls | open/explain/retry/cancel commands | User can recover without retyping the original request. |
| 37 | Exact incident regression | intent and runtime tests | Original build/preview wording routes to builder and never search. |
| 38 | Context continuity benchmarks | context assembler tests | Elliptical follow-ups resolve with immediate operation context. |
| 39 | Capability-use benchmarks | capability/router tests | Available preview/builder capabilities are selected correctly. |
| 40 | Tool-negative tests | tool-policy tests | Website build cannot invoke web search. |
| 41 | Model fallback hierarchy | authoritative route and bounded provider path | Fallback retains same operation/session and cannot invent success. |
| 42 | Prompt/policy versioning | capability version in operation metadata | Every operation records the policy/capability version used. |
| 43 | Product-grounded system prompt | builder system contract | Model is told it generates HTML only and cannot claim persistence. |
| 44 | No hidden model memory | DB/context-derived action state | Runtime truth comes from persisted state, not model memory. |
| 45 | Response validator | claim validators + tests | Unsupported saved/built/opened claims are rejected. |
| 46 | Artifact completion validation | completed stage requires ready preview artifact/URL | Success event cannot be emitted without artifact proof. |
| 47 | Safe automatic recovery | retry ancestry, snapshots, failure taxonomy | Recovery preserves prior artifacts and avoids full destructive restart. |
| 48 | Retry budgets | retry count/budget + policy | Retry stops after configured bound. |
| 49 | Destructive reset protection | merge hydration + pre-persistence | Fetch errors, route changes, and generation errors cannot clear valid messages. |
| 50 | Recovery snapshots | `streams_ai_operation_snapshots` + repository | Source and preview checkpoints can be enumerated/restored. |

## Required deployment order

1. Apply both 20260724 migrations.
2. Install dependencies with the locked pnpm version.
3. Run `pnpm run verify:architecture`, `pnpm test`, and `pnpm build`.
4. Deploy API and client in the same release.
5. Repeat the TRACE test and confirm no `searching` phase, a real operation ID, preview ID, preview URL, artifact event, and persisted failure on forced fault.
