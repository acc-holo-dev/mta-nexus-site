/**
 * Developer-only observation collection is explicit and bounded. A cursor
 * lets the operator resume a larger catalog without restarting at the first
 * 500 servers or loading all server rows into memory.
 */
function boundedInt(raw, fallback, max, name) {
  if (raw === undefined || raw === "") return fallback;
  if (typeof raw !== "string" || !/^[1-9][0-9]*$/u.test(raw)) {
    throw new RangeError(name + " must be a positive integer");
  }
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed > max) {
    throw new RangeError(name + " exceeds the safety limit of " + max);
  }
  return parsed;
}

export function readServerObservationCaptureOptions(env = process.env) {
  const limit = boundedInt(
    env.NEXUS_SERVER_OBSERVATION_PAGE_LIMIT, 500, 500,
    "NEXUS_SERVER_OBSERVATION_PAGE_LIMIT",
  );
  const maxPages = boundedInt(
    env.NEXUS_SERVER_OBSERVATION_MAX_PAGES, 1, 20,
    "NEXUS_SERVER_OBSERVATION_MAX_PAGES",
  );
  const afterId = env.NEXUS_SERVER_OBSERVATION_AFTER_ID;
  if (
    afterId !== undefined &&
    (typeof afterId !== "string" || !/^srv_[a-zA-Z0-9_-]{1,124}$/u.test(afterId))
  ) {
    throw new RangeError("NEXUS_SERVER_OBSERVATION_AFTER_ID is invalid");
  }
  return Object.freeze({
    limit, maxPages,
    ...(afterId === undefined ? {} : { afterId }),
  });
}
