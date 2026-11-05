import { describe, expect, it } from "vitest";
import {
  batches,
  duringWait,
  fixture,
  randomUUID,
  sessionRepository,
  state,
} from "./helpers/library-selection-batches-session-harness";

describe("library selection batches session: authority lock revocation", () => {
  for (const target of [
    "account",
    "selection-advisory",
    "actor",
    "collection",
    "member",
    "product",
    "grant",
    "selection",
    "build",
  ] as const) {
    it(`rejects revocation during the ${target} authority lock wait`, async () => {
      const f = await fixture();
      if (target === "selection") {
        await batches.command(f.input);
        const preview = await batches.preview(f.userId, f.collectionId, {
          mode: "latest",
          productIds: [f.productId],
        });
        f.input.command = {
          ...f.input.command,
          ...preview.choice,
          requestId: randomUUID(),
          previewDigest: preview.previewDigest,
        };
        f.input.receiptId += "_next";
        f.input.auditId += "_next";
      }
      const before = await state(f);
      expect(await duringWait(f, target, () => sessionRepository.delete(f.token))).toMatchObject({
        error: { code: "UNAUTHORIZED" },
      });
      expect(await state(f)).toEqual(before);
    }, 20000);
  }
});
