import type { NextRequest } from "next/server";
import { licenseControlsRepository } from "@nexus/db";
import { ValidationError } from "@nexus/domain";
import { licenseReleaseCheckSchema } from "@nexus/validation";
import { withLicenseBearerRoute } from "../../../../lib/license-bearer-route-adapter";
import { readBoundedJson } from "../../../../lib/bounded-json";

export const POST = withLicenseBearerRoute(async (digest, request: NextRequest) => {
  const parsed = licenseReleaseCheckSchema.safeParse(await readBoundedJson(request, 2048));
  if (!parsed.success) throw new ValidationError("Invalid release check");
  return licenseControlsRepository.verifyRelease(digest, parsed.data);
});
