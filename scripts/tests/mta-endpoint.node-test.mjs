import assert from "node:assert/strict";
import { test } from "node:test";

import { isValidMtaAddress, normalizeMtaAddress } from "../../packages/domain/src/mta-endpoint.ts";

// Independent of Vitest and PostgreSQL: runs in the existing tooling suite
// with Node.js 26 native TypeScript stripping.
const valid = [
  ["  PLAY.Example.COM.  ", "play.example.com"],
  ["198.51.100.7", "198.51.100.7"],
  ["[2001:DB8::1]", "[2001:db8::1]"],
  ["fe80::ABCD", "[fe80::abcd]"],
  ["local-mta", "local-mta"],
  ["127.1", "127.0.0.1"],
  ["2001:0DB8:0000:0000:0000:0000:0000:0001", "[2001:db8::1]"],
  ["bücher.de", "xn--bcher-kva.de"],
  ["::1", "[::1]"],
  ["::ffff:192.0.2.1", "[::ffff:c000:201]"],
  ["[fe80::abcd]", "[fe80::abcd]"],
  ["example.com.", "example.com"],
];

const invalid = [
  "",
  " ",
  ".",
  "..",
  "bad..com",
  "play.example..",
  "127.0.0.999",
  "2001:::zzzz",
  "[::1]:22003",
  "bad_name.example",
  "host.example:22003",
  "http://example.com",
  "user@example.com",
  "host\\path",
  "bad\nhost",
  "a".repeat(256),
  "fe80::abcd.",
  "[fe80::abcd].",
  "2001:db8::1..",
  "::1:22003:999999",
];

for (const [input, expected] of valid) {
  test(`canonical endpoint ${JSON.stringify(input)}`, () => {
    assert.equal(normalizeMtaAddress(input), expected);
    assert.equal(normalizeMtaAddress(expected), expected);
    assert.equal(isValidMtaAddress(expected), true);
  });
}

for (const input of invalid) {
  test(`invalid endpoint ${JSON.stringify(input)}`, () => {
    assert.equal(isValidMtaAddress(normalizeMtaAddress(input)), false);
  });
}

test("equivalent IPv6 notations cannot become separate keys", () => {
  const addresses = ["fe80::ABCD", "[fe80::abcd]", "fe80:0:0:0:0:0:0:abcd"];
  const keys = new Set(
    addresses.map((value) => JSON.stringify([normalizeMtaAddress(value), 22003])),
  );
  assert.equal(keys.size, 1);
});
