import { isIP } from "node:net";
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { getClientIp } from "@nexus/security";

const secret = "trusted-proxy-secret-0123456789abcdef";
const seed = Number(process.env.FC_SEED ?? 20261009);
if (!Number.isInteger(seed) || seed < -2147483648 || seed > 2147483647)
  throw new Error("FC_SEED must be a signed 32-bit integer");
const options = { seed, numRuns: 1000 };
const ip = fc.oneof(fc.ipV4(), fc.ipV6());

function headers(
  marker: string | undefined,
  real: string | undefined,
  forwarded: string | undefined,
) {
  const values = new Map([
    ["x-nexus-proxy-secret", marker],
    ["x-real-ip", real],
    ["x-forwarded-for", forwarded],
  ]);
  return { get: (name: string) => values.get(name) ?? null };
}

describe("trusted proxy IP properties", () => {
  it("rejects arbitrary same-length Unicode markers without throwing", () => {
    fc.assert(
      fc.property(
        // Generate UTF-16 code units: Unicode code points can have a different JS length.
        fc
          .array(fc.integer({ min: 0, max: 0xffff }), {
            minLength: secret.length,
            maxLength: secret.length,
          })
          .map((units) => String.fromCharCode(...units)),
        ip,
        (marker, address) => {
          fc.pre(marker !== secret);
          expect(getClientIp(headers(marker, address, address), secret)).toBe("unknown");
        },
      ),
      options,
    );
  });

  it("ignores spoofed IPs for missing or mismatched markers of any length", () => {
    fc.assert(
      fc.property(
        fc.option(fc.string({ unit: "binary", maxLength: 600 }), { nil: undefined }),
        ip,
        ip,
        (marker, real, forwarded) => {
          fc.pre(marker !== secret);
          expect(getClientIp(headers(marker, real, `${forwarded}, 10.0.0.1`), secret)).toBe(
            "unknown",
          );
        },
      ),
      options,
    );
  });

  it("preserves a verified real IPv4/IPv6 address ahead of forwarding hops", () => {
    fc.assert(
      fc.property(ip, ip, (real, forwarded) => {
        expect(getClientIp(headers(secret, `\t ${real} \t`, forwarded), secret)).toBe(real);
      }),
      options,
    );
  });

  it("does not skip an invalid first forwarding hop to trust a later one", () => {
    fc.assert(
      fc.property(fc.string({ unit: "binary", maxLength: 120 }), ip, (first, later) => {
        fc.pre(isIP(first.split(",", 1)[0].trim()) === 0);
        expect(getClientIp(headers(secret, "not-an-ip", `${first}, ${later}`), secret)).toBe(
          "unknown",
        );
      }),
      options,
    );
  });
});
