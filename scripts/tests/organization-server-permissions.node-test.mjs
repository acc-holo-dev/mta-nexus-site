import assert from "node:assert/strict";
import { test } from "node:test";
import { grantsServerManagement } from "../../packages/domain/src/organization-server-permissions.ts";

for (const [label, membership, allowed] of [
  // Owner authority is proven via the organization row, not this membership helper.
  ["organization owner role", { role: "owner", permissions: [] }, false],
  ["organization admin role", { role: "admin", permissions: [] }, true],
  ["delegated server manager", { role: "member", permissions: ["manage_servers"] }, true],
  [
    "developer with explicit delegation",
    { role: "developer", permissions: ["manage_servers"] },
    true,
  ],
  ["product manager only", { role: "member", permissions: ["manage_products"] }, false],
  ["ordinary member", { role: "member", permissions: [] }, false],
  ["developer without delegation", { role: "developer", permissions: [] }, false],
  ["role name case mismatch", { role: "Admin", permissions: [] }, false],
  ["permission name case mismatch", { role: "member", permissions: ["MANAGE_SERVERS"] }, false],
  ["empty permissions", { role: "member", permissions: null }, false],
  ["missing membership", null, false],
  ["undefined membership", undefined, false],
]) {
  test(label, () => assert.equal(grantsServerManagement(membership), allowed));
}
