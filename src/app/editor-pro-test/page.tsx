import dynamic from "next/dynamic";

const EditorProShell = dynamic(() => import("@/components/editor-pro/EditorProShell"), {
  ssr: false,
});

export default function EditorProTestPage() {
  return <EditorProShell />;
}
