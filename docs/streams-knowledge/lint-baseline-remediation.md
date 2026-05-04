# Lint Baseline Remediation

## Purpose
Handle repo-wide lint failures in a dedicated slice without expanding feature PRs.

## Rules
- No feature changes.
- Do not weaken lint config.
- Do not delete validators/tests.
- Use staged remediation and separate branch/slice.

## Stage order
1. safe mechanical fixes
2. require/import cleanup
3. no-explicit-any with real types
4. React hooks issues
5. final lint clean

## Safe stage-1 examples
- prefer-const
- remove truly unused imports/vars
- no-require-imports only in scripts/tests when conversion is safe
- react/no-unescaped-entities for text-only JSX
- syntax-only lint fixes
