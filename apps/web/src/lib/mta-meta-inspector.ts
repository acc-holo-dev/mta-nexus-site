const MAX_META_XML_BYTES = 256 * 1024;
const MAX_TAG_ENTRIES_PER_KIND = 500;
const MAX_INSPECTION_ISSUES = 200;

type InspectionSeverity = "warning" | "error";

export type MetaInspectionIssue = Readonly<{
  code: string;
  severity: InspectionSeverity;
  message: string;
}>;

type AttributeMap = Readonly<Record<string, string>>;

export type MtaMetaInspection = Readonly<{
  parser: "best_effort_static";
  byteLength: number;
  root: "meta" | "unknown";
  info: AttributeMap | null;
  scripts: readonly Readonly<{
    src: string | null;
    type: "client" | "server" | "shared" | "unknown";
    typeDeclared: boolean;
    cache: string | null;
    validate: string | null;
  }>[];
  files: readonly AttributeMap[];
  maps: readonly AttributeMap[];
  includes: readonly AttributeMap[];
  configs: readonly AttributeMap[];
  exports: readonly AttributeMap[];
  html: readonly AttributeMap[];
  settings: readonly AttributeMap[];
  minMtaVersion: Readonly<{
    client: string | null;
    server: string | null;
    both: string | null;
  }> | null;
  aclRights: readonly AttributeMap[];
  summary: Readonly<{
    scriptCount: number;
    clientScripts: number;
    serverScripts: number;
    sharedScripts: number;
    unknownScriptTypes: number;
    clientCacheDisabledScripts: number;
    validationDisabledScripts: number;
    fileCount: number;
    mapCount: number;
    dependencyCount: number;
    exportCount: number;
    httpExportCount: number;
    settingCount: number;
    aclRightCount: number;
  }>;
  dependencyResources: readonly string[];
  issues: readonly MetaInspectionIssue[];
}>;

export class MetaInspectionInputError extends Error {
  constructor(
    message: string,
    readonly code: "META_TOO_LARGE" | "META_FORBIDDEN_XML_FEATURE",
  ) {
    super(message);
    this.name = "MetaInspectionInputError";
  }
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function decodeCodePoint(
  whole: string,
  raw: string,
  radix: 10 | 16,
): string {
  const value = Number.parseInt(raw, radix);
  if (
    !Number.isInteger(value) ||
    value < 0 ||
    value > 0x10ffff ||
    (value >= 0xd800 && value <= 0xdfff)
  ) {
    return whole;
  }
  return String.fromCodePoint(value);
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/giu, (whole: string, hex: string) =>
      decodeCodePoint(whole, hex, 16),
    )
    .replace(/&#([0-9]+);/gu, (whole: string, decimal: string) =>
      decodeCodePoint(whole, decimal, 10),
    )
    .replace(/&quot;/giu, '"')
    .replace(/&apos;/giu, "'")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/&amp;/giu, "&");
}

