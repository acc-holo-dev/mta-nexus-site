import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("mainline repository policy", () => {
  it("keeps maintained automation on main", () => {
    const coordinator = read(".github/workflows/ci.yml");
    expect(coordinator).toContain("main");
    expect(coordinator).not.toMatch(/branches:\s*\[[^\]]*\bdev\b/);
    expect(coordinator).not.toMatch(/^\s*- dev\s*$/m);
    const dollar = "$";
    const imageCacheKey = `nexus-production-image-${dollar}{{ runner.os }}-${dollar}{{ github.sha }}`;
    const bestEffortArtifact = `continue-on-error: ${dollar}{{ github.ref_type != 'tag' }}`;
    expect(coordinator).toContain("actions/cache/save@v6");
    expect(coordinator).toContain(imageCacheKey);
    expect(coordinator).not.toContain("actions/download-artifact");
    const coordinatorArtifactUploads = coordinator
      .split(/^\s{4}- name: /m)
      .filter((step) => step.includes("actions/upload-artifact@"));
    expect(coordinatorArtifactUploads.length).toBeGreaterThan(0);
    expect(coordinatorArtifactUploads.every((step) => step.includes(bestEffortArtifact))).toBe(
      true,
    );

    for (const path of [
      ".github/workflows/auth-browser.yml",
      ".github/workflows/directory-browser.yml",
      ".github/workflows/resource-browser.yml",
    ]) {
      const content = read(path);
      expect(content, path).toContain("workflow_call:");
      expect(content, path).not.toMatch(/^\s+(?:push|pull_request|schedule):/m);
      expect(content, path).toContain("actions/cache/restore@v6");
      expect(content, path).toContain(imageCacheKey);
      expect(content, path).not.toContain("actions/download-artifact");
    }

    const dependabot = read(".github/dependabot.yml");
    expect(dependabot).not.toContain('target-branch: "dev"');
    expect(dependabot).not.toMatch(/^\s+target-branch:/m);
    expect(dependabot.match(/package-ecosystem:/g)?.length).toBe(3);
  });

  it("keeps operational docs focused and the owner handbook controlled", () => {
    const documents = readdirSync(resolve(process.cwd(), "docs"))
      .filter((name) => name.endsWith(".md"))
      .sort();

    // Core agent/product contracts integrated in DOC-02; handbook chapters remain until DOC-05/DOC-04.
    // OPERATIONS.md path and operator contract stay pinned for evidence consumers.
    expect(documents).toEqual([
      "AGENT.md",
      "ARCHITECTURE.md",
      "COMMERCIAL-FUTURE.md",
      "COMMUNITY.md",
      "CURRENT-STATE.md",
      "DECISIONS.md",
      "DOCS-STYLE.md",
      "FLOWS.md",
      "OPERATIONS.md",
      "PROBLEMS.md",
      "PRODUCT.md",
      "PROJECT-MAP.md",
      "RELEASE-PLAN.md",
      "RESOURCES.md",
      "RETENTION-PLAN.md",
      "ROADMAP.md",
      "SERVER-PACK-SPEC.md",
      "SERVERS-ORGS.md",
      "TASKS.md",
      "TRACEABILITY.md",
      "TRUST-STAFF.md",
      "UX-CONTRACT.md",
    ]);

    const archive = readdirSync(resolve(process.cwd(), "docs/archive")).sort();
    expect(archive).toEqual(["DOCS-MIGRATION.md", "README.md"]);

    const opsIndex = readdirSync(resolve(process.cwd(), "docs/ops")).sort();
    expect(opsIndex).toEqual([
      "README.md",
      "backup-recovery.md",
      "inbox-recovery.md",
      "production-boundary.md",
      "release.md",
      "resource-safety.md",
      "verification.md",
      "workers.md",
    ]);

    const handbook = readdirSync(resolve(process.cwd(), "docs/handbook")).sort();
    // DOC-04: superseded subject chapters removed; thin nav + decision register remain.
    expect(handbook.length).toBe(3);
    expect(handbook.every((name) => name.endsWith(".md"))).toBe(true);
    expect(handbook).toEqual(["00-README.md", "13-DECISION-REGISTER.md", "15-AI-CONTEXT-INDEX.md"]);

    const readme = read("README.md");
    expect(readme).toContain("docs/AGENT.md");
    expect(readme).toContain("docs/DECISIONS.md");
    expect(readme).toContain("docs/RESOURCES.md");
    expect(readme).toContain("docs/TRUST-STAFF.md");
    expect(readme).toContain("docs/handbook/00-README.md");
    expect(readme).toContain("docs/handbook/13-DECISION-REGISTER.md");
    expect(readme).toContain("docs/OPERATIONS.md");

    const agents = read("AGENTS.md");
    expect(agents).toContain("docs/AGENT.md");
    expect(agents).toMatch(/прямого указания владельца|explicit instruction/i);

    const decisions = read("docs/DECISIONS.md");
    expect(decisions).toContain("NX-001");
    expect(decisions).toContain("handbook/13-DECISION-REGISTER.md");
    expect(decisions).toContain("AI-007");

    const register = read("docs/handbook/13-DECISION-REGISTER.md");
    const ai007 = [...register.matchAll(/^\|\s*AI-007\s*\|\s*CONFIRMED\s*\|\s*([^|]+)\|/gm)].map(
      (m) => m[1].trim(),
    );
    expect(ai007).toHaveLength(1);
    expect(ai007[0].toLowerCase()).toContain("explicit instruction");
    expect(ai007[0].toLowerCase()).not.toContain("push directly to");
  });

  it("keeps Docker DEV source mounts and polling enabled", () => {
    const compose = read("compose.yaml");
    expect(compose).toContain('WATCHPACK_POLLING: "true"');
    expect(compose).toContain("./apps/web/src:/app/apps/web/src:ro");
    expect(compose).toContain("./packages/db/src:/app/packages/db/src:ro");
    expect(compose).toContain("./packages/ui/src:/app/packages/ui/src:ro");
  });

  it("documents main as the only maintained development branch", () => {
    const readme = read("README.md");
    expect(readme).toMatch(/\*\*Active development branch:\*\* `main` only\./);
    expect(readme).not.toContain("--branch dev");
  });

  it("assigns a unique identifier to each recorded product decision", () => {
    const register = read("docs/handbook/13-DECISION-REGISTER.md");
    const registerIds = [...register.matchAll(/^\|\s*([A-Z]+-\d+)\s*\|/gm)].map(
      (match) => match[1],
    );
    expect(registerIds.length).toBe(309);
    expect(new Set(registerIds).size).toBe(registerIds.length);

    const supplements = read("docs/DECISIONS.md");
    const nxIds = [...supplements.matchAll(/^\|\s*(NX-\d+)\s*\|/gm)].map((match) => match[1]);
    expect(nxIds.length).toBeGreaterThan(0);
    expect(new Set(nxIds).size).toBe(nxIds.length);
    expect(registerIds.some((id) => nxIds.includes(id))).toBe(false);
  });
});
