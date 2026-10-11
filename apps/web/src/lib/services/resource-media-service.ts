import { resourceMediaRepository } from "@nexus/db";
import { AppError } from "@nexus/domain";
import { generateId } from "@nexus/security";
import { storageService } from "@nexus/storage";
import type { ResourceMediaCommand } from "@nexus/validation";
import { buildScannerService } from "./build-scanner-service";
import { normalizeResourceImage } from "./resource-image-normalization";
export const resourceMediaService = {
  managed: (productId: string, actorId: string, staff = false) =>
    resourceMediaRepository.managed(productId, actorId, staff),
  command: (productId: string, actorId: string, command: ResourceMediaCommand) =>
    resourceMediaRepository.command({ productId, actorId, command, auditId: generateId("aud") }),
  async upload(input: {
    productId: string;
    actorId: string;
    expectedUpdatedAt: string;
    caption: string;
    bytes: Buffer;
    signal?: AbortSignal;
  }) {
    const image = await normalizeResourceImage(input.bytes, input.signal);
    input.signal?.throwIfAborted();
    const scan = await buildScannerService.scan({ bytes: image.bytes, fileName: "preview.png" });
    if (scan.status !== "clean" || !scan.scanner.trim() || scan.scanner === "disabled")
      throw new AppError(
        "Image scanner did not approve the image",
        503,
        "RESOURCE_MEDIA_SCAN_REQUIRED",
      );
    input.signal?.throwIfAborted();
    const asset = await storageService.uploadAsset({
      data: image.bytes,
      fileName: "preview.png",
      mimeType: "image/png",
      userId: input.actorId,
      isPrivate: true,
    });
    try {
      input.signal?.throwIfAborted();
      return await resourceMediaRepository.add({
        productId: input.productId,
        actorId: input.actorId,
        expectedUpdatedAt: input.expectedUpdatedAt,
        auditId: generateId("aud"),
        image: {
          id: generateId("rmi"),
          productId: input.productId,
          storageKey: asset.key,
          sha256Hash: asset.sha256Hash,
          fileSizeBytes: asset.sizeBytes,
          width: image.width,
          height: image.height,
          scanner: scan.scanner,
          scannedAt: scan.scannedAt,
          caption: input.caption,
          position: 0,
        },
      });
    } catch (error) {
      // A confirmed domain refusal occurs before commit. Unknown transport/commit failures
      // retain the immutable object rather than deleting an image that may have committed.
      if (error instanceof AppError && error.statusCode >= 400 && error.statusCode < 500) {
        try {
          await storageService.deleteAsset(asset.key);
        } catch {
          /* Maintenance may remove an orphan later. */
        }
      }
      throw error;
    }
  },
};
