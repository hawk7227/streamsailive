import BeforeAfterReviewPanel from "@/components/streams-builder/BeforeAfterReviewPanel";
import WorkspaceGrid from "@/components/streams-builder/WorkspaceGrid";

export const dynamic = "force-dynamic";

export default function StreamsBuilderPage() {
  return (
    <main>
      <WorkspaceGrid />
      <BeforeAfterReviewPanel />
    </main>
  );
}
