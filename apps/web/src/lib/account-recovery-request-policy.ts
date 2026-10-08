export const PASSWORD_RESET_NEUTRAL_RESPONSE = {
  accepted: true,
  message:
    "If an eligible account uses that email, a password reset link will be sent.",
} as const;

export const PASSWORD_RESET_REQUEST_FLOOR_MIN_MS = 900;
export const PASSWORD_RESET_REQUEST_FLOOR_JITTER_MS = 300;

export function passwordResetTargetMs(jitterMs: number): number {
  if (
    !Number.isSafeInteger(jitterMs) ||
    jitterMs < 0 ||
    jitterMs > PASSWORD_RESET_REQUEST_FLOOR_JITTER_MS
  ) {
    throw new RangeError("Invalid password-reset timing jitter");
  }
  return PASSWORD_RESET_REQUEST_FLOOR_MIN_MS + jitterMs;
}

export function passwordResetRemainingFloorMs(
  startedAt: number,
  targetMs: number,
  now = performance.now(),
): number {
  if (
    !Number.isFinite(startedAt) ||
    !Number.isFinite(targetMs) ||
    !Number.isFinite(now)
  ) {
    throw new RangeError("Invalid password-reset timing input");
  }
  return Math.max(0, targetMs - (now - startedAt));
}

export async function waitForPasswordResetFloor(
  startedAt: number,
  targetMs: number,
  options: {
    now?: () => number;
    sleep?: (milliseconds: number) => Promise<void>;
  } = {},
): Promise<void> {
  const now = options.now ?? (() => performance.now());
  const sleep =
    options.sleep ??
    ((milliseconds: number) =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, milliseconds);
      }));
  const remaining = passwordResetRemainingFloorMs(
    startedAt,
    targetMs,
    now(),
  );
  if (remaining > 0) await sleep(remaining);
}
