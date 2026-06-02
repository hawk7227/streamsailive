"use client";

import OriginalAdmingenerationPage from "./OriginalAdmingenerationPage";
import CompactAnalyzerVideoMode from "@/components/admingeneration/CompactAnalyzerVideoMode";
import AnalyzerPreviewIntelligenceDock from "@/components/admingeneration/AnalyzerPreviewIntelligenceDock";
import LiveVoiceConversationPanel from "@/components/admingeneration/LiveVoiceConversationPanel";

export default function AdminGenerationPage() {
  return (
    <>
      <OriginalAdmingenerationPage />
      <AnalyzerPreviewIntelligenceDock />
      <CompactAnalyzerVideoMode />
      <LiveVoiceConversationPanel />
    </>
  );
}
