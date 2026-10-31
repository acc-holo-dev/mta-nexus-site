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

    // PROBLEMS.md is the single maintained problem registry (owner-requested).
    // PROJECT-MAP.md is the compact repository navigation index (Phase 0 foundation).
    expect(documents).toEqual([
      "ARCHITECTURE.md",
      "OPERATIONS.md",
      "PROBLEMS.md",
      "PROJECT-MAP.md",
    ]);

    const handbook = readdirSync(resolve(process.cwd(), "docs/handbook")).sort();
    expect(handbook.length).toBeGreaterThanOrEqual(4);
    expect(handbook.every((name) => name.endsWith(".md"))).toBe(true);
    expect(handbook).toEqual(
      expect.arrayContaining([
        "00-README.md",
        "10-ROADMAP.md",
        "13-DECISION-REGISTER.md",
        "15-AI-CONTEXT-INDEX.md",
      ]),
    );

    const readme = read("README.md");
    expect(readme).toContain("docs/handbook/00-README.md");
    expect(readme).toContain("docs/handbook/13-DECISION-REGISTER.md");
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
    const ids = [...register.matchAll(/^\|\s*([A-Z]+-\d+)\s*\|/gm)].map((match) => match[1]);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
