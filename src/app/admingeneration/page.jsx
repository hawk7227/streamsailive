"use client";

import OriginalAdmingenerationPage from "./OriginalAdmingenerationPage";
import CompactAnalyzerVideoMode from "@/components/admingeneration/CompactAnalyzerVideoMode";
import LiveVoiceConversationPanel from "@/components/admingeneration/LiveVoiceConversationPanel";

export default function AdminGenerationPage() {
  return (
    <>
      <OriginalAdmingenerationPage />
      <CompactAnalyzerVideoMode />
      <LiveVoiceConversationPanel />
    </>
  );
}
