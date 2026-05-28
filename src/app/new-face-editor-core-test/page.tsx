"use client";

import StudioEditorShell from "src/components/streams-ai/current-chat/new-face/editor-core/StudioEditorShell";
import EditorPro from "src/components/streams-ai/current-chat/new-face/editor-core/EditorProShell";
import PreviewRuntime from "src/components/streams-ai/current-chat/new-face/editor-core/PreviewSurface";

export default function NewFaceEditorCorePage() {
  return (
    <StudioEditorShell>
      <EditorPro />
      <PreviewRuntime />
    </StudioEditorShell>
  );
}