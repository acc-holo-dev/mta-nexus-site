import { NextResponse } from "next/server";
import { mtaMasterDirectoryService } from "../../../lib/services/mta-master-directory-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const directory = await mtaMasterDirectoryService.getDirectory();
    const playersOnline = directory.servers.reduce((total, server) => total + (server.players ?? 0), 0);

    return NextResponse.json({
      source: "mta-master",
      fetchedAt: directory.fetchedAt,
      playersOnline,
      servers: directory.servers,
    });
  } catch (error) {
    console.error("MTA master directory error:", error);
    return NextResponse.json(
      { error: "MTA server directory is temporarily unavailable" },
      { status: 503 }
    );
  }
}
