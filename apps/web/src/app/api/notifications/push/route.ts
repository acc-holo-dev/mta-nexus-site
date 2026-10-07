import { readWebPushVapidConfig } from "@nexus/config";
import { NextResponse, type NextRequest } from "next/server";
import { webPushSubscriptionRepository } from "@nexus/db";
import { consumeRateLimit, generateId } from "@nexus/security";
import { parseWebPushSubscription } from "../../../../lib/web-push-subscription";
import { authService } from "../../../../lib/services/auth-service";

const privateHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie" };

function publicKey() {
  try {
    return readWebPushVapidConfig()?.publicKey ?? null;
  } catch {
    return null;
  }
}

async function requireSession(request: NextRequest) {
  const token = request.cookies.get("nexus_session")?.value;
  const [user, sessionId] = await Promise.all([
    authService.getSession(token),
    authService.getCurrentSessionId(token),
  ]);
  return user && sessionId ? { user, sessionId } : null;
}

export async function GET(request: NextRequest) {
  const authenticated = await requireSession(request);
  if (!authenticated) return NextResponse.json({ error: "Authentication required" }, { status: 401, headers: privateHeaders });

  const key = publicKey();
  const subscriptionCount = await webPushSubscriptionRepository.countForSession(authenticated.user.id, authenticated.sessionId);
  return NextResponse.json({ configured: key !== null, publicKey: key, subscribed: subscriptionCount > 0 }, { headers: privateHeaders });
}

export async function POST(request: NextRequest) {
  const authenticated = await requireSession(request);
  if (!authenticated) return NextResponse.json({ error: "Authentication required" }, { status: 401, headers: privateHeaders });
  if (!publicKey()) return NextResponse.json({ error: "Web Push is not configured" }, { status: 503, headers: privateHeaders });

  const limit = await consumeRateLimit("notificationMutation", authenticated.user.id);
  if (!limit.success) return NextResponse.json({ error: "Too many notification updates. Please try again shortly." }, { status: 429, headers: privateHeaders });

  const parsed = parseWebPushSubscription(await request.json().catch(() => null));
  if (!parsed) return NextResponse.json({ error: "Invalid Web Push subscription" }, { status: 400, headers: privateHeaders });

  const stored = await webPushSubscriptionRepository.upsertWithResult({
    id: generateId("wps"),
    userId: authenticated.user.id,
    sessionId: authenticated.sessionId,
    endpoint: parsed.endpoint,
    p256dh: parsed.p256dh,
    auth: parsed.auth,
    expirationAt: parsed.expirationAt,
    userAgent: request.headers.get("user-agent"),
  });
  if (stored.status !== "stored") {
    const endpointConflict = stored.status === "endpoint_conflict";
    return NextResponse.json(
      {
        error: endpointConflict
          ? "Web Push endpoint is already bound to another session"
          : "Too many Web Push subscriptions for this session",
        code: endpointConflict
          ? "WEB_PUSH_ENDPOINT_CONFLICT"
          : "WEB_PUSH_SESSION_LIMIT",
      },
      { status: 409, headers: privateHeaders },
    );
  }
  return NextResponse.json(
    { success: true, subscribed: true },
    { headers: privateHeaders },
  );
}

export async function DELETE(request: NextRequest) {
  const authenticated = await requireSession(request);
  if (!authenticated) return NextResponse.json({ error: "Authentication required" }, { status: 401, headers: privateHeaders });

  const limit = await consumeRateLimit("notificationMutation", authenticated.user.id);
  if (!limit.success) return NextResponse.json({ error: "Too many notification updates. Please try again shortly." }, { status: 429, headers: privateHeaders });

  const body = await request.json().catch(() => null);
  const endpoint = body && typeof body === "object" && !Array.isArray(body) && typeof (body as Record<string, unknown>).endpoint === "string"
    ? String((body as Record<string, unknown>).endpoint).trim()
    : "";
  if (!endpoint || endpoint.length > 2048) return NextResponse.json({ error: "Invalid Web Push endpoint" }, { status: 400, headers: privateHeaders });

  let normalizedEndpoint: string;
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:") throw new Error("invalid protocol");
    normalizedEndpoint = url.toString();
  } catch {
    return NextResponse.json({ error: "Invalid Web Push endpoint" }, { status: 400, headers: privateHeaders });
  }

  await webPushSubscriptionRepository.removeForSession(authenticated.user.id, authenticated.sessionId, normalizedEndpoint);
  return NextResponse.json({ success: true, subscribed: false }, { headers: privateHeaders });
}
