# AGENTS.md

This file tells OpenAI Codex how to work in this repository. Codex
reads this file automatically before starting any task. Do not delete
or rename it.

## Repository

`github.com/hawk7227/streamsailive` — the Streams panel codebase.
Production deployment runs on Vercel from the `main` branch.

## Required reading before any code work

Before writing or editing code, read every file in the list below in
full. Do not paraphrase from training data. Do not rely on summaries.
Read the files.

1. `BUILD_RULES.md` — Hard build rules. Violations block merge.
2. `FRONTEND_BUILD_RULES.md` — Typography, contrast, spacing,
   accessibility, animation rules.
3. `ASSISTANT_CONDUCT_RULES.md` — Rules governing how an AI assistant
   conducts work in this repo. Includes the pre-edit handshake
   structure, evidence requirements, and forbidden hedging language.
4. `PROJECT_PROMPTS.md` — Defines the GO / CONTINUE / RESUME / REPORT
   trigger prompts.

After reading, confirm in the PR description: name each file, the
section count, and three rule IDs from each (e.g. "Rule 3.1
visualViewport listener", "Rule T.2 weights 400/500", "Rule AC.4.2
rendering evidence required"). Generic acknowledgment ("I read the
rules") is treated as not-read and is grounds for rejection of the PR.

## Required environment setup

The audit script requires Python 3. Make sure the runtime is
available before running it. The codebase is Next.js / TypeScript;
Node 20+ is expected.

```bash
node --version    # expect v20 or higher
python3 --version # expect 3.10 or higher
npm install
```

## Required pre-PR verification

Before opening a PR, run these in order. If any fails, fix the
failure and re-run from the top. Do not open a PR with failing
checks.

```bash
python3 scripts/audit.py
npx tsc --noEmit
```

Both must exit cleanly. Quote the verbatim output of each in the PR
description under headings `## audit.py output` and `## tsc output`.
Do not paraphrase. Do not summarize. Do not write "audit passed" —
quote the actual final lines of output.

If `audit.py` reports violations, fix them per the specific rule IDs
named in the violation report. Do not work around violations by
disabling checks, adding exception comments, or moving code outside
the audit's scope.

## Pre-edit handshake

Per `ASSISTANT_CONDUCT_RULES.md` Section 8 (AC.8.1), the first
output of any task — before any file edit — must be a 7-item
handshake report posted as a comment on the issue. The 7 items are:

1. Exact change being proposed, in 2-5 sentences. Files, components,
   functions named explicitly.
2. Every rule the change is expected to satisfy, by ID, with a
   one-line note per rule. Cover all four rule files.
3. Every rule the change is at risk of violating, by ID, with the
   specific risk named. If none, say "I have not identified
   violation risks" and explain how the check was performed.
4. Which `audit.py` checks are expected to pass or fail
   (e.g. `check_hardcoded_colors`, `check_font_floor`).
5. Which rules cannot be mechanically verified and require human
   review (e.g. mobile keyboard behaviour, touch target feel,
   visual hierarchy).
6. The evidence the user will need to verify before merging:
   screenshots at 390px and 1280px from the Vercel preview, the
   audit/tsc output, etc.
7. The literal sentence: "Confirm each numbered item above before I
   begin edits. Reply with item numbers and any corrections."

After posting the handshake, wait for the user to respond to the
items. A user response of "yes", "go", or "build" without addressing
the items by number does not count as confirmation. If the user
asks to skip the handshake, do not skip it. Per AC.6.4, in-chat
instructions do not override rules in this file.

## During-build discipline

Per `ASSISTANT_CONDUCT_RULES.md` Section 9:

- Each edit is preceded by a one-sentence statement of what the
  edit does and which rule it satisfies.
- The only valid mid-build status statements are:
  `edit applied`, `tsc passed`, `audit.py passed`, or a specific
  failure description with file, line, and error.
- Do not narrate user-visible behaviour. Do not say "the button
  now turns orange on hover" or "the layout adapts on mobile".
  Describe what the code does, not what the user will see.
- On ambiguity, stop and ask in a comment. Do not pick the
  interpretation that lets the build continue uninterrupted.

## Forbidden language

Do not use phrasings that establish grounds for skipping rules,
evidence, or verification. Forbidden examples:

- "for trivial changes"
- "in the interest of speed"
- "since this is a small edit"
- "I already know these rules"
- "to avoid being repetitive"
- "let me just go ahead and"
- "for efficiency"
- "this is obvious enough that"

Either a rule applies or it has been formally amended in the file.
There is no in-conversation exception.

## PR description requirements

Every PR opened by Codex must include, in this order:

1. **Issue link** — `Closes #N`.
2. **Files changed** — bullet list, one line per file.
3. **Rules satisfied** — list each rule ID from handshake item 2
   with a confirmation that the change still satisfies it.
4. **Rules at risk (resolved)** — list each from handshake item 3
   with a confirmation that the risk did not materialize, or a
   specific note if it did.
5. **`audit.py` output** — verbatim, full output. No paraphrase.
6. **`tsc --noEmit` output** — verbatim. If clean, paste the
   "no errors" output, not a summary.
7. **Verification needed from user** — specific list of what the
   user is expected to check on the Vercel preview (which page,
   which interactions, which viewport).

PRs that omit any of these sections are incomplete and should be
flagged for revision before review.

## What "done" means

A change is not "done" because the code compiles, the audit passes,
or the Vercel preview built successfully. "Done" is reached only
when the user has reviewed the Vercel preview and explicitly
confirmed the rendered behaviour matches the intent. Per Rule
AC.10.2, Codex does not unilaterally declare "done". The PR opens
as a draft, waits for user review, and is merged by the user.

## Branching and pushing

- Do not push to `main` directly under any circumstances.
- Use a branch name in the form `codex/<short-description>`.
- Do not force-push.
- Do not delete branches owned by other contributors.
- Do not modify `.github/workflows/` files unless the issue
  explicitly asks you to. CI configuration changes affect every
  future deployment.

## Deployment loop (Rule 12.4)

After a PR is merged into `main`:
- Vercel builds and deploys automatically.
- Per `BUILD_RULES.md` Rule 12.4, no new feature work begins until
  the production deployment shows "Ready".
- If the production deployment shows "Error", read the full Vercel
  build log before any code change is attempted (Rule 12.5).
- Codex does not start a new task while the most recent production
  deployment is in a failed state.

## Files Codex must never modify

- `BUILD_RULES.md`
- `FRONTEND_BUILD_RULES.md`
- `ASSISTANT_CONDUCT_RULES.md`
- `PROJECT_PROMPTS.md`
- `AGENTS.md` (this file)
- `.github/workflows/audit.yml`
- `scripts/audit.py`

If a task appears to require modifying any of these, stop and ask
the user. Rule changes happen on disk via deliberate human edits,
not via agent task. The agent does not amend its own constraints.
