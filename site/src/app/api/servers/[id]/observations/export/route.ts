import type { NextRequest } from "next/server";
import { serverObservationBrowserHttp } from "../../../../../../features/servers/server-observation-browser-http";
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return serverObservationBrowserHttp(request, (await params).id, false, true);
}
