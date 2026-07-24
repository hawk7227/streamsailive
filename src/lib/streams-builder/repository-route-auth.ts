import { type NextRequest } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";

function isVercelGitPreview(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host") || "";
  const host = forwardedHost || request.headers.get("host") || "";
  const hostname = host.split(":")[0].toLowerCase();

  // Vercel branch aliases keep the explicit `-git-` hostname even when the
  // deployment is promoted or reports VERCEL_ENV=production. The hostname is
  // the reliable signal for this isolated builder preview; VERCEL_ENV is not.
  return hostname.endsWith(".vercel.app") && hostname.includes("-git-");
}

export async function requireStreamsBuilderRepositoryAccess(request: NextRequest) {
  if (isVercelGitPreview(request)) return;
  await requireStreamsAIScope(request);
}
