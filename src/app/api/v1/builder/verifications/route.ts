import { type NextRequest } from "next/server";
import { POST as runLegacyBrowserVerification } from "@/app/api/streams-builder/browser-verification/route";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  return runLegacyBrowserVerification(request);
}
