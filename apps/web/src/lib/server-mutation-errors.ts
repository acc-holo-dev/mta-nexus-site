/** Maps stable API error codes to localized UI messages without trusting unknown bodies. */
export function serverMutationErrorMessage(
  body: unknown,
  translations: Readonly<Record<string, string>>,
  fallback: string,
): string {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return fallback;
  }
  const payload = body as Record<string, unknown>;
  const code = payload.code;
  if (typeof code === "string" && Object.hasOwn(translations, code)) {
    const translated = translations[code];
    if (typeof translated === "string" && translated.length > 0) return translated;
  }
  const message = payload.error;
  return typeof message === "string" &&
    message.length > 0 &&
    message.length <= 300 &&
    !Array.from(message).some(character => character.charCodeAt(0) < 32)
    ? message
    : fallback;
}
