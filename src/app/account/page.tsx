import StreamsAccountActionPanel from "@/components/account/StreamsAccountActionPanel";

export default function AccountPage() {
  return (
    <StreamsAccountActionPanel
      pageKind="overview"
      title="Account"
      description="Manage your STREAMS account with real loading, billing, credits, and activity events."
    />
  );
}
