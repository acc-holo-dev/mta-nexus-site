import { NextResponse } from "next/server";
import { checkDatabaseConnection } from "@nexus/db";

export async function GET() {
  const start = Date.now();
  try {
    await checkDatabaseConnection();
    const latencyMs = Date.now() - start;
    return NextResponse.json({
      status: "ok",
      database: "PostgreSQL",
      latencyMs,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: "error",
        database: "PostgreSQL",
        error: error.message || "Database connection check failed",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
