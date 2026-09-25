import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("resource claim trusted request IP", () => {
  it("uses the shared trusted-proxy wrapper instead of calling getClientIp without a secret", () => {
    const route = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/api/resources/claim/route.ts"),
      "utf8",
    );
    const wrapper = readFileSync(
      resolve(process.cwd(), "apps/web/src/lib/request-client-ip.ts"),
      "utf8",
    );

    expect(route).toContain(
      'import { getTrustedRequestIp } from "../../../../lib/request-client-ip"',
    );
    expect(route).toContain("getTrustedRequestIp(request)");
    expect(route).not.toContain("getClientIp(request.headers)");
    expect(wrapper).toContain("process.env.TRUSTED_PROXY_SECRET");
    expect(wrapper).toContain("return getClientIp(request.headers, secret)");
    expect(wrapper).toContain('process.env.NODE_ENV !== "production"');
  });
});
