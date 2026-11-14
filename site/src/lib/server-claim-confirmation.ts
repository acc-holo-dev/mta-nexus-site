export type IssuedServerClaimChallenge = Readonly<{
  challengeId: string;
  token: string;
  expiresAt: string;
}>;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function parseIssuedServerClaimChallenge(
  status: number,
  payload: unknown,
  serverId: string,
): IssuedServerClaimChallenge | null {
  if (!Number.isSafeInteger(status) || status < 200 || status >= 300) {
    return null;
  }

  const root = record(payload);
  const challenge = record(root?.challenge);
  const server = record(challenge?.server);
  const challengeId = challenge?.challengeId;
  const token = challenge?.token;
  const expiresAt = challenge?.expiresAt;

  if (
    typeof challengeId !== "string" ||
    !challengeId ||
    typeof token !== "string" ||
    !/^NXCLAIM-[A-F0-9]{24}$/u.test(token) ||
    typeof expiresAt !== "string" ||
    !Number.isFinite(Date.parse(expiresAt)) ||
    server?.id !== serverId
  ) {
    return null;
  }

  return { challengeId, token, expiresAt };
}

export function confirmsServerClaimVerification(
  status: number,
  payload: unknown,
  challengeId: string,
): boolean {
  if (!Number.isSafeInteger(status) || status < 200 || status >= 300) {
    return false;
  }

  const root = record(payload);
  const verificationRequest = record(root?.verificationRequest);
  const proof = record(root?.proof);

  return (
    root?.success === true &&
    typeof verificationRequest?.id === "string" &&
    verificationRequest.id.length > 0 &&
    proof?.method === "mta_master_name_challenge" &&
    proof?.challengeId === challengeId
  );
}
