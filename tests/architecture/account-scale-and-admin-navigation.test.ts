// @vitest-environment node

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("account scale and administrator navigation", () => {
  it("keeps public signup wired to Supabase email and OAuth identity providers", () => {
    const signup = source("src/app/signup/page.tsx");
    expect(signup).toContain("supabase.auth.signUp");
    expect(signup).toContain("supabase.auth.signInWithOAuth");
    expect(signup).toContain('handleOAuthSignup("google")');
    expect(signup).toContain('handleOAuthSignup("github")');
    expect(signup).toContain('/auth/callback?next=/streams-ai');
    expect(signup).toContain('fetch("/api/team/ensure"');
  });

  it("keeps identity and workspace state scoped by authenticated user id", () => {
    const auth = source("src/contexts/AuthContext.tsx");
    const team = source("src/lib/team-server.ts");
    expect(auth).toContain('.eq("id", currentUser.id)');
    expect(auth).toContain("clearAccountScopedBrowserState");
    expect(auth).toContain('from("profiles")');
    expect(team).toContain('from("workspace_members")');
    expect(team).toContain('.eq("user_id", userId)');
    expect(team).toContain("current_workspace_id");
  });

  it("restores profile navigation and exposes operations only to admin roles", () => {
    const navigation = source("src/components/streams-ai/current-chat/NewChatNavigationVisualSample.jsx");
    const profile = source("src/app/profile/page.tsx");
    const commissioning = source("src/app/api/admin/commissioning/route.ts");
    expect(navigation).toContain('router.push("/profile")');
    expect(navigation).toContain('router.push("/admin/operations")');
    expect(navigation).toContain('membershipRole === "owner" || membershipRole === "admin"');
    expect(profile).toContain("updateProfile");
    expect(profile).toContain("workspace?.name");
    expect(commissioning).toContain('selection.current.role !== "owner"');
    expect(commissioning).toContain('selection.current.role !== "admin"');
  });

  it("does not hardcode a specific administrator email or password", () => {
    const navigation = source("src/components/streams-ai/current-chat/NewChatNavigationVisualSample.jsx");
    const profile = source("src/app/profile/page.tsx");
    const commissioning = source("src/app/api/admin/commissioning/route.ts");
    const combined = `${navigation}\n${profile}\n${commissioning}`;
    expect(combined).not.toContain("hawkinsmarcus127@gmail.com");
    expect(combined).not.toContain("Horace120");
    expect(combined).not.toMatch(/password\s*[:=]\s*["'][^"']+/i);
  });
});