function parseAttributes(source: string): AttributeMap {
  const attributes: Record<string, string> = {};
  const attributePattern =
    /([A-Za-z_:][A-Za-z0-9_.:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/gu;

  for (const match of source.matchAll(attributePattern)) {
    const name = match[1]?.toLowerCase();
    if (!name || Object.hasOwn(attributes, name)) continue;
    attributes[name] = decodeXmlEntities(match[2] ?? match[3] ?? "");
  }

  return Object.freeze(attributes);
}

function tags(
  source: string,
  tagName: string,
): Readonly<{ items: AttributeMap[]; truncated: boolean }> {
  const pattern = new RegExp(
    `<\\s*${tagName}\\b([^<>]*?)(?:\\/\\s*)?>`,
    "giu",
  );
  const items: AttributeMap[] = [];

  for (const match of source.matchAll(pattern)) {
    if (items.length >= MAX_TAG_ENTRIES_PER_KIND) {
      return Object.freeze({ items, truncated: true });
    }
    items.push(parseAttributes(match[1] ?? ""));
  }

  return Object.freeze({ items, truncated: false });
}

function containerContents(source: string, tagName: string): string[] {
  const pattern = new RegExp(
    `<\\s*${tagName}\\b[^>]*>([\\s\\S]*?)<\\/\\s*${tagName}\\s*>`,
    "giu",
  );
  return Array.from(source.matchAll(pattern), (match) => match[1] ?? "").slice(
    0,
    MAX_TAG_ENTRIES_PER_KIND,
  );
}

function issue(
  issues: MetaInspectionIssue[],
  code: string,
  severity: InspectionSeverity,
  message: string,
) {
  if (issues.length >= MAX_INSPECTION_ISSUES) return;
  if (issues.length === MAX_INSPECTION_ISSUES - 1) {
    issues.push(
      Object.freeze({
        code: "ISSUE_LIMIT_REACHED",
        severity: "warning" as const,
        message:
          "Additional structural notes were omitted after the inspection issue limit was reached.",
      }),
    );
    return;
  }
  issues.push(Object.freeze({ code, severity, message }));
}

function tagItems(
  source: string,
  tagName: string,
  issues: MetaInspectionIssue[],
): AttributeMap[] {
  const extraction = tags(source, tagName);
  if (extraction.truncated) {
    issue(
      issues,
      `${tagName.toUpperCase()}_ENTRY_LIMIT_REACHED`,
      "warning",
      `Only the first ${MAX_TAG_ENTRIES_PER_KIND} <${tagName}> entries were inspected.`,
    );
  }
  return extraction.items;
}

function normalizedScriptType(
  value: string | undefined,
): "client" | "server" | "shared" | "unknown" {
  if (value === undefined || value === "") return "server";
  const normalized = value.toLowerCase();
  if (
    normalized === "client" ||
    normalized === "server" ||
    normalized === "shared"
  ) {
    return normalized;
  }
  return "unknown";
}

function isFalse(value: string | null): boolean {
  return value?.trim().toLowerCase() === "false";
}

export function inspectMtaMetaXml(xml: string): MtaMetaInspection {
  const size = byteLength(xml);
  if (size > MAX_META_XML_BYTES) {
    throw new MetaInspectionInputError(
      `meta.xml exceeds the ${MAX_META_XML_BYTES}-byte inspection limit`,
      "META_TOO_LARGE",
    );
  }

  if (/<!\s*(?:DOCTYPE|ENTITY)\b/iu.test(xml)) {
    throw new MetaInspectionInputError(
      "DTD and ENTITY declarations are not accepted by the static inspector",
      "META_FORBIDDEN_XML_FEATURE",
    );
  }

  const issues: MetaInspectionIssue[] = [];
  const withoutBom = xml.replace(/^\uFEFF/u, "");
  const hasUnclosedComment =
    withoutBom.includes("<!--") &&
    (withoutBom.match(/<!--/gu)?.length ?? 0) !==
      (withoutBom.match(/-->/gu)?.length ?? 0);
  if (hasUnclosedComment) {
    issue(
      issues,
      "UNCLOSED_COMMENT",
      "warning",
      "An XML comment appears to be unclosed; extraction may be incomplete.",
    );
  }

  const source = withoutBom
    .replace(/<!--[\s\S]*?-->/gu, "")
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/gu, "");

  const rootMatch = source.match(
    /^\s*(?:<\?xml\b[^?]*\?>\s*)*<\s*([A-Za-z_:][A-Za-z0-9_.:-]*)\b/iu,
  );
  const root = rootMatch?.[1]?.toLowerCase() === "meta" ? "meta" : "unknown";
  if (root !== "meta" || !/<\/\s*meta\s*>\s*$/iu.test(source)) {
    issue(
      issues,
      "META_ROOT_NOT_CONFIRMED",
      "error",
      "A complete <meta>...</meta> root was not confirmed.",
    );
  }

  const infoTags = tagItems(source, "info", issues);
  if (infoTags.length === 0) {
    issue(
      issues,
      "INFO_NOT_DECLARED",
      "warning",
      "No <info> metadata tag was found.",
    );
  } else if (infoTags.length > 1) {
    issue(
      issues,
      "MULTIPLE_INFO_TAGS",
      "warning",
      "Multiple <info> tags were found; only the first is summarized.",
    );
  }

  const scriptTags = tagItems(source, "script", issues);
  const scripts = scriptTags.map((attributes, index) => {
    const src = attributes.src?.trim() || null;
    const typeDeclared = Boolean(attributes.type?.trim());
    const type = normalizedScriptType(attributes.type);
    if (!src) {
      issue(
        issues,
        "SCRIPT_SRC_MISSING",
        "error",
        `Script entry ${index + 1} does not declare src.`,
      );
    }
    if (type === "unknown") {
      issue(
        issues,
        "SCRIPT_TYPE_UNKNOWN",
        "warning",
        `Script entry ${index + 1} declares an unknown type.`,
      );
    }
    return Object.freeze({
      src,
      type,
      typeDeclared,
      cache: attributes.cache ?? null,
      validate: attributes.validate ?? null,
    });
  });

  const files = tagItems(source, "file", issues);
  files.forEach((attributes, index) => {
    if (!attributes.src?.trim()) {
      issue(
        issues,
        "FILE_SRC_MISSING",
        "error",
        `File entry ${index + 1} does not declare src.`,
      );
    }
  });

  const maps = tagItems(source, "map", issues);
  maps.forEach((attributes, index) => {
    if (!attributes.src?.trim()) {
      issue(
        issues,
        "MAP_SRC_MISSING",
        "error",
        `Map entry ${index + 1} does not declare src.`,
      );
    }
  });

  const includes = tagItems(source, "include", issues);
  includes.forEach((attributes, index) => {
    if (!attributes.resource?.trim()) {
      issue(
        issues,
        "INCLUDE_RESOURCE_MISSING",
        "error",
        `Include entry ${index + 1} does not declare resource.`,
      );
    }
  });

  const configs = tagItems(source, "config", issues);
  const exports = tagItems(source, "export", issues);
  exports.forEach((attributes, index) => {
    if (!attributes.function?.trim()) {
      issue(
        issues,
        "EXPORT_FUNCTION_MISSING",
        "error",
        `Export entry ${index + 1} does not declare function.`,
      );
    }
    if (
      attributes.type &&
      !["client", "server", "shared"].includes(attributes.type.toLowerCase())
    ) {
      issue(
        issues,
        "EXPORT_TYPE_UNKNOWN",
        "warning",
        `Export entry ${index + 1} declares an unknown type.`,
      );
    }
  });

  const html = tagItems(source, "html", issues);
  const settings = containerContents(source, "settings").flatMap((contents) =>
    tagItems(contents, "setting", issues),
  );
  const minVersionTag = tagItems(source, "min_mta_version", issues)[0] ?? null;
  const aclRights = containerContents(source, "aclrequest").flatMap((contents) =>
    tagItems(contents, "right", issues),
  );

  const dependencyResources = Array.from(
    new Set(
      includes
        .map((attributes) => attributes.resource?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const summary = Object.freeze({
    scriptCount: scripts.length,
    clientScripts: scripts.filter((item) => item.type === "client").length,
    serverScripts: scripts.filter((item) => item.type === "server").length,
    sharedScripts: scripts.filter((item) => item.type === "shared").length,
    unknownScriptTypes: scripts.filter((item) => item.type === "unknown").length,
    clientCacheDisabledScripts: scripts.filter(
      (item) => item.type === "client" && isFalse(item.cache),
    ).length,
    validationDisabledScripts: scripts.filter((item) =>
      isFalse(item.validate),
    ).length,
    fileCount: files.length,
    mapCount: maps.length,
    dependencyCount: dependencyResources.length,
    exportCount: exports.length,
    httpExportCount: exports.filter(
      (attributes) => attributes.http?.trim().toLowerCase() === "true",
    ).length,
    settingCount: settings.length,
    aclRightCount: aclRights.length,
  });

  return Object.freeze({
    parser: "best_effort_static",
    byteLength: size,
    root,
    info: infoTags[0] ?? null,
    scripts,
    files,
    maps,
    includes,
    configs,
    exports,
    html,
    settings,
    minMtaVersion: minVersionTag
      ? Object.freeze({
          client: minVersionTag.client ?? null,
          server: minVersionTag.server ?? null,
          both: minVersionTag.both ?? null,
        })
      : null,
    aclRights,
    summary,
    dependencyResources,
    issues,
  });
}

export const metaInspectionLimits = Object.freeze({
  maxBytes: MAX_META_XML_BYTES,
  maxEntriesPerKind: MAX_TAG_ENTRIES_PER_KIND,
  maxIssues: MAX_INSPECTION_ISSUES,
});
