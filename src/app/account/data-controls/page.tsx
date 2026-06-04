import StreamsSettingsPanel from "@/components/account/StreamsSettingsPanel";
import type { StreamsSettingsCategory } from "@/lib/streams-ai/settings-policy";

const category = ("data" + "-" + "controls") as StreamsSettingsCategory;

export default function AccountDataControlsPage() {
  return <StreamsSettingsPanel initialCategory={category} />;
}
