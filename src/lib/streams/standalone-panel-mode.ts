export function isStandaloneStreamsPanelMode() {
  return (
    process.env.STREAMS_STANDALONE_PANEL === "true" ||
    process.env.NEXT_PUBLIC_STREAMS_STANDALONE_PANEL === "true"
  );
}
