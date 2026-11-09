/** Production-base application writers + ingress (OPS-12 inventory). */
export const PRODUCTION_BASE_WRITERS = Object.freeze([
  "app",
  "push-worker",
  "license-worker",
  "resource-release-worker",
]);

export const PRODUCTION_BASE_SERVICES = Object.freeze([
  ...PRODUCTION_BASE_WRITERS,
  "caddy",
  "clamav",
  "postgres",
]);

export const SUPPORTED_COMPOSE_SCENARIOS = Object.freeze([
  {
    id: "dev",
    files: ["deploy/compose.yaml"],
    services: [
      "app",
      "clamav",
      "license-worker",
      "postgres",
      "push-worker",
      "resource-release-worker",
    ],
  },
  {
    id: "verify",
    files: ["deploy/compose.verify.yaml"],
    services: ["postgres", "verify"],
  },
  {
    id: "production",
    files: ["deploy/compose.production.yaml"],
    services: [...PRODUCTION_BASE_SERVICES].sort(),
  },
  {
    id: "production-recovery-mail",
    files: [
      "deploy/compose.production.yaml",
      "deploy/compose.recovery.yaml",
      "deploy/compose.mail-worker.yaml",
    ],
    services: [...PRODUCTION_BASE_SERVICES, "mail-worker"].sort(),
  },
  {
    id: "production-ci",
    files: ["deploy/compose.production.yaml", "deploy/compose.production-ci.yaml"],
    services: [...PRODUCTION_BASE_SERVICES].sort(),
  },
]);
