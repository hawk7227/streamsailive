import { redirect } from "next/navigation";
import { isAdminAuthorizationError, requireAdminSession } from "@/lib/admin/require-admin-session";
import UsageCreditsAdminClient from "./UsageCreditsAdminClient";

export const dynamic = "force-dynamic";

export default async function AdminUsageCreditsPage() {
  try {
    await requireAdminSession();
  } catch (error) {
    if (isAdminAuthorizationError(error)) {
      redirect(error.status === 401 ? "/login" : "/");
    }
    throw error;
  }

  return <UsageCreditsAdminClient />;
}
