"use client";

import dynamic from "next/dynamic";

const StudioEditorShell = dynamic(
  () => import("@/components/editor-pro/StudioEditorShell"),
  { ssr: false }
);

export default function NewFaceEditorCoreTestClient() {
  return <StudioEditorShell />;
}
