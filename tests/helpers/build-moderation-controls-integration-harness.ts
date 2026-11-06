import { NextRequest } from "next/server";
import { browserMutationHeaders } from "../browser-mutation-headers";
import { INTEGRATION_STAFF_PASSWORD } from "../integration-staff-password";

/** Authenticated GET for reviewer artifact download. */
export function getRequest(token: string, buildId: string) {
  return new NextRequest(`http://nexus.test/api/admin/builds/${buildId}/download`, {
    method: "GET",
    headers: {
      cookie: `nexus_session=${token}`,
    },
  });
}

/** Authenticated POST for build moderation admin actions. */
export function moderationRequest(
  token: string,
  buildId: string,
  action: "approve" | "reject" | "quarantine" | "restore",
  notes?: string,
) {
  return new NextRequest("http://nexus.test/api/admin/actions", {
    method: "POST",
    headers: browserMutationHeaders({
      "content-type": "application/json",
      cookie: `nexus_session=${token}`,
    }),
    body: JSON.stringify({
      targetType: "build",
      expectedRevision: 1,
      targetId: buildId,
      action,
      ...(notes === undefined ? {} : { notes }),
      currentPassword: INTEGRATION_STAFF_PASSWORD,
    }),
  });
}
