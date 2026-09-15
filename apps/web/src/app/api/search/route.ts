import { NextRequest, NextResponse } from "next/server";
import { discoveryService } from "../../../lib/services/discovery-service";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") || "";
  const results = await discoveryService.search(query);
  return NextResponse.json({ query, count: results.length, results });
}
