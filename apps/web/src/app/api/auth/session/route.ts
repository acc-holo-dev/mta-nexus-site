import { NextRequest, NextResponse } from "next/server";
import { authService } from "../../../../lib/services/auth-service";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("nexus_session")?.value;
  const user = await authService.getSession(token);

  if (!user) {
    return NextResponse.json({ authenticated: false, user: null });
  }

  return NextResponse.json({ authenticated: true, user });
}

export async function DELETE(request: NextRequest) {
  const token = request.cookies.get("nexus_session")?.value;
  if (token) {
    await authService.logout(token);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.delete("nexus_session");
  return response;
}
