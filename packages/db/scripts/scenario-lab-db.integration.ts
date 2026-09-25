import assert from "node:assert/strict";

import { closeDatabaseConnection } from "../src/client";
import {
  applyScenario,
  cleanupScenario,
  type ScenarioId,
} from "./scenario-lab-db";

if (
  process.env.GITHUB_ACTIONS !== "true" ||
  process.env.RUNNER_ENVIRONMENT !== "github-hosted" ||
  process.env.NODE_ENV !== "test"
) {
  throw new Error("Refusing Scenario Lab DB integration outside disposable hosted CI");
}

const scenarios: readonly ScenarioId[] = [
  "expired-session",
  "private-server-owner",
  "moderation-queue",
  "resource-scan-pending",
];

try {
  for (const scenario of scenarios) {
    const first = await applyScenario(scenario);
    assert.equal(first.scenario, scenario);
    assert.equal(first.action, "applied");
    assert(first.created && first.created.length >= 2);
    assert(first.created.every((id) => id.startsWith("scn_")));

    if (first.session) {
      assert.equal(first.session.cookieName, "nexus_session");
      assert.match(first.session.token, /^[A-Za-z0-9_-]{43}$/u);
      const expiry = Date.parse(first.session.expiresAt);
      assert(Number.isFinite(expiry));
      if (scenario === "expired-session") {
        assert(expiry < Date.now(), "expired-session must actually be expired");
      } else {
        assert(expiry > Date.now(), `${scenario} session must be active`);
      }
    }

    // Apply is intentionally idempotent: the scenario transaction first removes
    // only its own known rows, then recreates them.
    const second = await applyScenario(scenario);
    assert.equal(second.action, "applied");
    assert.deepEqual(second.created, first.created);

    const cleaned = await cleanupScenario(scenario);
    assert.deepEqual(cleaned, { scenario, action: "cleaned" });

    // Cleanup is also idempotent and must not depend on the rows still existing.
    const cleanedAgain = await cleanupScenario(scenario);
    assert.deepEqual(cleanedAgain, { scenario, action: "cleaned" });
  }

  process.stdout.write(
    "PASS: Scenario Lab apply/re-apply/cleanup contracts on disposable CI database\n",
  );
} finally {
  await closeDatabaseConnection();
}
