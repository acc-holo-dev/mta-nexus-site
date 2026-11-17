import type { NextRequest } from "next/server";
import { serverStatisticsHttp } from "../../../../../features/servers/server-statistics-http";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return serverStatisticsHttp(request, (await params).id, false);
}
