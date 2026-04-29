# Project Prompts
## Trigger prompts for working on the streamsailive Streams panel.
## Paste a section verbatim (including its heading line) to invoke it.

These prompts work together with `BUILD_RULES.md`,
`FRONTEND_BUILD_RULES.md`, and `ASSISTANT_CONDUCT_RULES.md`. They do
not replace the rules. They constrain the assistant's response shape
to make rule violations more visible.

Honest limits up front, in plain terms:

- These prompts are text the assistant reads and chooses to follow.
  They do not auto-enforce. The same model producing the output is
  the one checking the format.
- "No reply" is approximated, not achieved. The minimum reply at
  each step is the structured output specified below. There is no
  mode where the assistant does work silently and surfaces only when
  done.
- The prompts cannot bypass the handshake in
  `ASSISTANT_CONDUCT_RULES.md` AC.8.1. They run it; they don't skip
  it.
- "Done" is never reached by these prompts alone. AC.4.2 and AC.10.2
  require user-supplied rendering evidence and explicit
  acknowledgment. The prompts stop short of "done" by design.

---

## GO

Use this prompt to start a fresh session on a new task.

```
GO

Execute the start-of-session protocol immediately. No preamble. No
questions to me. Format your response as the numbered output below
and nothing else.

1. RETRIEVAL — run conversation_search and recent_chats. Output a
   one-paragraph summary of what was found. If nothing found, say
   "no prior context found".

2. RULE READ — view each of the three files in full:
     BUILD_RULES.md
     FRONTEND_BUILD_RULES.md
     ASSISTANT_CONDUCT_RULES.md
   For each file, output:
     <filename>: <total section count> sections, <total rule count>
     rules. Confirming: <three rule IDs by name>
   If any file is missing from this session, output:
     MISSING: <filename> — paste it before I can proceed.
   and stop here.

3. STATE — restate, in 1–3 sentences, the task currently in
   progress, based on retrieval results from step 1 and any user
   message preceding this GO. If unclear, output:
     UNCLEAR TASK — name the task you want me to build or resume.
   and stop here.

4. CAPABILITY CHECK — output a single line listing the capabilities
   this task requires that the current environment lacks. Format:
     ENV LIMITS: <comma-separated list, or "none for this scope">

5. HANDSHAKE — produce the 7-item handshake required by
   ASSISTANT_CONDUCT_RULES.md AC.8.1. Numbered, terse, one to two
   lines per item. End with the literal sentence required by item 7.

6. STOP HERE. Do not begin edits. Wait for the user's response to
   the handshake items.

Do not add commentary outside the numbered output. Do not ask
clarifying questions outside step 3 and step 5. Do not editorialize.
Do not summarize what you did. Output only the numbered sections
above.
```

---

## CONTINUE

Use this prompt after responding to the handshake produced by GO or
RESUME. This is the prompt that authorizes edits.

```
CONTINUE

Begin edits per the confirmed handshake. Format your response as a
sequence of edit blocks and nothing else.

For each edit, output exactly:
  EDIT <n>: <file path>
  RULE: <rule ID(s) this edit satisfies>
  CHANGE: <one sentence describing the source-level change>
  [the actual tool call(s) — view, str_replace, create_file]
  STATUS: <"applied" | specific failure description>
  UNVERIFIED: <comma-separated rule IDs that remain unverified>

After all edits are applied, output the closing report required by
AC.10.1, numbered 1 through 6, and stop.

Forbidden in this response:
- narrating user-visible behaviour (AC.9.3)
- claiming "done", "works", or "ready" (AC.4.2)
- "let me", "I'll now", "next I'll", or any other transition prose
- summarizing what you built in user-facing terms
- offering further help, asking what's next, or proposing follow-up
  work

If you encounter ambiguity, stop the sequence and output:
  AMBIGUITY at EDIT <n>: <specific question>
and wait for clarification (AC.9.4).

If a rule check fails mid-sequence, stop the sequence and output:
  RULE FAILURE at EDIT <n>: <rule ID> — <specific reason>
and wait.
```

---

## RESUME

Use this prompt when picking up mid-task in the same session — for
example, after stepping away, after a tool call failed and you want
to retry, or after the session was interrupted but the rule files
are still in context.

This prompt is shorter than GO because it does not redo retrieval
or full rule-reading. It uses what is already in the current
session.

Honest scope limit: RESUME assumes the three rule files were read
earlier in this session. If a session has restarted and the rules
are not in context, RESUME outputs the missing-file message and
stops, the same as GO step 2 would. RESUME does not skip rule
verification — it skips the redundancy of re-reading files that
are already loaded.

