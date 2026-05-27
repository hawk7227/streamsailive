import StreamsAccountActionPanel from "@/components/account/StreamsAccountActionPanel";

export default function AccountPage() {
  return (
    <StreamsAccountActionPanel
      pageKind="settings"
      title="Settings"
      description="Control workspace, product, and account preferences."
    />
  );
}
