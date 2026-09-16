import { NextResponse } from "next/server";
import { getStorageProvider } from "@nexus/storage";

export async function GET() {
  const start = Date.now();
  try {
    const storage = getStorageProvider();
    await storage.exists("__healthcheck__");
    const latencyMs = Date.now() - start;

    return NextResponse.json({
      status: "ok",
      provider: process.env.STORAGE_PROVIDER || "local",
      latencyMs,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: "error",
        provider: process.env.STORAGE_PROVIDER || "local",
        error: error.message || "Storage access check failed",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
