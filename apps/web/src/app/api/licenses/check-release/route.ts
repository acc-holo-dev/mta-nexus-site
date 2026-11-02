import { licenseControlsRepository } from "@nexus/db";
import { ValidationError } from "@nexus/domain";
import { licenseReleaseCheckSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import { readBoundedJson } from "../../../../lib/bounded-json";
import { withLicenseBearerRoute } from "../../../../lib/license-bearer-route-adapter";

export const POST = withLicenseBearerRoute(async (digest, request: NextRequest) => {
  const parsed = licenseReleaseCheckSchema.safeParse(await readBoundedJson(request, 2048));
  if (!parsed.success) throw new ValidationError("Invalid release check");
  return licenseControlsRepository.verifyRelease(digest, parsed.data);
});
