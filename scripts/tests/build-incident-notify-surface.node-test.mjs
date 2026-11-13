import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { RELEASE_UPGRADE_TARGET_TAG } from "../../packages/db/scripts/release-upgrade-contract.mjs";

const read = (path) => readFileSync(resolve(process.cwd(), path), "utf8");

test("SEC-002 build-incident delivery lands with explicit quarantine opt-in", () => {
  const journal = JSON.parse(read("packages/db/migrations/meta/_journal.json"));
  assert.ok(
    journal.entries.some((entry) => entry.tag === "0085_build_incident_notification_delivery"),
  );
  assert.equal(journal.entries.at(-1)?.tag, RELEASE_UPGRADE_TARGET_TAG);
  assert.match(
    read("packages/db/migrations/0085_build_incident_notification_delivery.sql"),
    /build_incident_notification_deliveries/u,
  );
  assert.match(
    read("packages/db/src/repositories/builds-lifecycle.ts"),
    /notifyAffectedDownloaders === true/u,
  );
  assert.match(
    read("packages/db/src/repositories/builds-lifecycle.ts"),
    /buildIncidentNotificationDeliveries/u,
  );
  assert.match(read("site/src/app/api/admin/actions/route.ts"), /notifyAffectedDownloaders/u);
  assert.match(
    read("site/src/components/build-quarantine-controls.tsx"),
    /notifyAffectedDownloaders/u,
  );
  assert.match(read("packages/db/scripts/run-web-push-dispatcher.ts"), /build-incident-delivery/u);
  const delivery = read("packages/db/src/repositories/build-incident-notification-delivery.ts");
  assert.match(delivery, /\/workspace\/library\/\$\{encodeURIComponent\(productId\)\}\/versions/u);
  assert.match(delivery, /\/workspace\/library\/updates/u);
  assert.doesNotMatch(delivery, /link:\s*"\/security"/u);
  const lifecycle = read("packages/db/src/repositories/builds-lifecycle.ts");
  assert.doesNotMatch(
    lifecycle,
    /insert\(buildIncidentNotificationDeliveries\)[\s\S]*notifyAffectedDownloaders !== false/u,
  );
});
