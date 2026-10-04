#!/usr/bin/env bash
set -euo pipefail

# Never fall back to a build or pull when an artifact for this SHA is missing.
[[ ${GITHUB_SHA:-} =~ ^[a-f0-9]{40}$ ]] || {
  echo 'A full GITHUB_SHA is required for a prebuilt CI image.' >&2; exit 1;
}
[[ ${NEXUS_CI_PREBUILT_IMAGE:-} == "nexus-ci:$GITHUB_SHA" ]] || {
  echo 'The prebuilt image tag must match the current GITHUB_SHA exactly.' >&2; exit 1;
}
revision=$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$NEXUS_CI_PREBUILT_IMAGE")
[[ $revision == "$GITHUB_SHA" ]] || {
  echo 'The loaded image revision does not match GITHUB_SHA.' >&2; exit 1;
}
printf '%s\n' "$NEXUS_CI_PREBUILT_IMAGE"
