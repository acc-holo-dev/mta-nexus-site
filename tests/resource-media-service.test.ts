import { createHash } from "node:crypto";
import { AppError } from "@nexus/domain";
import { beforeEach, expect, it, vi } from "vitest";
import images from "./fixtures/resource-images.json";

const state = vi.hoisted(() => ({ add: vi.fn(), scan: vi.fn(), upload: vi.fn(), remove: vi.fn() }));
vi.mock("@nexus/db", () => ({ resourceMediaRepository: { add: state.add } }));
vi.mock("@nexus/storage", () => ({
  storageService: { uploadAsset: state.upload, deleteAsset: state.remove },
}));
vi.mock("../apps/web/src/lib/services/build-scanner-service", () => ({
  buildScannerService: { scan: state.scan },
}));

import { resourceMediaService as service } from "../apps/web/src/lib/services/resource-media-service";

const input = {
  productId: "prd_a",
  actorId: "usr_a",
  expectedUpdatedAt: "2026-10-11T00:00:00Z",
  caption: "Caption",
  bytes: Buffer.from(images.jpeg, "base64"),
};
beforeEach(() => {
  vi.clearAllMocks();
  state.scan.mockResolvedValue({ status: "clean", scanner: "clamav", scannedAt: new Date() });
  state.upload.mockImplementation(async ({ data }) => ({
    key: "assets/usr_a/ast_a.png",
    sizeBytes: data.length,
    sha256Hash: createHash("sha256").update(data).digest("hex"),
  }));
  state.add.mockResolvedValue({ product: { id: "prd_a" }, items: [] });
});
it("scans and persists the normalized artifact, not original JPEG bytes or EXIF metadata", async () => {
  await service.upload(input);
  const scanned = state.scan.mock.calls[0]?.[0];
  expect(scanned.bytes).not.toEqual(input.bytes);
  expect(scanned.fileName).toBe("preview.png");
  expect(state.upload.mock.calls[0]?.[0].data).toEqual(scanned.bytes);
  expect(state.upload.mock.calls[0]?.[0]).toMatchObject({ mimeType: "image/png", isPrivate: true });
  expect(state.add.mock.calls[0]?.[0]).toMatchObject({
    actorId: "usr_a",
    productId: "prd_a",
    image: { width: 16, height: 32, scanner: "clamav", caption: "Caption" },
  });
});
it.each(["not_scanned", "malicious", "rejected", "error"])(
  "fails closed on scanner status %s",
  async (status) => {
    state.scan.mockResolvedValue({ status, scanner: "clamav" });
    await expect(service.upload(input)).rejects.toMatchObject({
      code: "RESOURCE_MEDIA_SCAN_REQUIRED",
    });
    expect(state.upload).not.toHaveBeenCalled();
    expect(state.add).not.toHaveBeenCalled();
  },
);
it("removes the freshly written artifact after a confirmed stale-revision refusal", async () => {
  state.add.mockRejectedValue(new AppError("Changed", 409, "RESOURCE_MEDIA_CONFLICT"));
  await expect(service.upload(input)).rejects.toMatchObject({ code: "RESOURCE_MEDIA_CONFLICT" });
  expect(state.remove).toHaveBeenCalledWith("assets/usr_a/ast_a.png");
});
it("preserves bytes when a commit outcome is uncertain", async () => {
  state.add.mockRejectedValue(new Error("Transport failed after commit"));
  await expect(service.upload(input)).rejects.toThrow("Transport failed after commit");
  expect(state.remove).not.toHaveBeenCalled();
});
