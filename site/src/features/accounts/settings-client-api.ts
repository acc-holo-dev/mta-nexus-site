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

const settingsAuthEnvelopeMessages = new Set([
  "Authentication required",
  "Требуется вход",
  "Current password is incorrect",
  "Текущий пароль неверен",
]);

export async function settingsClientRequest<T>(
  path: string,
  method = "GET",
  body: unknown = undefined,
  unavailableMessage?: string,
  unreadableMessage?: string,
): Promise<T> {
  if (!unavailableMessage || !unreadableMessage) {
    throw new Error("settingsClientRequest requires locale unavailable/unreadable messages");
  }
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
    const apiError = typeof data?.error === "string" ? data.error : undefined;
    const message =
      response.status === 401 && apiError && settingsAuthEnvelopeMessages.has(apiError)
        ? apiError
        : unavailableMessage;
    throw new SettingsRequestError(message, response.status, code);
  }
  if (!data) {
    throw new SettingsRequestError(unreadableMessage, response.status);
  }
  return data as T;
}
