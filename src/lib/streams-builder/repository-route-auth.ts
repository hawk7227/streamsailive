import { type NextRequest } from "next/server";
import { requireStreamsAIScope } from "@/lib/streams-ai/auth";

export function requestHostname(request: NextRequest) {
  const rawHost = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  const firstForwardedHost = rawHost.split(",")[0]?.trim() || "";
  return firstForwardedHost.split(":")[0].toLowerCase();
}

export function isVercelGitPreview(request: NextRequest) {
  const hostname = requestHostname(request);

  // Vercel branch aliases keep the explicit `-git-` hostname even when the
  // deployment is promoted or reports VERCEL_ENV=production. Proxies may send
  // a comma-separated x-forwarded-host chain, so only inspect the first host.
  return hostname.endsWith(".vercel.app") && hostname.includes("-git-");
}

export async function requireStreamsBuilderRepositoryAccess(request: NextRequest) {
  if (isVercelGitPreview(request)) return;
  await requireStreamsAIScope(request);
}
