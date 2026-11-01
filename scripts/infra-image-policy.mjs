import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * OPS-03 / ARC07–ARC12: selected base/infra image policy.
 *
 * Compose/Dockerfile keep mutable tags so Dependabot can propose security updates.
 * Release candidates record exact digests + platform in the pin file / release
 * manifest. Mutable tags are never production deploy inputs.
 */

export const INFRA_IMAGE_PIN_SCHEMA_VERSION = 1;
export const POSTGRES_MAJOR = 18;
export const POSTGRES_VOLUME_PATH = "/var/lib/postgresql";
export const DOCKER_NODE_MAJOR_IMAGE = "node:26-alpine";

/** Mutable tag refs allowed in Dockerfile / Compose before candidate digest lock. */
export const INFRA_IMAGE_REFS = Object.freeze({
  node: DOCKER_NODE_MAJOR_IMAGE,
  postgres: "postgres:18-alpine",
  caddy: "caddy:2-alpine",
  clamav: "clamav/clamav:1.5",
});

export const DOCKERFILE_NODE_STAGES = Object.freeze(["development", "build", "runtime"]);

const DIGEST_RE = /^sha256:[a-f0-9]{64}$/u;

export function isImageDigest(value) {
  return typeof value === "string" && DIGEST_RE.test(value);
}

export function parseImageRef(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const at = text.lastIndexOf("@");
  if (at > 0) {
    const name = text.slice(0, at);
    const digest = text.slice(at + 1);
    return { name, digest: isImageDigest(digest) ? digest : null, tag: null, raw: text };
  }
  const slash = text.lastIndexOf("/");
  const colon = text.lastIndexOf(":");
  if (colon > slash) {
    return {
      name: text.slice(0, colon),
      tag: text.slice(colon + 1),
      digest: null,
      raw: text,
    };
  }
  return { name: text, tag: null, digest: null, raw: text };
}

export function extractDockerfileNodeStages(dockerfileSource) {
  const stages = [];
  const pattern = /^FROM[ \t]+([^\s]+)[ \t]+AS[ \t]+(\w+)\s*$/gmu;
  for (const match of dockerfileSource.matchAll(pattern)) {
    stages.push({ image: match[1], stage: match[2] });
  }
  return stages;
}

export function evaluateDockerfileNodePolicy(dockerfileSource) {
  const stages = extractDockerfileNodeStages(dockerfileSource);
  const byName = Object.fromEntries(stages.map((entry) => [entry.stage, entry]));
  const missing = DOCKERFILE_NODE_STAGES.filter((name) => !byName[name]);
  const mismatches = DOCKERFILE_NODE_STAGES.filter((name) => {
    const entry = byName[name];
    if (!entry) return false;
    const parsed = parseImageRef(entry.image);
    return parsed?.name !== "node" || parsed?.tag !== "26-alpine";
  }).map((name) => ({
    stage: name,
    image: byName[name]?.image ?? null,
    expected: DOCKER_NODE_MAJOR_IMAGE,
  }));
  return Object.freeze({
    ok: missing.length === 0 && mismatches.length === 0,
    stages,
    missing,
    mismatches,
    policy: DOCKER_NODE_MAJOR_IMAGE,
  });
}

export function evaluatePostgresLayout({ image, volumePath }) {
  const parsed = parseImageRef(image);
  const majorMatch = String(parsed?.tag ?? "").match(/^(\d+)(?:-|$)/u);
  const major = majorMatch ? Number(majorMatch[1]) : null;
  return Object.freeze({
    ok: major === POSTGRES_MAJOR && volumePath === POSTGRES_VOLUME_PATH,
    major,
    expectedMajor: POSTGRES_MAJOR,
    volumePath: volumePath ?? null,
    expectedVolumePath: POSTGRES_VOLUME_PATH,
    image: image ?? null,
    note: "PostgreSQL major engine upgrades are separate from application schema migrations.",
  });
}

/**
 * Release pin document: digests are filled when preparing a candidate.
 * Unresolved digests keep status "unresolved" and never invent productionAuthorized.
 */
export function evaluateInfraImagePins(document, { requireResolved = false } = {}) {
  if (!document || typeof document !== "object") {
    return { ok: false, reason: "Infra image pin document is missing." };
  }
  if (document.schemaVersion !== INFRA_IMAGE_PIN_SCHEMA_VERSION) {
    return {
      ok: false,
      reason: `Unknown infra image pin schemaVersion ${document.schemaVersion ?? "missing"}; expected ${INFRA_IMAGE_PIN_SCHEMA_VERSION}.`,
    };
  }
  if (document.productionAuthorized === true) {
    return {
      ok: false,
      reason: "Infra image pins must never set productionAuthorized=true.",
    };
  }
  if (document.postgresMajor !== POSTGRES_MAJOR) {
    return {
      ok: false,
      reason: `postgresMajor must remain ${POSTGRES_MAJOR}.`,
    };
  }
  if (document.postgresVolumePath !== POSTGRES_VOLUME_PATH) {
    return {
      ok: false,
      reason: `postgresVolumePath must remain ${POSTGRES_VOLUME_PATH}.`,
    };
  }

  const images = document.images;
  if (!Array.isArray(images) || images.length === 0) {
    return { ok: false, reason: "Infra image pin document has no images[]." };
  }

  const requiredRoles = new Set(Object.keys(INFRA_IMAGE_REFS));
  const seen = new Set();
  const problems = [];

  for (const entry of images) {
    const role = entry?.role;
    if (!requiredRoles.has(role)) {
      problems.push(`Unknown image role ${role ?? "missing"}.`);
      continue;
    }
    if (seen.has(role)) {
      problems.push(`Duplicate image role ${role}.`);
      continue;
    }
    seen.add(role);
    if (entry.ref !== INFRA_IMAGE_REFS[role]) {
      problems.push(
        `Role ${role} ref is ${entry.ref ?? "missing"}, expected ${INFRA_IMAGE_REFS[role]}.`,
      );
    }
    const resolved = entry.status === "resolved";
    if (resolved) {
      if (!isImageDigest(entry.digest)) {
        problems.push(`Role ${role} resolved status requires a sha256 digest.`);
      }
      if (typeof entry.platform !== "string" || !entry.platform.includes("/")) {
        problems.push(`Role ${role} resolved status requires platform (os/arch).`);
      }
    } else if (entry.status !== "unresolved") {
      problems.push(`Role ${role} status must be resolved or unresolved.`);
    } else if (entry.digest != null || entry.platform != null) {
      problems.push(`Role ${role} unresolved entries must leave digest/platform null.`);
    }
    if (requireResolved && !resolved) {
      problems.push(`Role ${role} digest is unresolved.`);
    }
  }

  for (const role of requiredRoles) {
    if (!seen.has(role)) problems.push(`Missing image role ${role}.`);
  }

  return problems.length === 0
    ? { ok: true, reason: null, roles: [...seen].sort() }
    : { ok: false, reason: problems.join(" "), roles: [...seen].sort() };
}

export function readInfraImagePins(root) {
  const path = join(root, "deploy/infra-image-pins.json");
  return JSON.parse(readFileSync(path, "utf8"));
}

export function collectComposeImageRefs(composeSource) {
  const refs = [];
  for (const match of composeSource.matchAll(/^\s+image:\s*([^\s#]+)/gmu)) {
    refs.push(match[1]);
  }
  return refs;
}
