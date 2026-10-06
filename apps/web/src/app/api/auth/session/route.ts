import { type NextRequest, NextResponse } from "next/server";
import { authService } from "../../../../lib/services/auth-service";

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("nexus_session")?.value;
    const user = await authService.getSession(token);
    return NextResponse.json({ authenticated: Boolean(user), user: user ?? null }, { headers });
  } catch {
    // A database failure is not proof that the visitor is signed out.
    return NextResponse.json({ error: "Could not check session" }, { status: 503, headers });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get("nexus_session")?.value;
    if (token) await authService.logout(token);

    const response = NextResponse.json({ success: true }, { headers });
    response.cookies.set("nexus_session", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });
    return response;
  } catch {
    // Do not report successful revocation or clear the cookie when it is unconfirmed.
    return NextResponse.json({ error: "Could not confirm sign out. Please try again." }, { status: 503, headers });
  }
}
