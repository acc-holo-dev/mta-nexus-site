import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  serverHistoryService,
  serverHistoryWindows,
} from "../../../../../lib/services/server-history-service";

export const dynamic = "force-dynamic";

const historyQuerySchema = z.object({
  window: z.enum(["24h", "7d", "30d"]).default("24h"),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const parsed = historyQuerySchema.safeParse({
    window: request.nextUrl.searchParams.get("window") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid history window",
        allowedWindows: Object.keys(serverHistoryWindows),
      },
      {
        status: 400,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  try {
    const { id } = await params;
    const history = await serverHistoryService.getHistory(id, parsed.data.window);
    if (!history) {
      return NextResponse.json(
        { error: "Server not found" },
        {
          status: 404,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    return NextResponse.json(history, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Server history is temporarily unavailable" },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": "30",
        },
      },
    );
  }
}
