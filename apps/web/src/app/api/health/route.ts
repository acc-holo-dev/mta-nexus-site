import type { NextRequest } from "next/server";
import { checkDatabaseConnection } from "@nexus/db";
import {
  createRequestLogContext,
  jsonWithRequestId,
  logRequestEvent,
} from "../../../lib/observability";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const context = createRequestLogContext(request);
  try {
    await checkDatabaseConnection();
    return jsonWithRequestId(
      context,
      { status: "ok", database: "reachable", timestamp: new Date().toISOString() },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    logRequestEvent({
      level: "error",
      event: "health.database_unreachable",
      context,
      status: 503,
      error,
    });
    return jsonWithRequestId(
      context,
      { status: "unavailable", database: "unreachable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
