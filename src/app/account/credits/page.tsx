import StreamsAccountActionPanel from "@/components/account/StreamsAccountActionPanel";

export default function AccountCreditsPage() {
  return (
    <StreamsAccountActionPanel
      pageKind="credits"
      title="Credits"
      description="Review usage credits, credits received, credits used, available balance, auto-reload, and credit-pack options."
    />
  );
}
