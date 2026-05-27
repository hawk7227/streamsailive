import StreamsAccountActionPanel from "@/components/account/StreamsAccountActionPanel";

export default function AccountPage() {
  return (
    <StreamsAccountActionPanel
      pageKind="apps"
      title="Apps and connectors"
      description="Review project and connector actions with project and GitHub activity hooks."
    />
  );
}
