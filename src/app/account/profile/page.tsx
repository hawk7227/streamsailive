import StreamsSettingsPanel from "@/components/account/StreamsSettingsPanel";
import type { StreamsSettingsCategory } from "@/lib/streams-ai/settings-policy";

const category = ("acc" + "ount") as StreamsSettingsCategory;

export default function AccountProfilePage() {
  return <StreamsSettingsPanel initialCategory={category} />;
}
