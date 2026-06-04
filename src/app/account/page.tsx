import StreamsAccountActionPanel from "@/components/account/StreamsAccountActionPanel";

export default function AccountPage() {
  return (
    <StreamsAccountActionPanel
      pageKind="overview"
      title="Account"
      description="Manage your Streams account, plan access, usage, credits, privacy, billing controls, and account readiness."
    />
  );
}
