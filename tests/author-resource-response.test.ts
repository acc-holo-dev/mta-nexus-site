import { describe, expect, it } from "vitest";
import { confirmedAuthorBuild, confirmedAuthorDetails, confirmedRetiredBuild } from "../apps/web/src/lib/author-resource-response";

const details = { title: "A resource", shortDescription: "Brief", description: "A resource description", tags: ["lua"] };
const product = { id: "prd_owned", ...details, updatedAt: "2026-10-05T00:00:00.000Z" };
const build = { id: "bld_new", productId: "prd_owned", version: "1.2.3", status: "pending_review" };

describe("author mutation confirmation", () => {
  it("confirms matching normalized product fields without a success flag", () => {
    expect(confirmedAuthorDetails(200, { product: { ...product, title: ` ${details.title} ` } }, product.id, details)).toEqual({ ...details, updatedAt: product.updatedAt });
  });
  it.each([
    null, {}, { success: true }, { product: null },
    { product: { ...product, id: "prd_other" } },
    { product: { ...product, updatedAt: "invalid" } },
    { product: { ...product, title: "Another resource" } },
    { product: { ...product, tags: ["lua", "extra"] } },
    { product: { ...product, tags: ["other"] } },
    { product: { ...product, description: "" } },
  ])("does not confirm a missing or unrelated metadata result %#", (body) => {
    expect(confirmedAuthorDetails(200, body, product.id, details)).toBeNull();
  });
  it.each([201, 204, 400, 500])("does not accept metadata response status %s", (status) => {
    expect(confirmedAuthorDetails(status, { product }, product.id, details)).toBeNull();
  });
  it("confirms a matching pending build and canonical v-prefixed version", () => {
    expect(confirmedAuthorBuild(201, { build }, product.id, " v1.2.3 ")).toBe(true);
    // Local environments may explicitly disable scanning; this is still a
    // submitted build, never a claim that moderation/scan already passed.
    expect(confirmedAuthorBuild(201, { build: { ...build, scanStatus: "not_scanned" } }, product.id, "1.2.3")).toBe(true);
  });
  it.each([
    null, {}, { build: null }, { build: { ...build, id: "" } },
    { build: { ...build, productId: "prd_other" } },
    { build: { ...build, version: "1.2.4" } },
    { build: { ...build, status: "published" } },
  ])("does not confirm a missing or unrelated build result %#", (body) => {
    expect(confirmedAuthorBuild(201, body, product.id, "1.2.3")).toBe(false);
  });
  it("confirms an explicitly recovered pending build with matching identity", () => {
    expect(confirmedAuthorBuild(200, { build, reusedBuild: true }, product.id, " v1.2.3 ")).toBe(true);
  });
  it.each([
    { build }, { build, reusedBuild: false }, { build, reusedBuild: "true" },
    { build: { ...build, id: "" }, reusedBuild: true },
    { build: { ...build, productId: "prd_other" }, reusedBuild: true },
    { build: { ...build, version: "1.2.4" }, reusedBuild: true },
    { build: { ...build, status: "published" }, reusedBuild: true },
  ])("rejects an ambiguous or unrelated recovery response %#", (body) => {
    expect(confirmedAuthorBuild(200, body, product.id, "1.2.3")).toBe(false);
  });
  it.each([202, 204, 409, 503])("does not recover on status %s", (status) => {
    expect(confirmedAuthorBuild(status, { build, reusedBuild: true }, product.id, "1.2.3")).toBe(false);
  });
  it("rejects false HTTP 200 success and validates retirement identity/status", () => {
    expect(confirmedAuthorBuild(200, { build }, product.id, "1.2.3")).toBe(false);
    expect(confirmedRetiredBuild(200, { build: { ...build, status: "retired" } }, product.id, build.id)).toBe(true);
    expect(confirmedRetiredBuild(200, { build }, product.id, build.id)).toBe(false);
    expect(confirmedRetiredBuild(200, { build: { ...build, status: "retired" } }, "prd_other", build.id)).toBe(false);
    expect(confirmedRetiredBuild(200, { build: { ...build, status: "retired" } }, product.id, "bld_other")).toBe(false);
    expect(confirmedRetiredBuild(204, {}, product.id, build.id)).toBe(false);
  });
});
