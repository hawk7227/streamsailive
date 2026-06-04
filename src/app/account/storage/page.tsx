import StreamsAccountActionPanel from "@/components/account/StreamsAccountActionPanel";

export default function AccountStoragePage() {
  return (
    <StreamsAccountActionPanel
      pageKind="storage"
      title="Storage"
      description="Review saved work, retained assets, export readiness, and account storage controls."
    />
  );
}
