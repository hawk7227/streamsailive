import StreamsAccountActionPanel from "@/components/account/StreamsAccountActionPanel";

export default function AccountNotificationsPage() {
  return (
    <StreamsAccountActionPanel
      pageKind="notifications"
      title="Notifications"
      description="Review usage, reset, low-balance, auto-reload, spend-limit, and account-control alerts."
    />
  );
}
