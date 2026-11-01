export type ResourceVersionHelpSupportContext = {
  productId: string;
  buildId: string | null;
};

export type ResourceVersionHelpSectionContent = {
  paragraphs: string[];
  codeBlocks: string[];
};

export type ResourceVersionHelpLimitKey =
  | "licenseModel"
  | "versionMtaTarget"
  | "catalogMtaMin"
  | "dependencies";

export type ResourceVersionHelpLimitLine = {
  key: ResourceVersionHelpLimitKey;
  known: boolean;
  value: string | null;
};

export type ResourceVersionHelpInput = {
  version: string;
  shortDescription: string | null | undefined;
  description: string;
  licenseModel: string;
  compatibility: { mtaMinVersion?: string; dependencies?: string[] } | null | undefined;
  releaseNotes: string | null | undefined;
  mtaVersionTarget: string | null | undefined;
  productId: string;
  buildId: string | null | undefined;
};

export type ResourceVersionHelpProjection = {
  version: string;
  purpose: ResourceVersionHelpSectionContent | null;
  setup: ResourceVersionHelpSectionContent | null;
  limits: ResourceVersionHelpLimitLine[];
  support: ResourceVersionHelpSupportContext;
  missingAuthorContent: boolean;
};

const PRODUCT_ID = /^prd_[a-f0-9]{24}$/u;
const BUILD_ID = /^bld_[a-f0-9]{24}$/u;

/** Plain-text author input only — never interpreted as HTML or executable code. */
export function normalizeInstructionPlainText(value: string): string {
  return value.replace(/\0/gu, "").replace(/\r\n/gu, "\n").replace(/\r/gu, "\n").trim();
}

export function splitInstructionPlainText(value: string): ResourceVersionHelpSectionContent {
  const normalized = normalizeInstructionPlainText(value);
  if (!normalized) return { paragraphs: [], codeBlocks: [] };

  const parts = normalized.split("```");
  const paragraphs: string[] = [];
  const codeBlocks: string[] = [];

  for (let index = 0; index < parts.length; index += 1) {
    const chunk = parts[index];
    if (index % 2 === 0) {
      const trimmed = chunk.trim();
      if (trimmed) paragraphs.push(trimmed);
      continue;
    }
    const withoutLanguage = chunk.replace(/^[a-zA-Z0-9._-]+\n/u, "");
    const code = withoutLanguage.replace(/\n+$/u, "");
    if (code.trim()) codeBlocks.push(code);
  }

  return { paragraphs, codeBlocks };
}

function purposeContent(input: ResourceVersionHelpInput): ResourceVersionHelpSectionContent | null {
  const short = input.shortDescription ? normalizeInstructionPlainText(input.shortDescription) : "";
  if (short) return { paragraphs: [short], codeBlocks: [] };
  return null;
}

function limitLines(input: ResourceVersionHelpInput): ResourceVersionHelpLimitLine[] {
  const compatibility = input.compatibility ?? {};
  const mtaTarget = input.mtaVersionTarget
    ? normalizeInstructionPlainText(input.mtaVersionTarget)
    : "";
  const catalogMin = compatibility.mtaMinVersion
    ? normalizeInstructionPlainText(compatibility.mtaMinVersion)
    : "";
  const dependencies = compatibility.dependencies ?? [];
  const declaredDependencies = dependencies
    .map((item) => normalizeInstructionPlainText(item))
    .filter(Boolean);

  return [
    {
      key: "licenseModel",
      known: Boolean(normalizeInstructionPlainText(input.licenseModel)),
      value: normalizeInstructionPlainText(input.licenseModel) || null,
    },
    {
      key: "versionMtaTarget",
      known: Boolean(mtaTarget),
      value: mtaTarget || null,
    },
    {
      key: "catalogMtaMin",
      known: Boolean(catalogMin),
      value: catalogMin || null,
    },
    {
      key: "dependencies",
      known: declaredDependencies.length > 0,
      value: declaredDependencies.length > 0 ? declaredDependencies.join(", ") : null,
    },
  ];
}

export function buildResourceVersionHelp(
  input: ResourceVersionHelpInput,
): ResourceVersionHelpProjection {
  const version = normalizeInstructionPlainText(input.version);
  const purpose = purposeContent(input);
  const setup = (() => {
    const content = splitInstructionPlainText(input.releaseNotes ?? "");
    if (content.paragraphs.length === 0 && content.codeBlocks.length === 0) return null;
    return content;
  })();

  const productId = typeof input.productId === "string" ? input.productId.trim() : "";
  const buildId =
    typeof input.buildId === "string" && BUILD_ID.test(input.buildId.trim())
      ? input.buildId.trim()
      : null;

  const support: ResourceVersionHelpSupportContext = {
    productId: PRODUCT_ID.test(productId) ? productId : "",
    buildId,
  };

  return {
    version,
    purpose,
    setup,
    limits: limitLines(input),
    support,
    missingAuthorContent: !purpose && !setup,
  };
}
