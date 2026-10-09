/**
 * A master-list snapshot can be reused while an MTA listing changes its
 * network endpoint (including A -> B -> A). Historical uniqueness must
 * include the endpoint revision, not only the snapshot time and server ID.
 *
 * Keep revision zero's legacy ISO sequence untouched so existing recorded
 * observations continue to deduplicate after upgrades.
 *
 * @param {string} snapshotSequence An immutable master snapshot identifier.
 * @param {number | undefined} endpointRevision Current server endpoint revision.
 * @returns {string}
 */
export function observationSequenceForEndpoint(snapshotSequence, endpointRevision = 0) {
  if (typeof snapshotSequence !== "string" || !snapshotSequence) {
    throw new TypeError("Observation source sequence must not be empty");
  }
  if (
    !Number.isSafeInteger(endpointRevision) ||
    endpointRevision < 0 ||
    endpointRevision > 2_147_483_647
  ) {
    throw new RangeError("Invalid server endpoint revision");
  }
  return endpointRevision === 0
    ? snapshotSequence
    : `${snapshotSequence}#endpoint-revision=${endpointRevision}`;
}
