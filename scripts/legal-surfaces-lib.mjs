import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** In-repo publishable legal surfaces for free open beta (not counsel approval). */
export const LEGAL_SURFACE_ROUTES = Object.freeze([
  Object.freeze({
    id: "terms",
    path: "/terms",
    pageRelative: "apps/web/src/app/terms/page.tsx",
    dictionaryKey: "terms",
  }),
  Object.freeze({
    id: "privacy",
    path: "/privacy",
    pageRelative: "apps/web/src/app/privacy/page.tsx",
    dictionaryKey: "privacy",
  }),
  Object.freeze({
    id: "community_rules",
    path: "/community-rules",
    pageRelative: "apps/web/src/app/community-rules/page.tsx",
    dictionaryKey: "communityRules",
  }),
]);

const FOOTER_RELATIVE = "apps/web/src/components/footer.tsx";
const I18N_LOCALE_LEGAL = Object.freeze([
  Object.freeze({ locale: "en", relative: "apps/web/src/lib/i18n/en/legal.ts" }),
  Object.freeze({ locale: "ru", relative: "apps/web/src/lib/i18n/ru/legal.ts" }),
]);
const MIN_SECTION_BODY = 40;

function readText(root, relativePath) {
  const absolute = join(root, relativePath);
  if (!existsSync(absolute)) return null;
  return readFileSync(absolute, "utf8");
}

function extractLegalDocumentBlock(source, key) {
  // Match `key: { ... },` at the legal document nesting used in i18n dictionaries.
  const marker = `${key}: {`;
  const start = source.indexOf(marker);
  if (start < 0) return null;
  let depth = 0;
  let i = start + marker.length - 1;
  for (; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, i + 1);
      }
    }
  }
  return null;
}

function countSections(block) {
  if (!block) return 0;
  const titles = block.match(/\btitle:\s*"/gu) ?? [];
  // document title + section titles; require at least 3 section title hits beyond metadata fields
  return Math.max(0, titles.length - 1);
}

function hasSubstantialBodies(block) {
  if (!block) return false;
  const bodies = [...block.matchAll(/\bbody:\s*"((?:\\.|[^"\\])*)"/gu)].map((match) =>
    match[1].replace(/\\n/gu, " ").trim(),
  );
  const long = bodies.filter((body) => body.length >= MIN_SECTION_BODY);
  return long.length >= 3;
}

/**
 * Pure in-repo check: pages exist, footer links them, RU/EN dictionaries carry content.
 * Never claims legal counsel approval.
 */
export function evaluateLegalSurfaces(repoRoot = process.cwd()) {
  const problems = [];
  const present = [];
  const footer = readText(repoRoot, FOOTER_RELATIVE);
  const localeLegal = I18N_LOCALE_LEGAL.map((entry) => ({
    ...entry,
    source: readText(repoRoot, entry.relative),
  }));

  if (!footer) problems.push(`${FOOTER_RELATIVE}: absent`);
  for (const entry of localeLegal) {
    if (!entry.source) problems.push(`${entry.relative}: absent`);
  }

  for (const surface of LEGAL_SURFACE_ROUTES) {
    const page = readText(repoRoot, surface.pageRelative);
    if (!page) {
      problems.push(`${surface.pageRelative}: absent`);
      continue;
    }
    present.push(surface.path);
    if (!page.includes("LegalDocument")) {
      problems.push(`${surface.pageRelative}: missing LegalDocument render`);
    }
    if (footer && !footer.includes(`href="${surface.path}"`)) {
      problems.push(`footer: missing link to ${surface.path}`);
    }
    for (const entry of localeLegal) {
      if (!entry.source) continue;
      const block = extractLegalDocumentBlock(entry.source, surface.dictionaryKey);
      if (!block) {
        problems.push(`i18n.${entry.locale}.${surface.dictionaryKey}: missing document block`);
        continue;
      }
      if (countSections(block) < 3) {
        problems.push(`i18n.${entry.locale}.${surface.dictionaryKey}: need >=3 sections`);
      }
      if (!hasSubstantialBodies(block)) {
        problems.push(`i18n.${entry.locale}.${surface.dictionaryKey}: section bodies too short`);
      }
    }
  }

  if (problems.length) {
    return {
      status: "residual",
      reason: `Legal product surfaces incomplete (${problems.join("; ")}). Counsel review remains a separate human gate.`,
      present,
      problems,
    };
  }

  return {
    status: "passed",
    reason: null,
    present,
    problems: [],
    note: "In-repo Terms/Privacy/Community rules pages are published and linked; not legal counsel approval.",
  };
}
