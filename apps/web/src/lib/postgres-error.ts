/** Match a known unique constraint through bounded Drizzle/driver cause wrappers. */
export function isUniqueConstraintViolation(error: unknown, constraints: readonly string[]): boolean {
  let current = error;
  for (let depth = 0; depth < 4; depth += 1) {
    if (!current || typeof current !== "object") return false;
    const candidate = current as {
      code?: string;
      constraint_name?: string;
      constraint?: string;
      cause?: unknown;
    };
    if (candidate.code) {
      const constraint = candidate.constraint_name ?? candidate.constraint;
      return candidate.code === "23505" && typeof constraint === "string" && constraints.includes(constraint);
    }
    current = candidate.cause;
  }
  return false;
}
