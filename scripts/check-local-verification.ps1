$ErrorActionPreference = "Stop"

if ($env:NEXUS_LOCAL_VERIFY -ne "true") {
  throw "Refusing: set NEXUS_LOCAL_VERIFY=true for the disposable local verification stack."
}
if ($env:GITHUB_ACTIONS -eq "true") {
  throw "Refusing: local verification is a developer fallback, not a GitHub Actions workflow."
}
if ($env:DOCKER_HOST -or $env:DOCKER_CONTEXT) {
  throw "Refusing: remote/overridden Docker daemons are not allowed."
}

$context = (& docker context show).Trim()
if ($LASTEXITCODE -ne 0 -or $context -ne "default") {
  throw "Refusing: select the default local Docker context first."
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot
$project = "nexus-verify-$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())-$PID"
$previousDisableEnvFile = $env:COMPOSE_DISABLE_ENV_FILE
$owned = $false
$failure = $null

try {
  $env:COMPOSE_DISABLE_ENV_FILE = "true"

  & docker compose -p $project -f compose.verify.yaml config --quiet
  if ($LASTEXITCODE -ne 0) { throw "compose.verify.yaml did not render successfully." }

  $existingContainers = & docker ps -aq --filter "label=com.docker.compose.project=$project"
  if ($LASTEXITCODE -ne 0 -or $existingContainers) {
    throw "Refusing: generated verification project is not empty."
  }
  $existingVolumes = & docker volume ls -q --filter "label=com.docker.compose.project=$project"
  if ($LASTEXITCODE -ne 0 -or $existingVolumes) {
    throw "Refusing: generated verification project has existing volumes."
  }

  $owned = $true
  & docker compose -p $project -f compose.verify.yaml up --build --abort-on-container-exit --exit-code-from verify verify
  if ($LASTEXITCODE -ne 0) {
    throw "Disposable Docker verification failed."
  }

  Write-Output "PASS: disposable Docker verification completed typecheck, CI-aligned Vitest (unit without APP_URL, database with APP_URL) and production Next.js build on a fresh database."
}
catch {
  $failure = $_
}
finally {
  if ($owned) {
    & docker compose -p $project -f compose.verify.yaml down --volumes --remove-orphans --timeout 15
    if ($LASTEXITCODE -ne 0 -and -not $failure) {
      $failure = [System.Exception]::new("Disposable verification cleanup failed.")
    }

    $remainingVolumes = & docker volume ls -q --filter "label=com.docker.compose.project=$project"
    if ($remainingVolumes -and -not $failure) {
      $failure = [System.Exception]::new("Disposable verification volumes remain after cleanup.")
    }
  }

  if ($null -eq $previousDisableEnvFile) {
    Remove-Item Env:COMPOSE_DISABLE_ENV_FILE -ErrorAction SilentlyContinue
  } else {
    $env:COMPOSE_DISABLE_ENV_FILE = $previousDisableEnvFile
  }
  Pop-Location
}

if ($failure) {
  throw $failure
}
