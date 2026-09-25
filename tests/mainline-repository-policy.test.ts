import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("mainline repository policy", () => {
  it("keeps maintained automation on main", () => {
    const workflows = [
      ".github/workflows/ci.yml",
      ".github/workflows/auth-browser.yml",
      ".github/workflows/directory-browser.yml",
      ".github/workflows/resource-browser.yml",
    ];

    for (const path of workflows) {
      const content = read(path);
      expect(content, path).toContain("main");
      expect(content, path).not.toMatch(/branches:\s*\[[^\]]*\bdev\b/);
      expect(content, path).not.toMatch(/^\s*- dev\s*$/m);
    }

    const dependabot = read(".github/dependabot.yml");
    expect(dependabot).not.toContain('target-branch: "dev"');
    expect(dependabot.match(/target-branch: "main"/g)?.length).toBe(3);
  });

  it("keeps only the two maintained long-form documents", () => {
    const documents = readdirSync(resolve(process.cwd(), "docs"))
      .filter((name) => name.endsWith(".md"))
      .sort();

    expect(documents).toEqual(["ARCHITECTURE.md", "OPERATIONS.md"]);
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
    expect(readme).toContain("Active development branch: `main` only.");
    expect(readme).not.toContain("--branch dev");
  });
});
