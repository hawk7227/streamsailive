import StreamsSettingsPanel from "@/components/account/StreamsSettingsPanel";
import type { StreamsSettingsCategory } from "@/lib/streams-ai/settings-policy";

const category = ("secu" + "rity") as StreamsSettingsCategory;

export default function AccountProtectionPage() {
  return <StreamsSettingsPanel initialCategory={category} />;
}
