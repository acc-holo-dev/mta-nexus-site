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
if ! docker_context=$(docker context show) || [[ $docker_context != default ]]; then
  echo 'Refusing: select the default local Docker context first.' >&2
  exit 2
fi

cd "$(dirname "$0")/.."
project="nexus-verify-$(date +%s)-$$"
[[ $project =~ ^nexus-verify-[0-9]+-[0-9]+$ ]] || {
  echo 'Refusing: invalid generated Compose project name.' >&2
  exit 2
}

compose=(docker compose -p "$project" -f deploy/compose.verify.yaml)
owned=0

cleanup() {
  status=$?
  trap - EXIT
  if [[ $owned == 1 ]]; then
    if ! COMPOSE_DISABLE_ENV_FILE=true "${compose[@]}" down --volumes --remove-orphans --timeout 15; then
      echo "Cleanup failed for $project" >&2
      if [[ $status == 0 ]]; then status=1; fi
    fi
    if ! remaining_volumes=$(docker volume ls -q --filter "label=com.docker.compose.project=$project"); then
      echo "Cleanup verification failed: cannot list volumes for $project" >&2
      if [[ $status == 0 ]]; then status=1; fi
    elif [[ -n $remaining_volumes ]]; then
      echo "Cleanup failed: disposable volumes remain for $project" >&2
      if [[ $status == 0 ]]; then status=1; fi
    fi
  fi
  if [[ $status == 0 && $owned == 1 ]]; then
    echo 'PASS: disposable Docker verification completed typecheck, CI-aligned Vitest (unit without APP_URL, database with APP_URL) and production Next.js build on a fresh database.'
  fi
  exit "$status"
}
trap cleanup EXIT

COMPOSE_DISABLE_ENV_FILE=true "${compose[@]}" config --quiet
if ! existing_containers=$(docker ps -aq --filter "label=com.docker.compose.project=$project"); then
  echo 'Refusing: cannot inspect existing verification containers.' >&2
  exit 1
fi
[[ -z $existing_containers ]] || { echo 'Refusing: verification project has existing containers.' >&2; exit 1; }
if ! existing_volumes=$(docker volume ls -q --filter "label=com.docker.compose.project=$project"); then
  echo 'Refusing: cannot inspect existing verification volumes.' >&2
  exit 1
fi
[[ -z $existing_volumes ]] || { echo 'Refusing: verification project has existing volumes.' >&2; exit 1; }
owned=1

COMPOSE_DISABLE_ENV_FILE=true "${compose[@]}" up \
  --build \
  --abort-on-container-exit \
  --exit-code-from verify \
  verify
