import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("mainline repository policy", () => {
  it("keeps maintained automation on main and permanent dev", () => {
    const coordinator = read(".github/workflows/ci.yml");
    expect(coordinator).toContain("main");
    expect(coordinator).toMatch(/^\s+- dev\s*$/m);
    expect(coordinator).toMatch(/pull_request:[\s\S]*branches:[\s\S]*- main/);
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
    expect(dependabot).toContain('target-branch: "dev"');
    expect(dependabot.match(/target-branch:\s*"dev"/g)?.length).toBe(3);
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
      "DOCS-MIGRATION.md",
      "FLOWS.md",
      "GETTING-STARTED.md",
      "GROW-02-STARTER-COLLECTION-PILOT.md",
      "GROW-07-DIGEST-PILOT.md",
      "OPERATIONS.md",
      "PROBLEMS.md",
      "PRODUCT.md",
      "PROJECT-MAP.md",
      "RELEASE-PLAN.md",
      "RELEASE-READINESS.md",
      "RESOURCES.md",
      "RETENTION-PLAN.md",
      "ROADMAP.md",
      "SERVER-PACK-SPEC.md",
      "SERVERS-ORGS.md",
      "STRUCTURE-REFACTORING.md",
      "TASKS.md",
      "TRACEABILITY.md",
      "TRUST-STAFF.md",
      "UX-CONTRACT.md",
    ]);

    // Documentation-system migration in progress: new trees coexist with root redirect stubs.
    const futureDocs = readdirSync(resolve(process.cwd(), "docs/future")).sort();
    expect(futureDocs).toEqual([
      "advertising.md",
      "commerce.md",
      "documentation-system.md",
      "initiatives.md",
      "release-2027.md",
      "release.md",
      "retention.md",
      "server-packs.md",
    ]);
    expect(readdirSync(resolve(process.cwd(), "docs/current")).sort()).toEqual([
      "code-topology.md",
      "design-direction.md",
      "development.md",
      "domains",
      "quality.md",
      "system.md",
    ]);
    expect(readdirSync(resolve(process.cwd(), "docs/current/domains")).sort()).toEqual([
      "COMMUNITY.md",
      "RESOURCES.md",
      "SERVERS-ORGS.md",
      "TRUST-STAFF.md",
    ]);
    expect(readdirSync(resolve(process.cwd(), "docs/issues")).sort()).toEqual(["constraints.md"]);
    expect(readdirSync(resolve(process.cwd(), "docs/archive")).sort()).toEqual([
      "migrations",
      "pilots",
    ]);

    const handbook = readdirSync(resolve(process.cwd(), "docs/handbook")).sort();
    // DOC-04: superseded subject chapters removed; thin nav + decision register remain.
    expect(handbook.length).toBe(3);
    expect(handbook.every((name) => name.endsWith(".md"))).toBe(true);
    expect(handbook).toEqual(["00-README.md", "13-DECISION-REGISTER.md", "15-AI-CONTEXT-INDEX.md"]);

    const readme = read("README.md");
    expect(readme).toContain("docs/AGENT.md");
    expect(readme).toContain("docs/DECISIONS.md");
    expect(readme).toContain("docs/current/domains/RESOURCES.md");
    expect(readme).toContain("docs/current/domains/TRUST-STAFF.md");
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
    const compose = read("docker/compose.yaml");
    expect(compose).toContain('WATCHPACK_POLLING: "true"');
    expect(compose).toContain("./site/src:/app/site/src:ro");
    expect(compose).toContain("./site/packages/db/src:/app/site/packages/db/src:ro");
    expect(compose).toContain("./site/packages/ui/src:/app/site/packages/ui/src:ro");
  });

  it("documents permanent branches as main and dev only", () => {
    const readme = read("README.md");
    expect(readme).toMatch(
      /\*\*Permanent branches:\*\* `dev` \(integration\) → `main` \(release line\)\./,
    );
    expect(readme).not.toMatch(/\*\*Active development branch:\*\* `main` only\./);
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
