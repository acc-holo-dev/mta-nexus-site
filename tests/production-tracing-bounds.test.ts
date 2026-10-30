import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("production tracing and standalone runtime bounds", () => {
  it("excludes non-runtime checkout trees from standalone NFT output", () => {
    const config = read("apps/web/next.config.mjs");

    expect(config).toContain('output: "standalone"');
    expect(config).toContain("outputFileTracingRoot: repositoryRoot");
    expect(config).toContain("outputFileTracingExcludes");
    for (const pattern of [
      "../../tests/**/*",
      "../../scripts/**/*",
      "../../docs/**/*",
      "../../.git/**/*",
      "../../.env*",
      "../../packages/db/migrations/**/*",
      "../../packages/db/scripts/**/*",
      "../../uploads/**/*",
      "../../.github/**/*",
      "../../deploy/**/*",
    ]) {
      expect(config).toContain(pattern);
    }
    expect(config).toMatch(/Turbopack cannot prove a static tree|whole-project/u);
    expect(config).toContain("USER node");
  });

  it("keeps local storage and mail-secret file reads outside NFT project roots", () => {
    const storage = read("packages/storage/src/local-provider.ts");
    const mail = read("packages/db/src/repositories/account-mail-runtime.ts");
    const dockerfile = read("Dockerfile");

    expect(storage).toContain("path.resolve(/* turbopackIgnore: true */ baseDir)");
    expect(mail).toContain("/* turbopackIgnore: true */ secretPath");
    expect(mail).toContain("isAbsolute(file)");
    expect(mail).toContain("O_NOFOLLOW");
    expect(dockerfile).toMatch(/USER node[\s\S]*CMD \["sh", "scripts\/start-production\.sh"\]/u);
    expect(dockerfile).toContain("chown -R node:node /data/uploads");
    expect(dockerfile).toContain("COPY --from=build /app/apps/web/.next/standalone/ /app/");
    expect(dockerfile).toContain("pnpm --filter @nexus/db --prod deploy /runtime/db");
  });
});
