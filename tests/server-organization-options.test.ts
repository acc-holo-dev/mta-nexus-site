import { describe, expect, it } from "vitest";
import { parseServerOrganizations } from "../apps/web/src/lib/server-organization-options";

const owned = { id: "org_owned", name: "My Organization", slug: "my-organization" };
const delegated = { id: "org_manager", name: "Delegated Team", slug: "delegated-team" };

describe("server registration organization options", () => {
  it("parses bounded options and deduplicates organization IDs", () => {
    expect(parseServerOrganizations({ organizations: [owned, delegated, owned] }))
      .toEqual([owned, delegated]);
    expect(parseServerOrganizations({ organizations: [] })).toEqual([]);
  });

  it.each([
    null,
    {},
    { organizations: {} },
    { organizations: Array.from({ length: 101 }, () => owned) },
    { organizations: [{ ...owned, id: "../escape" }] },
    { organizations: [{ ...owned, name: "" }] },
    { organizations: [{ ...owned, slug: "UPPERCASE" }] },
    { organizations: [owned, null] },
  ])("rejects untrusted or malformed options %j", (payload) => {
    expect(parseServerOrganizations(payload)).toBeNull();
  });
});
