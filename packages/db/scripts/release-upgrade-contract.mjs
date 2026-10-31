export const RELEASE_UPGRADE_BASELINE_TAG = "0024_product_type_invariant";
export const RELEASE_UPGRADE_FAILURE_TAG = "0027_build_quarantine";
export const RELEASE_UPGRADE_TARGET_TAG = "0087_server_reviews";

function journalEntries(journal) {
  if (!journal || !Array.isArray(journal.entries)) {
    throw new Error("Release upgrade journal is invalid");
  }
  return journal.entries;
}

function tagIndex(entries, tag) {
  const index = entries.findIndex((entry) => entry?.tag === tag);
  if (index < 0) {
    throw new Error(`Release upgrade journal is missing required migration: ${tag}`);
  }
  return index;
}

export function releaseUpgradePlan(journal) {
  const entries = journalEntries(journal);
  if (entries.length === 0) {
    throw new Error("Release upgrade journal is empty");
  }

  const baselineIndex = tagIndex(entries, RELEASE_UPGRADE_BASELINE_TAG);
  const failureIndex = tagIndex(entries, RELEASE_UPGRADE_FAILURE_TAG);
  const targetIndex = tagIndex(entries, RELEASE_UPGRADE_TARGET_TAG);

  if (targetIndex !== entries.length - 1) {
    throw new Error(
      `Release upgrade target must match latest migration; expected review after ${RELEASE_UPGRADE_TARGET_TAG}`,
    );
  }
  if (baselineIndex >= failureIndex || failureIndex > targetIndex) {
    throw new Error(
      "Release upgrade failure injection must be after baseline and at or before target",
    );
  }

  for (let index = 0; index < entries.length; index += 1) {
    if (entries[index]?.idx !== index) {
      throw new Error("Release upgrade journal indexes must be contiguous");
    }
  }

  return Object.freeze({
    baselineTag: RELEASE_UPGRADE_BASELINE_TAG,
    failureTag: RELEASE_UPGRADE_FAILURE_TAG,
    targetTag: RELEASE_UPGRADE_TARGET_TAG,
    baselineIndex,
    failureIndex,
    targetIndex,
    baselineEntries: Object.freeze(entries.slice(0, baselineIndex + 1)),
  });
}