```
RESUME

Pick up the task in progress. No preamble. Format your response as
the numbered output below and nothing else.

1. RULE PRESENCE — confirm that BUILD_RULES.md,
   FRONTEND_BUILD_RULES.md, and ASSISTANT_CONDUCT_RULES.md are all
   present in the current session. For each, output one line:
     <filename>: present — <three rule IDs by name>
   If any of the three is not in the current session, output:
     MISSING: <filename> — paste it before I can resume.
   and stop here.

2. STATE — restate the task in progress in 1–3 sentences, based on
   the most recent handshake and edit blocks in this session. If
   no prior handshake exists in this session, output:
     NO HANDSHAKE FOUND — send GO to start fresh.
   and stop here.

3. CHECKPOINT — output a single line naming the last completed
   step:
     LAST COMPLETED: <handshake confirmed | EDIT <n> applied |
     closing report produced | rendering evidence requested>

4. NEXT — output a single line naming the next action:
     NEXT: <begin EDIT <n> | wait for handshake response | wait for
     rendering evidence | other specific action>

5. STOP HERE. Wait for the user to send CONTINUE, send a handshake
   correction, provide rendering evidence, or specify a different
   next action.

Do not begin edits in this response. Do not narrate. Do not
summarize. Output only the numbered sections above.
```

---

## REPORT

Use this prompt when the build phase is complete and you want a
consolidated closing report.

This is appropriate when CONTINUE has been run multiple times across
a single task (multiple edit batches) and you want the full
rule-by-rule reconfirmation in one place rather than scattered
across edit-block STATUS lines.

Honest scope limit: REPORT does not run audit.py. It does not run
tsc. It does not check Vercel. Those are tools the user runs in the
terminal, with output the user pastes back. REPORT consolidates
what the assistant has produced and names what the user still owes.
It does not produce verification it cannot produce.

```
REPORT

Produce the closing report for the task in progress. No preamble.
Format your response as the numbered output below and nothing else.

1. FILES CHANGED — list every file changed during this task. One
   line per file. Format:
     <file path>: <one-sentence summary of change>

2. RULES SATISFIED — list every rule from handshake item 2.
   Format per rule:
     <rule ID>: <"satisfied" | "no longer applies because <reason>">

3. RISKS RESOLVED — list every rule from handshake item 3.
   Format per rule:
     <rule ID>: <"risk did not materialize" | "risk materialized:
     <specific description>">

4. AUDIT.PY OUTPUT — if the user has pasted audit.py output in this
   session, quote it verbatim. If not, output:
     audit.py output not provided — run: python3 scripts/audit.py
   Do not summarize what audit.py would say. Do not paraphrase
   prior runs.

5. TSC OUTPUT — if the user has pasted tsc output in this session,
   quote it verbatim. If not, output:
     tsc output not provided — run: npx tsc --noEmit
   Same rule as item 4 — verbatim only, no paraphrase.

6. EVIDENCE OUTSTANDING — list the rendering-evidence items still
   required from AC.4.2 before "done" can be claimed. Format:
     - screenshot at 390px of <page URL or route>
     - screenshot at 1280px of <page URL or route>
     - accessibility-audit.js output for <page URL>
     - other specific items as relevant

7. STATUS — output one of these literal lines and only one:
     STATUS: code in place, awaiting evidence
     STATUS: code in place, evidence received and acknowledged
     STATUS: blocked — <specific blocker>

   "done" is not a permitted status in this report. AC.10.2
   requires user-supplied evidence and explicit assistant
   acknowledgment before "done" is reached, which happens in a
   later turn, not in REPORT itself.

Do not editorialize. Do not propose next work. Do not ask whether
the user is satisfied. Output only the numbered sections above.
```

---

## Suggested workflow

```
GO              → retrieval + rule-read + handshake
[user]          → respond to handshake items 1–7 by number
CONTINUE        → edit blocks + per-edit closing
[user steps away or session pauses]
RESUME          → confirm rules present, restate state, name next
                  action
[user]          → CONTINUE, or correct, or provide evidence
REPORT          → consolidated closing report
[user]          → run audit.py, run tsc, take screenshots, paste
                  results
[final turn]    → assistant acknowledges evidence; STATUS becomes
                  "evidence received and acknowledged"; user runs
                  the deployment loop from BUILD_RULES.md §12
```

---

## What these prompts do not do

For honesty, repeated from the top of the file:

- They do not auto-enforce. They constrain the response shape; they
  rely on the user noticing when the shape is violated.
- They do not bypass the handshake in AC.8.1. GO and RESUME both
  produce or wait for it.
- They do not produce rendering evidence. The assistant cannot run
  a real browser. AC.4.3 forbids fabricating evidence.
- They do not run audit.py, tsc, or check Vercel. The user runs
  those locally and pastes output.
- They do not declare "done". AC.10.2 reserves "done" for after
  user-supplied evidence has been acknowledged.

The prompts move work toward verifiable artifacts (handshake items,
edit blocks, closing reports, status lines) so deviation is
detectable. They do not replace the verification step the user
performs.
