import { redirect } from "next/navigation";
import {
  isAdminAuthorizationError,
  requireAdminSession,
} from "@/lib/admin/require-admin-session";
import OperationsDashboardClient from "./OperationsDashboardClient";

export const dynamic = "force-dynamic";

export default async function OperationsDashboardPage() {
  try {
    await requireAdminSession();
  } catch (error) {
    if (isAdminAuthorizationError(error)) {
      redirect(error.status === 401 ? "/login" : "/");
    }
    throw error;
  }

  return <OperationsDashboardClient />;
}
