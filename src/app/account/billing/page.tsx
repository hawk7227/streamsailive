import StreamsAccountActionPanel from "@/components/account/StreamsAccountActionPanel";

export default function AccountBillingPage() {
  return (
    <StreamsAccountActionPanel
      pageKind="billing"
      title="Billing"
      description="Manage your plan, billing portal, usage credits, spend limits, and recent account usage activity."
    />
  );
}
