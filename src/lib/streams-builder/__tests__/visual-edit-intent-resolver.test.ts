import { describe, expect, it } from "vitest";
import { resolveVisualEditIntent } from "../visual-edit-intent-resolver";

describe("resolveVisualEditIntent", () => {
  it("maps patient landing visual card removal to the page usage site", () => {
    const result = resolveVisualEditIntent("remove the 2 visit cards below healthcare that feels personal again");

    expect(result.matched).toBe(true);
    expect(result.repo).toBe("hawk7227/patientpanel");
    expect(result.branch).toBe("master");
    expect(result.path).toBe("src/app/page.tsx");
    expect(result.route).toBe("/");
    expect(result.scope).toBe("usage_site");
    expect(result.doNotTouch).toContain("src/components/home/VisitCards.tsx");
    expect(result.enrichedPrompt).toContain("patch the usage site");
  });

  it("treats one visual instance as a usage-site edit instead of global component deletion", () => {
    const result = resolveVisualEditIntent("delete the second card under the provider image", {
      repo: "hawk7227/patientpanel",
      branch: "master",
      path: "src/app/page.tsx",
      route: "/",
    });

    expect(result.matched).toBe(true);
    expect(result.scope).toBe("usage_site");
    expect(result.safePatchTarget).toContain("local JSX usage");
    expect(result.safePatchTarget).toContain("do not edit the reusable component definition");
    expect(result.enrichedPrompt).toContain("preserve the reusable component file");
    expect(result.enrichedPrompt).toContain("patch the usage site, not the reusable component file");
  });

  it("does not match non-visual general chat", () => {
    const result = resolveVisualEditIntent("what can this app do?");
    expect(result.matched).toBe(false);
  });
});
