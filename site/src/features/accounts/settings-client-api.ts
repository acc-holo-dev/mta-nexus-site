export type SettingsSession = {
  id: string;
  expiresAt: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  isCurrent?: boolean;
};

export type SettingsRecoveryEmail = {
  actorId: string;
  email: string;
  verified: boolean;
  verifiedAt: string | null;
  eligible: boolean;
};

export class SettingsRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

/** Locale-safe match for auth API "signed out" envelopes (not wrong-password 401). */
export function isSettingsSignedOutError(error: SettingsRequestError): boolean {
  if (error.status !== 401) return false;
  return error.message === "Authentication required" || error.message === "Требуется вход";
}

export async function settingsClientRequest<T>(
  path: string,
  method = "GET",
  body: unknown = undefined,
  unavailableMessage = "Account settings are temporarily unavailable.",
  unreadableMessage = "The server returned an unreadable response.",
): Promise<T> {
  const response = await fetch(path, {
    method,
    cache: "no-store",
    credentials: "same-origin",
    signal: AbortSignal.timeout(15_000),
    ...(body === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const code = typeof data?.code === "string" ? data.code : undefined;
    throw new SettingsRequestError(data?.error || unavailableMessage, response.status, code);
  }
  if (!data) {
    throw new SettingsRequestError(unreadableMessage, response.status);
  }
  return data as T;
}
