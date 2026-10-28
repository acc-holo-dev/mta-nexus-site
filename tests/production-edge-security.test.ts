import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("production edge security headers", () => {
  it("sets a conservative baseline at the TLS edge", () => {
    const caddy = read("deploy/Caddyfile");

    expect(caddy).toContain('Strict-Transport-Security "max-age=31536000; includeSubDomains"');
    expect(caddy).toContain('X-Content-Type-Options "nosniff"');
    expect(caddy).toContain('X-Frame-Options "DENY"');
    expect(caddy).toContain('Referrer-Policy "strict-origin-when-cross-origin"');
    expect(caddy).toContain(
      'Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()"',
    );
    expect(caddy).toContain("-Server");
  });

  it("keeps proxy identity and request-size enforcement intact", () => {
    const caddy = read("deploy/Caddyfile");

    expect(caddy).toContain("max_size 68157440");
    expect(caddy).toContain("header_up X-Nexus-Proxy-Secret {$TRUSTED_PROXY_SECRET}");
    expect(caddy).toContain("header_up X-Forwarded-For {remote_host}");
    expect(caddy).toContain("header_up X-Real-IP {remote_host}");
  });

  it("does not ship an unsafe static CSP without a Next.js nonce strategy", () => {
    const caddy = read("deploy/Caddyfile");

    expect(caddy).not.toContain("Content-Security-Policy");
  });
});
