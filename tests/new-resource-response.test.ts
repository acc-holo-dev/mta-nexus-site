import { describe, expect, it } from "vitest";
import { confirmedCreatedResource } from "../apps/web/src/lib/new-resource-response";

const request = {
  title: "Resource title",
  slug: "resource-slug",
  description: "Resource description",
  shortDescription: "",
  type: "script",
  price: 0,
  currency: "USD",
  licenseModel: "unlimited",
  tags: ["lua"],
  compatibility: { mtaMinVersion: "1.6.0", dependencies: ["core-ui"] },
};
const product = { ...request, id: "prd_created", authorId: "author", status: "draft" };
const confirm = (status: number, body: unknown) =>
  confirmedCreatedResource(status, body, "author", request);
describe("new resource creation confirmation", () => {
  it("confirms an owned draft matching the submitted metadata", () => {
    expect(confirm(201, { product })).toEqual({ id: product.id, slug: product.slug });
    expect(confirm(201, { product: { ...product, shortDescription: null } })).not.toBeNull();
  });
  it("allows only an explicitly recovered draft for HTTP200", () => {
    expect(confirm(200, { product, reusedDraft: true })).not.toBeNull();
    expect(confirm(200, { product })).toBeNull();
    expect(confirm(200, { product, reusedDraft: "true" })).toBeNull();
  });
  it.each([
    null,
    {},
    { product: null },
    { product: { ...product, id: "" } },
    { product: { ...product, id: "x".repeat(129) } },
    { product: { ...product, authorId: "someone-else" } },
    { product: { ...product, slug: "different" } },
    { product: { ...product, status: "published" } },
    { product: { ...product, title: "Other title" } },
    { product: { ...product, tags: ["other"] } },
    { product: { ...product, price: 10 } },
    { product: { ...product, compatibility: { ...product.compatibility, dependencies: [] } } },
  ])("does not consume a malformed or unrelated creation result %#", (body) => {
    expect(confirm(201, body)).toBeNull();
  });
  it.each([204, 202, 400, 500])("rejects unsupported response status%s", (status) => {
    expect(confirm(status, { product })).toBeNull();
  });
});
