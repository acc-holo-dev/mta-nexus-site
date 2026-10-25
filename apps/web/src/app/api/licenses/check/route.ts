import type { NextRequest } from "next/server";
import { licenseControlsRepository } from "@nexus/db";
import { ValidationError } from "@nexus/domain";
import { licenseRuntimeCheckSchema } from "@nexus/validation";
import { withLicenseBearerRoute } from "../../../../lib/license-bearer-route-adapter";
import { readBoundedJson } from "../../../../lib/bounded-json";

export const POST = withLicenseBearerRoute(async (digest, request: NextRequest) => {
  const parsed = licenseRuntimeCheckSchema.safeParse(await readBoundedJson(request, 1024));
  if (!parsed.success) throw new ValidationError("Invalid license check");
  return licenseControlsRepository.verify(digest, parsed.data.serverId);
});
