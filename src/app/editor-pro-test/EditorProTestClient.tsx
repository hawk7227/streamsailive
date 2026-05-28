"use client";

import dynamic from "next/dynamic";

const EditorProShell = dynamic(() => import("@/components/editor-pro/EditorProShell"), {
  ssr: false,
});

export default function EditorProTestClient() {
  return <EditorProShell />;
}
