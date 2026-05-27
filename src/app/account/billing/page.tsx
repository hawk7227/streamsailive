import StreamsAccountActionPanel from "@/components/account/StreamsAccountActionPanel";

export default function AccountPage() {
  return (
    <StreamsAccountActionPanel
      pageKind="billing"
      title="Billing"
      description="Manage Stripe billing portal and checkout actions with live billing activity."
    />
  );
}
