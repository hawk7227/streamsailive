import StreamsAccountActionPanel from "@/components/account/StreamsAccountActionPanel";

export default function AccountPage() {
  return (
    <StreamsAccountActionPanel
      pageKind="profile"
      title="Profile"
      description="Update and review profile-level account information."
    />
  );
}
