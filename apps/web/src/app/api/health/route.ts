import { NextResponse } from "next/server";
import { checkDatabaseConnection } from "@nexus/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await checkDatabaseConnection();
    return NextResponse.json(
      { status: "ok", database: "reachable", timestamp: new Date().toISOString() },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Health check failed:", error);
    return NextResponse.json(
      { status: "unavailable", database: "unreachable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
