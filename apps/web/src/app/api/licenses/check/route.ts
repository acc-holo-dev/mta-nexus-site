import type { NextRequest } from "next/server";
import { licenseControlsRepository } from "@nexus/db";
import { ValidationError } from "@nexus/domain";
import { licenseRuntimeCheckSchema } from "@nexus/validation";
import { licenseRuntimeRequest } from "../../../../lib/license-runtime-http";
import { readBoundedJson } from "../../../../lib/bounded-json";
export function POST(request: NextRequest) {
  return licenseRuntimeRequest(request, async (digest) => {
    const parsed = licenseRuntimeCheckSchema.safeParse(await readBoundedJson(request, 1024));
    if (!parsed.success) throw new ValidationError("Invalid license check");
    return licenseControlsRepository.verify(digest, parsed.data.serverId);
  });
}
