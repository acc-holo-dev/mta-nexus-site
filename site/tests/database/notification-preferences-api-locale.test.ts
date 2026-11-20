import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { notificationPreferencesApiCopy } from "../../src/features/notifications/notification-preferences-api-copy";
import {
  browserMutationHeaders,
  stubBrowserMutationOrigin,
} from "../helpers/browser-mutation-headers";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  rate: vi.fn(),
  getPreferences: vi.fn(),
  updatePreferences: vi.fn(),
}));

vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: {
    getSession: mocks.getSession,
  },
}));

vi.mock("@nexus/db", () => ({
  notificationRepository: {
    getPreferences: mocks.getPreferences,
    updatePreferences: mocks.updatePreferences,
  },
}));

vi.mock("@nexus/security", () => ({
  consumeRateLimit: mocks.rate,
}));

import { GET, PATCH } from "../../src/app/api/notifications/preferences/route";

function getRequest(locale: "en" | "ru") {
  return new NextRequest("https://nexus.test/api/notifications/preferences", {
    headers: { cookie: `nexus_session=tok;nexus_locale=${locale}` },
  });
}

function patchRequest(locale: "en" | "ru", body: Record<string, unknown>) {
  return new NextRequest("https://nexus.test/api/notifications/preferences", {
    method: "PATCH",
    headers: {
      ...browserMutationHeaders(),
      cookie: `nexus_session=tok;nexus_locale=${locale}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("notification preferences API locale envelope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubBrowserMutationOrigin();
    mocks.getSession.mockResolvedValue({ id: "usr_pref" });
    mocks.rate.mockResolvedValue({ success: true });
  });

  it("returns bilingual GET auth error from nexus_locale", async () => {
    mocks.getSession.mockResolvedValueOnce(null);
    const unauth = await GET(getRequest("ru"));
    expect(unauth.status).toBe(401);
    expect(await unauth.json()).toMatchObject({
      error: notificationPreferencesApiCopy("ru").authenticationRequired,
    });
    expect(mocks.getPreferences).not.toHaveBeenCalled();
  });

  it("returns bilingual PATCH actor-changed from nexus_locale", async () => {
    const changed = await PATCH(
      patchRequest("en", { expectedActorId: "usr_other", followsEnabled: false }),
    );
    expect(changed.status).toBe(409);
    expect(await changed.json()).toMatchObject({
      code: "ACTOR_CHANGED",
      error: notificationPreferencesApiCopy("en").accountChanged,
    });
    expect(mocks.updatePreferences).not.toHaveBeenCalled();
  });
});
