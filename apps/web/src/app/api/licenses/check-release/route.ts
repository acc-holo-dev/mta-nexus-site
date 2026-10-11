import type { NextRequest } from "next/server";
import { licenseControlsRepository } from "@nexus/db";
import { ValidationError } from "@nexus/domain";
import { licenseReleaseCheckSchema } from "@nexus/validation";
import { licenseRuntimeRequest } from "../../../../lib/license-runtime-http";
import { readBoundedJson } from "../../../../lib/bounded-json";
export function POST(request: NextRequest) {
  return licenseRuntimeRequest(request, async (digest) => {
    const parsed = licenseReleaseCheckSchema.safeParse(await readBoundedJson(request, 2048));
    if (!parsed.success) throw new ValidationError("Invalid release check");
    return licenseControlsRepository.verifyRelease(digest, parsed.data);
  });
}
