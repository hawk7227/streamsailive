import { getRuntimeCapabilityManifest } from "@/lib/streams-ai/runtime/architecture/capability-registry";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() { return Response.json({ ok: true, ...getRuntimeCapabilityManifest() }); }
