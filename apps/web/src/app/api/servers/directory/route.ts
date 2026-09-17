import { NextResponse } from "next/server";
import { mtaMasterDirectoryService } from "../../../../lib/services/mta-master-directory-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const directory = await mtaMasterDirectoryService.getDirectory();
    return NextResponse.json(directory, {
      headers: {
        "Cache-Control": "public, max-age=30, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    console.error("MTA directory API error:", error);
    return NextResponse.json(
      { error: "The official MTA server directory is temporarily unavailable" },
      { status: 503, headers: { "Retry-After": "30" } }
    );
  }
}
