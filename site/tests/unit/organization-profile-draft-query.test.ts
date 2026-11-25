import { expect, it } from "vitest";
import {
  applyOrganizationProfileDraftQuery,
  readOrganizationProfileDraftQuery,
} from "../../src/features/organizations/components/organization-profile-form";

it("round-trips a populated organization name and description through the query string", () => {
  const name = "Night Garage";
  const description = "A long draft\nkept for the browser Back button.";
  const params = applyOrganizationProfileDraftQuery(new URLSearchParams("tab=profile"), {
    name,
    description,
    slug: "night-garage",
    logoUrl: "https://cdn.example/logo.png",
    websiteUrl: "https://night.example",
  });
  const query = params.toString();
  const restored = readOrganizationProfileDraftQuery(new URLSearchParams(query));
  expect(restored?.name).toBe(name);
  expect(restored?.description).toBe(description);
  expect(restored?.slug).toBe("night-garage");
  expect(restored?.logoUrl).toBe("https://cdn.example/logo.png");
  expect(restored?.websiteUrl).toBe("https://night.example");
  expect(new URLSearchParams(query).get("tab")).toBe("profile");
  expect(query).not.toMatch(/token|password|role/i);
});
