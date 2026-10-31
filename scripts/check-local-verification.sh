#!/usr/bin/env bash
set -euo pipefail

[[ ${NEXUS_LOCAL_VERIFY:-} == true ]] || {
  echo 'Refusing: set NEXUS_LOCAL_VERIFY=true for the disposable local verification stack.' >&2
  exit 2
}
[[ ${GITHUB_ACTIONS:-} != true ]] || {
  echo 'Refusing: local verification is a developer fallback, not a GitHub Actions workflow.' >&2
  exit 2
}
[[ -z ${DOCKER_HOST:-} && -z ${DOCKER_CONTEXT:-} ]] || {
  echo 'Refusing: remote/overridden Docker daemons are not allowed.' >&2
  exit 2
}
[[ $(docker context show) == default ]] || {
  echo 'Refusing: select the default local Docker context first.' >&2
  exit 2
}

cd "$(dirname "$0")/.."
project="nexus-verify-$(date +%s)-$$"
[[ $project =~ ^nexus-verify-[0-9]+-[0-9]+$ ]] || {
  echo 'Refusing: invalid generated Compose project name.' >&2
  exit 2
}

compose=(docker compose -p "$project" -f compose.verify.yaml)
owned=0

cleanup() {
  status=$?
  trap - EXIT
  if [[ $owned == 1 ]]; then
    COMPOSE_DISABLE_ENV_FILE=true "${compose[@]}" down --volumes --remove-orphans --timeout 15 || status=1
    if [[ -n $(docker volume ls -q --filter "label=com.docker.compose.project=$project") ]]; then
      echo "Cleanup failed: disposable volumes remain for $project" >&2
      status=1
    fi
  fi
  exit "$status"
}
trap cleanup EXIT

COMPOSE_DISABLE_ENV_FILE=true "${compose[@]}" config --quiet
[[ -z $(docker ps -aq --filter "label=com.docker.compose.project=$project") ]]
[[ -z $(docker volume ls -q --filter "label=com.docker.compose.project=$project") ]]
owned=1

COMPOSE_DISABLE_ENV_FILE=true "${compose[@]}" up \
  --build \
  --abort-on-container-exit \
  --exit-code-from verify \
  verify

echo 'PASS: disposable Docker verification completed typecheck, CI-aligned Vitest (unit without APP_URL, database with APP_URL) and production Next.js build on a fresh database.'
