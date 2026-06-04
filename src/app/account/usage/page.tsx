import StreamsAccountActionPanel from "@/components/account/StreamsAccountActionPanel";

export default function AccountUsagePage() {
  return (
    <StreamsAccountActionPanel
      pageKind="usage"
      title="Usage"
      description="Track included usage, daily limits, usage credits, spend controls, auto-reload, alerts, and feature credit costs."
    />
  );
}
