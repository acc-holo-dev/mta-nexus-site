export type SettingsSession = {
  id: string;
  expiresAt: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  isCurrent?: boolean;
};

export type SettingsRecoveryEmail = {
  email: string;
  verified: boolean;
  verifiedAt: string | null;
  eligible: boolean;
};

export class SettingsRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
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
    throw new SettingsRequestError(data?.error || unavailableMessage, response.status);
  }
  if (!data) {
    throw new SettingsRequestError(unreadableMessage, response.status);
  }
  return data as T;
}
