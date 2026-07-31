# Legacy Streams Custom UI — Permanently Retired

## Decision

The former custom Streams chat and builder presentation is retired and must not be restored, wrapped, restyled, or used as a fallback.

The replacement may retain only:

- verified backend and tool capabilities;
- stable API and data contracts;
- authentication and authorization;
- Streams color tokens.

It must not retain legacy React components, layouts, consoles, tables, sidebars, composers, message renderers, workspace grids, editor wrappers, visual panels, DOM interception, global browser patches, or restoration scripts.

## Campaign material

Campaign Intelligence material is optional reference content for chat generation only. It is not a product subsystem, preservation requirement, UI architecture, database contract, or reason to retain a legacy component.

## Prohibited actions

Do not:

- restore deleted files from repository history;
- copy legacy components into new folders;
- recreate the retired three-column builder shell;
- mount the old operator shell under a new route;
- add tests or workflows that require the old presentation;
- reintroduce old repair or restore scripts;
- treat old UI details as protected capabilities.

## Capability migration rule

When a retired UI file contains useful behavior, extract the behavior into a neutral service and rebuild access through the new WebUI. Do not preserve the component itself.

## Enforcement

`scripts/validate-legacy-ui-retirement.mjs` runs during production builds and architecture verification. It fails when retired files or known restoration markers are reintroduced.
