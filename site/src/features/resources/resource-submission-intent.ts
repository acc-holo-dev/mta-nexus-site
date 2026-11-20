import { createProductSchema } from "@nexus/validation";
import type { z } from "zod";

export type ResourceSubmissionIntent = {
  actorId: string;
  request: z.input<typeof createProductSchema> | null;
  product: { id: string; slug: string; mtaVersionTarget: string } | null;
  build: {
    version: string;
    releaseNotes: string;
    mtaVersionTarget: string;
    fileName: string;
    size: number;
    sha256: string;
  };
};
export function resourceIntentKey(actorId: string) {
  return `nexus:resource-submission:v1:${encodeURIComponent(actorId)}`;
}
export function parseResourceIntent(
  raw: string | null,
  actorId: string,
): ResourceSubmissionIntent | null {
  if (!raw || raw.length > 40_000) return null;
  try {
    const item = JSON.parse(raw);
    if (
      item.actorId !== actorId ||
      (item.request !== null && !createProductSchema.safeParse(item.request).success) ||
      (item.request === null && !item.product) ||
      !item.build ||
      typeof item.build.version !== "string" ||
      item.build.version.length > 64 ||
      typeof item.build.releaseNotes !== "string" ||
      item.build.releaseNotes.length > 5000 ||
      typeof item.build.mtaVersionTarget !== "string" ||
      item.build.mtaVersionTarget.length > 64 ||
      typeof item.build.fileName !== "string" ||
      item.build.fileName.length > 255 ||
      !Number.isSafeInteger(item.build.size) ||
      item.build.size < 1 ||
      item.build.size > 64 * 1024 * 1024 ||
      typeof item.build.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/u.test(item.build.sha256) ||
      (item.product !== null &&
        (!item.product ||
          typeof item.product.id !== "string" ||
          !/^[A-Za-z0-9_-]{1,128}$/u.test(item.product.id) ||
          (item.request && item.product.slug !== item.request.slug) ||
          item.product.mtaVersionTarget !== item.build.mtaVersionTarget))
    )
      return null;
    return item as ResourceSubmissionIntent;
  } catch {
    return null;
  }
}
export async function resourceFileHash(file: File) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
