import { NextResponse } from "next/server";
/** A twenty-record export, never an unbounded archive or raw audit dump. */
export async function privateChangeHistoryDownload(
  response: Response,
  filename: "profile-history.json" | "organization-activity.json",
  unavailable: string,
) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  if (!response.ok) return response;
  const body = await response.text();
  if (Buffer.byteLength(body, "utf8") > 512 * 1024)
    return NextResponse.json(
      { error: unavailable, code: "INTERNAL_ERROR" },
      { status: 503, headers: response.headers },
    );
  response.headers.set("Content-Disposition", `attachment; filename="${filename}"`);
  return new Response(body, { status: 200, headers: response.headers });
}
