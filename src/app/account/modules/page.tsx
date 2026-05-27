import StreamsAccountActionPanel from "@/components/account/StreamsAccountActionPanel";

export default function AccountPage() {
  return (
    <StreamsAccountActionPanel
      pageKind="modules"
      title="Capabilities and modules"
      description="Review module access, credit usage, and upgrade paths."
    />
  );
}
