import StreamsAccountActionPanel from "@/components/account/StreamsAccountActionPanel";

export default function AccountPage() {
  return (
    <StreamsAccountActionPanel
      pageKind="personalization"
      title="Personalization"
      description="Control assistant preferences, style, and account behavior."
    />
  );
}
