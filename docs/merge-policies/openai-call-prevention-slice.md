# OpenAI Call Prevention and Cost Control Runtime Slice

Allowed files:
- ASSISTANT_CONDUCT_RULES.md
- BUILD_RULES.md
- docs/streams-current-status.md
- docs/streams-knowledge/proof-classification.md
- docs/streams-knowledge/self-build-runtime.md
- scripts/full-build-gate.mjs
- src/lib/assistant-core/orchestrator.ts
- src/lib/streams/ai-prevention/
- src/lib/streams/openai-prevention/
- src/lib/streams/build-runtime/build-quality-gate.ts
- src/lib/streams/build-runtime/context-packet-builder.ts
- src/lib/streams/build-runtime/correction-loop.ts
- src/lib/streams/build-runtime/knowledge-access.ts
- docs/merge-policies/
- scripts/scope-guard.mjs
- package.json

Forbidden:
- provider image/video routes
- DB migrations
- scripts/validate-rule-confirmation.js
- public/build-report.json
