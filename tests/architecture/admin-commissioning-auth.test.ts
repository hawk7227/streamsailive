// @vitest-environment node

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

function source(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("administrator commissioning authorization", () => {
  it("uses the authenticated administrator session rather than a browser-supplied commissioning secret", () => {
    const route = source("src/app/api/admin/commissioning/route.ts");
    const guard = source("src/lib/admin/require-admin-session.ts");
    const page = source("src/app/admin/operations/page.tsx");
    const client = source("src/app/admin/operations/OperationsDashboardClient.tsx");

    expect(route).toContain("requireAdminSession()");
    expect(route).not.toContain("x-streams-commissioning-token");
    expect(route).not.toContain("STREAMS_COMMISSIONING_TOKEN");
    expect(guard).toContain("supabase.auth.getUser()");
    expect(guard).toContain('role !== "owner" && role !== "admin"');
    expect(page).toContain("requireAdminSession()");
    expect(client).toContain('fetch("/api/admin/commissioning"');
    expect(client).toContain('credentials: "include"');
  });
});
