import type { User } from "@nexus/domain";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ command: vi.fn(), preview: vi.fn(), history: vi.fn() }));
vi.mock("@nexus/db", () => ({ librarySelectionBatchesRepository: state }));
vi.mock("@nexus/security", () => ({ generateId: (prefix: string) => `${prefix}_fixture` }));
import { librarySelectionBatchesService as service } from "../apps/web/src/lib/services/library-selection-batches-service";

const actor = { id: "usr_a" } as User;
const command = {
  mode: "fixed",
  productIds: ["prd_a"],
  requestId: "f88ec3b3-b1f8-4af8-87b9-3f9f6f6cba92",
  previewDigest: "a".repeat(64),
};
beforeEach(() => vi.clearAllMocks());
it("passes only the initiating browser token as repository authorization", async () => {
  await service.command(actor, "lcol_a", command, "raw-browser-token");
  expect(state.command).toHaveBeenCalledWith({
    userId: actor.id,
    currentToken: "raw-browser-token",
    collectionId: "lcol_a",
    command,
    receiptId: "lsbr_fixture",
    auditId: "aud_fixture",
  });
});
it("keeps session tokens outside the command schema", () => {
  expect(() =>
    service.command(actor, "lcol_a", { ...command, currentToken: "forged" }, "real"),
  ).toThrow(expect.objectContaining({ code: "SELECTION_BATCH_INVALID" }));
  expect(state.command).not.toHaveBeenCalled();
});
