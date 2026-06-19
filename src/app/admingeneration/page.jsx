"use client";

import OriginalAdmingenerationPage from "./OriginalAdmingenerationPage";
import CompactAnalyzerVideoMode from "@/components/admingeneration/CompactAnalyzerVideoMode";
import AnalyzerPreviewIntelligenceDock from "@/components/admingeneration/AnalyzerPreviewIntelligenceDock";
import LiveVoiceConversationPanel from "@/components/admingeneration/LiveVoiceConversationPanel";
import SafeReferenceUploadOverlay from "@/components/admingeneration/SafeReferenceUploadOverlay";

export default function AdminGenerationPage() {
  return (
    <>
      <OriginalAdmingenerationPage />
      <AnalyzerPreviewIntelligenceDock />
      <CompactAnalyzerVideoMode />
      <LiveVoiceConversationPanel />
      <SafeReferenceUploadOverlay />
    </>
  );
}
