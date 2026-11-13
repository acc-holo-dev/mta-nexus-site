import { AppError, RESOURCE_MEDIA_INPUT_BYTES, RESOURCE_MEDIA_OUTPUT_BYTES } from "@nexus/domain";
import sharp from "sharp";

let active = 0;
const invalid = () =>
  new AppError("Use a valid static PNG, JPEG or WebP image", 422, "RESOURCE_MEDIA_INVALID");
/** The original bytes/metadata are never stored or served. */
export async function normalizeResourceImage(bytes: Buffer, signal?: AbortSignal) {
  signal?.throwIfAborted();
  if (!bytes.length || bytes.length > RESOURCE_MEDIA_INPUT_BYTES) throw invalid();
  const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp =
    bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP";
  if (!png && !jpeg && !webp) throw invalid();
  // Sharp does not support every APNG frame; explicitly reject its animation declaration.
  if (png) {
    let at = 8;
    while (at + 12 <= bytes.length) {
      const length = bytes.readUInt32BE(at);
      const type = bytes.subarray(at + 4, at + 8).toString("ascii");
      if (type === "acTL") throw invalid();
      if (length > bytes.length - at - 12) throw invalid();
      at += length + 12;
      if (type === "IEND") break;
    }
  }
  if (active >= 2) throw new AppError("Image processor is busy", 503, "RESOURCE_MEDIA_BUSY");
  active++;
  const pipeline = sharp(bytes, { failOn: "warning", limitInputPixels: 16 * 1024 * 1024 });
  const cancel = () => {
    pipeline.destroy();
  };
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    signal?.throwIfAborted();
    const meta = await pipeline.metadata();
    if (
      !meta.width ||
      !meta.height ||
      meta.width > 4096 ||
      meta.height > 4096 ||
      (meta.pages ?? 1) !== 1 ||
      !["png", "jpeg", "webp"].includes(meta.format)
    )
      throw invalid();
    const result = await pipeline
      .rotate()
      .resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true })
      .toColourspace("srgb")
      .png({ compressionLevel: 9 })
      .timeout({ seconds: 10 })
      .toBuffer({ resolveWithObject: true });
    signal?.throwIfAborted();
    if (!result.data.length || result.data.length > RESOURCE_MEDIA_OUTPUT_BYTES)
      throw new AppError("Normalized image exceeds the size limit", 422, "RESOURCE_MEDIA_LIMIT");
    return { bytes: result.data, width: result.info.width, height: result.info.height };
  } catch (error) {
    signal?.throwIfAborted();
    if (error instanceof AppError) throw error;
    throw invalid();
  } finally {
    signal?.removeEventListener("abort", cancel);
    pipeline.destroy();
    active--;
  }
}
