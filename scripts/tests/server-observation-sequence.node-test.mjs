import assert from "node:assert/strict";
import { test } from "node:test";
import { observationSequenceForEndpoint } from "../../apps/web/src/lib/services/server-observation-sequence.mjs";

const SNAPSHOT = "2026-10-09T07:30:00.000Z";

test("retains the historical identity for endpoint revision zero", () => {
  assert.equal(observationSequenceForEndpoint(SNAPSHOT), SNAPSHOT);
  assert.equal(observationSequenceForEndpoint(SNAPSHOT, 0), SNAPSHOT);
});

test("records each endpoint revision separately within the same master snapshot", () => {
  const ids = [0, 1, 2, 10, 2_147_483_647]
    .map(revision => observationSequenceForEndpoint(SNAPSHOT, revision));
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids[1], SNAPSHOT + "#endpoint-revision=1");
  assert.equal(ids[2], SNAPSHOT + "#endpoint-revision=2");
  assert.equal(observationSequenceForEndpoint(SNAPSHOT, 2), ids[2]);
});

test("different snapshots stay distinct inside the same revision", () => {
  const later = "2026-10-09T07:31:00.000Z";
  assert.notEqual(
    observationSequenceForEndpoint(SNAPSHOT, 1),
    observationSequenceForEndpoint(later, 1),
  );
  assert.notEqual(
    observationSequenceForEndpoint(SNAPSHOT, 0),
    observationSequenceForEndpoint(later, 0),
  );
});

test("rejects missing source identity and invalid endpoint revision", () => {
  assert.throws(() => observationSequenceForEndpoint(""), TypeError);
  for (const revision of [-1, 0.1, NaN, Infinity, 2_147_483_648, null]) {
    assert.throws(
      () => observationSequenceForEndpoint(SNAPSHOT, revision),
      /Invalid server endpoint revision/u,
    );
  }
});
