import { NextRequest, NextResponse } from "next/server";
import { can, consumeRateLimit } from "@nexus/security";
import { authService } from "../../../../lib/services/auth-service";
import {
  inspectMtaMetaXml,
  MetaInspectionInputError,
  metaInspectionLimits,
} from "../../../../lib/mta-meta-inspector";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

function contentLengthTooLarge(request: NextRequest): boolean {
  const header = request.headers.get("content-length");
  if (!header) return false;
  const value = Number(header);
  return (
    Number.isFinite(value) &&
    value > metaInspectionLimits.maxBytes
  );
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("nexus_session")?.value;
  const user = await authService.getSession(token);

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401, headers: privateHeaders },
    );
  }

  if (!can(user, "product.create")) {
    return NextResponse.json(
      { error: "Developer access required" },
      { status: 403, headers: privateHeaders },
    );
  }

  const rateLimit = await consumeRateLimit("resourceInspection", user.id);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Too many resource inspections. Please try again shortly." },
      { status: 429, headers: privateHeaders },
    );
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("text/plain")) {
    return NextResponse.json(
      { error: "Send meta.xml as text/plain" },
      { status: 415, headers: privateHeaders },
    );
  }

  if (contentLengthTooLarge(request)) {
    return NextResponse.json(
      {
        error: "meta.xml exceeds the inspection limit",
        maxBytes: metaInspectionLimits.maxBytes,
      },
      { status: 413, headers: privateHeaders },
    );
  }

  try {
    const metaXml = await request.text();
    const inspection = inspectMtaMetaXml(metaXml);
    return NextResponse.json(
      {
        inspection,
        securityVerdict: null,
        note:
          "Static manifest inspection only. This result is not a malware, trust, or archive-integrity verdict.",
      },
      { headers: privateHeaders },
    );
  } catch (error: unknown) {
    if (error instanceof MetaInspectionInputError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          maxBytes: metaInspectionLimits.maxBytes,
        },
        {
          status: error.code === "META_TOO_LARGE" ? 413 : 422,
          headers: privateHeaders,
        },
      );
    }

    return NextResponse.json(
      { error: "Could not inspect meta.xml" },
      { status: 422, headers: privateHeaders },
    );
  }
}
