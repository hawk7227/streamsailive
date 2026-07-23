import { type NextRequest } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";

function isVercelGitPreview(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  return process.env.VERCEL_ENV !== "production" && host.includes(".vercel.app") && host.includes("-git-");
}

export async function requireStreamsBuilderRepositoryAccess(request: NextRequest) {
  // Git branch preview deployments are isolated test workspaces. Vercel sets
  // NODE_ENV=production for them, so the general STREAMS AI preview fallback
  // does not run. Permit only the explicit -git- preview hostname here.
  if (isVercelGitPreview(request)) return;
  await requireStreamsAIScope(request);
}
