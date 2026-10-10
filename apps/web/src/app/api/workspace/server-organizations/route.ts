import type { NextRequest } from "next/server";
import { organizationRepository } from "@nexus/db";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
} from "../../../../lib/observability";
import { authService } from "../../../../lib/services/auth-service";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

export async function GET(request: NextRequest) {
  const context = createRequestLogContext(request);
  try {
    const user = await authService.getSession(
      request.cookies.get("nexus_session")?.value,
    );
    if (!user) {
      return jsonWithRequestId(
        context,
        { error: "Authentication required" },
        { status: 401, headers: privateHeaders },
      );
    }

    const organizations = await organizationRepository.listServerManageableByUser(
      user.id,
    );
    return jsonWithRequestId(
      context,
      { organizations },
      { headers: privateHeaders },
    );
  } catch (error) {
    logRequestEvent({
      level: "error",
      event: "server_registration.organizations_failed",
      context,
      status: 503,
      error,
    });
    return jsonWithRequestId(
      context,
      { error: "Organization options temporarily unavailable" },
      { status: 503, headers: privateHeaders },
    );
  }
}
