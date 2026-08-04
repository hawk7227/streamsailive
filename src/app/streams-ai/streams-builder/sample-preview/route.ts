import { BRAINSTORM_PREVIEW_HTML } from "@/lib/streams-builder/brainstorm-preview-samples";

export const dynamic = "force-dynamic";

export async function GET() {
  return new Response(BRAINSTORM_PREVIEW_HTML, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      "x-streams-builder-preview": "hardcoded-frontend-visual",
    },
  });
}
