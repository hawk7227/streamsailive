import { type NextRequest } from "next/server";
import { handleBrowserVerificationPost } from "@/lib/streams-builder/browser-verification-route-handler";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  return handleBrowserVerificationPost(request);
}
