import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MAX_FILE_SIZE_BYTES } from "@nexus/storage";

describe("production upload size boundary", () => {
  it("keeps the Caddy request limit aligned with the application upload envelope", () => {
    const caddy = readFileSync(
      resolve(process.cwd(), "deploy/Caddyfile"),
      "utf8",
    );
    const uploadRoute = readFileSync(
      resolve(
        process.cwd(),
        "apps/web/src/app/api/products/[id]/builds/route.ts",
      ),
      "utf8",
    );

    expect(MAX_FILE_SIZE_BYTES).toBe(64 * 1024 * 1024);
    expect(uploadRoute).toContain(
      "const MULTIPART_OVERHEAD_BYTES = 1024 * 1024",
    );
    expect(caddy).toContain("max_size 65MiB");
    expect(caddy).not.toContain("max_size 65MB");

    const caddyLimitBytes = 65 * 1024 * 1024;
    const applicationEnvelopeBytes =
      MAX_FILE_SIZE_BYTES + 1024 * 1024;

    expect(caddyLimitBytes).toBe(applicationEnvelopeBytes);
  });
});
