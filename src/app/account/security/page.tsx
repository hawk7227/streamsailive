import StreamsAccountActionPanel from "@/components/account/StreamsAccountActionPanel";

export default function AccountSecurityPage() {
  return (
    <StreamsAccountActionPanel
      pageKind="security"
      title="Security"
      description="Review login readiness, workspace access, account status, and security controls."
    />
  );
}
