export type AccountRecoveryProof = {
  challengeId: string;
  token: string;
};

export type ParsedAccountRecoveryLocation = {
  proof: AccountRecoveryProof | null;
  scrubbedPath: string;
};

const CHALLENGE_PATTERN = /^ach_[A-Za-z0-9_-]{1,96}$/u;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/u;

export function parseAccountRecoveryLocation(href: string): ParsedAccountRecoveryLocation {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return { proof: null, scrubbedPath: "/" };
  }

  const challengeId = url.searchParams.get("challenge") ?? "";
  const fragment = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);
  const token = fragment.get("token") ?? "";

  return {
    proof:
      CHALLENGE_PATTERN.test(challengeId) && TOKEN_PATTERN.test(token)
        ? { challengeId, token }
        : null,
    scrubbedPath: url.pathname || "/",
  };
}

export function readAccountRecoveryProofFromWindow(): AccountRecoveryProof | null {
  const parsed = parseAccountRecoveryLocation(window.location.href);
  window.history.replaceState(null, "", parsed.scrubbedPath);
  return parsed.proof;
}

export function recoveryJsonRequest(method: "POST" | "PATCH", body: unknown): RequestInit {
  return {
    method,
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  };
}
