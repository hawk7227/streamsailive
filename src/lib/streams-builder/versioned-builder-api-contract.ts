export const BUILDER_APPROVAL_STATUSES = [
  "not_requested",
  "requested",
  "approved",
  "rejected",
] as const;

export type BuilderApprovalStatus = typeof BUILDER_APPROVAL_STATUSES[number];

export const VERSIONED_BUILDER_STATE_ROUTES = [
  "/api/v1/builder/workspaces",
  "/api/v1/builder/drafts",
  "/api/v1/builder/checkpoints",
  "/api/v1/builder/patches",
  "/api/v1/builder/previews",
  "/api/v1/builder/approvals",
  "/api/v1/builder/events",
] as const;

export function normalizeBuilderEventCursor(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : null;
}

export function filterBuilderEventsAfterSequence<T extends { data?: { sequenceNumber?: number } }>(
  events: T[],
  afterSequence: number,
) {
  const filtered = events.filter((event) => Number(event?.data?.sequenceNumber || 0) > afterSequence);
  const nextSequence = filtered.reduce(
    (max, event) => Math.max(max, Number(event?.data?.sequenceNumber || 0)),
    afterSequence,
  );
  return { events: filtered, nextSequence };
}

export function appendBuilderCheckpoint<T extends { id: string }>(
  checkpoints: T[],
  checkpoint: T,
  limit = 100,
) {
  return [...checkpoints.filter((item) => item?.id !== checkpoint.id), checkpoint].slice(-limit);
}
