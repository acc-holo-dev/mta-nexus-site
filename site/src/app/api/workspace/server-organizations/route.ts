import { organizationRepository } from "@nexus/db";
import type { NextRequest } from "next/server";
import { serverOrganizationsApiCopy } from "../../../../features/servers/server-organizations-api-copy";
import { resolveLocale } from "../../../../lib/i18n";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
} from "../../../../lib/platform/observability";
import { authService } from "../../../../lib/services/accounts/auth-service";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

export async function GET(request: NextRequest) {
  const context = createRequestLogContext(request);
  const copy = serverOrganizationsApiCopy(
    resolveLocale(request.cookies.get("nexus_locale")?.value),
  );
  try {
    const user = await authService.getSession(request.cookies.get("nexus_session")?.value);
    if (!user) {
      return jsonWithRequestId(
        context,
        { error: copy.authenticationRequired },
        { status: 401, headers: privateHeaders },
      );
    }

    const organizations = await organizationRepository.listServerManageableByUser(user.id);
    return jsonWithRequestId(context, { organizations }, { headers: privateHeaders });
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
      { error: copy.unavailable },
      { status: 503, headers: privateHeaders },
    );
  }
}
