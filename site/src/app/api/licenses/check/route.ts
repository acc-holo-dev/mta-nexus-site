import { licenseControlsRepository } from "@nexus/db";
import { ValidationError } from "@nexus/domain";
import { licenseRuntimeCheckSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import { readBoundedJson } from "../../../../lib/bounded-json";
import { withLicenseBearerRoute } from "../../../../lib/license-bearer-route-adapter";

export const POST = withLicenseBearerRoute(async (digest, request: NextRequest) => {
  const parsed = licenseRuntimeCheckSchema.safeParse(await readBoundedJson(request, 1024));
  if (!parsed.success) throw new ValidationError("Invalid license check");
  return licenseControlsRepository.verify(digest, parsed.data.serverId);
});
