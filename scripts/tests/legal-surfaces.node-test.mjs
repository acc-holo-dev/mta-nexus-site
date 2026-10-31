import assert from "node:assert/strict";
import test from "node:test";
import { evaluateLegalSurfaces } from "../legal-surfaces-lib.mjs";

test("repository legal surfaces evaluate as passed with linked RU/EN content", () => {
  const result = evaluateLegalSurfaces(process.cwd());
  assert.equal(result.status, "passed");
  assert.deepEqual(result.present, ["/terms", "/privacy", "/community-rules"]);
  assert.match(result.note ?? "", /not legal counsel/iu);
});
