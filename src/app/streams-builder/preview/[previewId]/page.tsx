import CanonicalPreviewRuntime from "@/components/streams-builder/CanonicalPreviewRuntime";

export const dynamic = "force-dynamic";

export default async function StandaloneStreamsBuilderPreviewPage({ params }: { params: Promise<{ previewId: string }> }) {
  const { previewId } = await params;
  return <CanonicalPreviewRuntime previewId={previewId} />;
}
