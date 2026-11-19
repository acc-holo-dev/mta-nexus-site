import { AppError } from "@nexus/domain";
import { can, consumeRateLimit } from "@nexus/security";
import type { NextRequest } from "next/server";
import {
  inspectMtaMetaXml,
  MetaInspectionInputError,
  metaInspectionLimits,
} from "../../../../features/resources/mta-meta-inspector";
import { resourceInspectMetaApiCopy } from "../../../../features/resources/resource-inspect-meta-api-copy";
import { readBoundedText } from "../../../../lib/http/bounded-json";
import { withBrowserMutation } from "../../../../lib/http/browser-route-adapter";
import { resolveLocale } from "../../../../lib/i18n";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
  type RequestLogContext,
} from "../../../../lib/platform/observability";
import { authService } from "../../../../lib/services/accounts/auth-service";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

function json(context: RequestLogContext, body: unknown, status = 200) {
  return jsonWithRequestId(context, body, {
    status,
    headers: privateHeaders,
  });
}

export const POST = withBrowserMutation(async (request: NextRequest) => {
  const context = createRequestLogContext(request);
  const copy = resourceInspectMetaApiCopy(
    resolveLocale(request.cookies.get("nexus_locale")?.value),
  );

  try {
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);

    if (!user) {
      return json(context, { error: copy.authenticationRequired }, 401);
    }

    if (!can(user, "product.create")) {
      return json(context, { error: copy.developerRequired }, 403);
    }

    const rateLimit = await consumeRateLimit("resourceInspection", user.id);
    if (!rateLimit.success) {
      return json(
        context,
        {
          error: copy.rate,
        },
        429,
      );
    }

    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
    if (contentType.split(";", 1)[0]?.trim() !== "text/plain") {
      return json(
        context,
        {
          error: copy.textPlainRequired,
        },
        415,
      );
    }

    const metaXml = await readBoundedText(request, metaInspectionLimits.maxBytes);
    const inspection = inspectMtaMetaXml(metaXml);

    return json(context, {
      inspection,
      securityVerdict: null,
      note: copy.note,
    });
  } catch (error: unknown) {
    if (
      error instanceof AppError &&
      ["INVALID_BODY_LENGTH", "REQUEST_BODY_TOO_LARGE", "REQUEST_BODY_TIMEOUT"].includes(error.code)
    ) {
      if (error.code === "REQUEST_BODY_TOO_LARGE") {
        return json(
          context,
          {
            error: copy.exceedsLimit,
            maxBytes: metaInspectionLimits.maxBytes,
          },
          413,
        );
      }
      return json(context, { error: error.message, code: error.code }, error.statusCode);
    }
    if (error instanceof MetaInspectionInputError) {
      return json(
        context,
        {
          error: error.message,
          code: error.code,
          maxBytes: metaInspectionLimits.maxBytes,
        },
        error.code === "META_TOO_LARGE" ? 413 : 422,
      );
    }

    logRequestEvent({
      level: "error",
      event: "resource.meta_inspection_failed",
      context,
      status: 422,
      error,
    });
    return json(
      context,
      {
        error: copy.inspectFailed,
      },
      422,
    );
  }
});
