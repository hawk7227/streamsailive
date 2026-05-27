import StreamsAccountActionPanel from "@/components/account/StreamsAccountActionPanel";

export default function AccountPage() {
  return (
    <StreamsAccountActionPanel
      pageKind="language"
      title="Language"
      description="Manage language, region, and formatting preferences."
    />
  );
}
