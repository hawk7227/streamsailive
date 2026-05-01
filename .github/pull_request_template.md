# STREAMS PR Checklist

## Active slice

<!-- Name the active slice from docs/streams-current-status.md. -->

## Summary

<!-- Explain what changed. Do not claim built/working/proven unless proof exists. -->

## Changed files

<!-- Paste output from: git diff --name-only origin/main...HEAD -->

```text

```

## Scope check

- [ ] I read `AGENTS.md` before coding.
- [ ] I read `docs/streams-current-status.md` before coding.
- [ ] The changed files match the active slice allowed file list.
- [ ] No unrelated audit, validation, formatting, config, cleanup, or refactor files are included.
- [ ] I reverted unrelated files automatically instead of asking the user.

## Classification

Select exactly one classification for the PR:

- [ ] Proven
- [ ] Implemented but unproven
- [ ] Blocked
- [ ] Rejected

## Checks run

- [ ] `git diff --check`
- [ ] `git diff --name-only origin/main...HEAD`
- [ ] `npx tsc --noEmit`
- [ ] `pnpm build`

Paste relevant command output or summarize exact results:

```text

```

## Proof provided

### Source proof

<!-- File paths, key functions/components changed, and why they are the correct existing foundations. -->

### Runtime proof

<!-- Runtime proof only if actually run. Otherwise write: Not proven. -->

### Persistence proof

<!-- Required when persistence is claimed. Otherwise write: Not proven or Not applicable. -->

### Output proof

<!-- Required when generated outputs are claimed. Otherwise write: Not proven or Not applicable. -->

### Fake/duplicate layer removal proof

<!-- Confirm no fake/duplicate/temporary layer was added to the critical path. -->

## Proof still missing

<!-- List exactly what still requires browser/deploy/SQL/provider proof. -->

## Hard-stop review

- [ ] This PR does not require database migration execution.
- [ ] This PR does not require production credentials.
- [ ] This PR does not weaken or bypass audit/validation/security rules.
- [ ] This PR does not create a duplicate chat/session/artifact/media system.
- [ ] This PR does not automatically start the next slice.

## Status file update

- [ ] `docs/streams-current-status.md` was updated because project status changed.
- [ ] `docs/streams-current-status.md` was not updated because source status did not change.

## Final statement

Classification:

```text

```

Proof completed:

```text

```

Proof still missing:

```text

```
