import { expect, it } from "vitest";
import {
  assertDevelopmentSeedAllowed,
  DEMO_SEED_ACKNOWLEDGEMENT,
} from "../../site/packages/db/src/seed-safety";

const configuration = {
  NODE_ENV: "development",
  DATABASE_URL: "postgres://nexus:secret@127.0.0.1:5432/mta_nexus",
};

it("requires an explicit development-only acknowledgement", () => {
  expect(() => assertDevelopmentSeedAllowed(configuration, {})).toThrow(
    "NEXUS_DEMO_SEED_ACK=development-only",
  );
  expect(() =>
    assertDevelopmentSeedAllowed(configuration, {
      NEXUS_DEMO_SEED_ACK: DEMO_SEED_ACKNOWLEDGEMENT,
    }),
  ).not.toThrow();
});

it("rejects production even with the acknowledgement", () => {
  expect(() =>
    assertDevelopmentSeedAllowed(
      { ...configuration, NODE_ENV: "production" },
      { NEXUS_DEMO_SEED_ACK: DEMO_SEED_ACKNOWLEDGEMENT },
    ),
  ).toThrow("disabled in production");
});

it.each([
  "not-a-url",
  "https://database.example/mta_nexus",
  "postgres://nexus:secret@127.0.0.1:5432",
])("rejects an invalid database target before seeding (%s)", (DATABASE_URL) => {
  expect(() =>
    assertDevelopmentSeedAllowed(
      { ...configuration, DATABASE_URL },
      { NEXUS_DEMO_SEED_ACK: DEMO_SEED_ACKNOWLEDGEMENT },
    ),
  ).toThrow();
});
