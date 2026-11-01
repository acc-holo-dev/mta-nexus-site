import type { ResourceVersionHelpProjection } from "@nexus/domain";
import { BookOpen } from "lucide-react";
import Link from "next/link";
import type { Locale } from "../lib/i18n";
import { getDictionary } from "../lib/i18n";
import { licenseModelLabel } from "../lib/license-model-i18n";
import { CopyablePlainCodeBlock } from "./copyable-plain-code-block";
import { ResourceVersionHelpSupportLink } from "./resource-version-help-support-link";

function renderSectionBody({
  paragraphs,
  codeBlocks,
  copyLabel,
  copiedLabel,
}: {
  paragraphs: string[];
  codeBlocks: string[];
  copyLabel: string;
  copiedLabel: string;
}) {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-secondary">
      {paragraphs.map((paragraph) => (
        <p key={paragraph} className="whitespace-pre-line">
          {paragraph}
        </p>
      ))}
      {codeBlocks.map((code) => (
        <CopyablePlainCodeBlock
          key={code}
          code={code}
          copyLabel={copyLabel}
          copiedLabel={copiedLabel}
        />
      ))}
    </div>
  );
}

export function ResourceVersionHelpSection({
  projection,
  locale,
  qaAnchorId = "resource-qa",
}: {
  projection: ResourceVersionHelpProjection;
  locale: Locale;
  qaAnchorId?: string;
}) {
  const copy = getDictionary(locale).versionHelpUi;
  const supportContext =
    projection.support.productId.length > 0
      ? {
          productId: projection.support.productId,
          ...(projection.support.buildId ? { buildId: projection.support.buildId } : {}),
        }
      : null;

  return (
    <section
      className="nexus-panel space-y-4 p-6"
      aria-labelledby="resource-version-help-heading"
      data-testid="resource-version-help"
      data-version={projection.version}
    >
      <div className="border-b border-base pb-3">
        <h2
          id="resource-version-help-heading"
          className="flex items-center gap-2 text-base font-bold text-primary"
        >
          <BookOpen className="h-4 w-4 text-accent" aria-hidden="true" />
          <span>{copy.title.replace("{version}", projection.version)}</span>
        </h2>
        <p className="mt-1 text-xs text-muted">{copy.versionScope}</p>
      </div>

      {projection.missingAuthorContent ? (
        <p className="text-sm text-secondary">{copy.missingBody}</p>
      ) : null}

      {projection.purpose ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-primary">{copy.sections.purpose}</h3>
          {renderSectionBody({
            ...projection.purpose,
            copyLabel: copy.copyCode,
            copiedLabel: copy.copiedCode,
          })}
        </div>
      ) : null}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-primary">{copy.sections.acquire}</h3>
        <p className="whitespace-pre-line text-sm leading-relaxed text-secondary">
          {copy.acquireBody.replace("{version}", projection.version)}
        </p>
        <p className="text-xs text-muted">{copy.acquireDisclaimer}</p>
      </div>

      {projection.setup ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-primary">{copy.sections.setup}</h3>
          {renderSectionBody({
            ...projection.setup,
            copyLabel: copy.copyCode,
            copiedLabel: copy.copiedCode,
          })}
        </div>
      ) : null}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-primary">{copy.sections.limits}</h3>
        <dl className="space-y-2 text-sm text-secondary">
          {projection.limits.map((line) => {
            const label = copy.limits[line.key];
            let value = copy.unknown;
            if (line.key === "licenseModel" && line.known && line.value) {
              value = licenseModelLabel(locale, line.value);
            } else if (line.known && line.value) {
              value =
                line.key === "versionMtaTarget" || line.key === "catalogMtaMin"
                  ? `>= ${line.value}`
                  : line.value;
            }
            return (
              <div
                key={line.key}
                className="flex flex-col gap-0.5 border-b border-base py-2 sm:flex-row sm:justify-between"
              >
                <dt className="text-muted">{label}</dt>
                <dd className="font-mono text-xs text-secondary sm:text-right">{value}</dd>
              </div>
            );
          })}
        </dl>
        <p className="text-xs text-muted">{copy.limitsNotice}</p>
      </div>

      <div className="space-y-2 border-t border-base pt-4">
        <h3 className="text-sm font-semibold text-primary">{copy.sections.support}</h3>
        <p className="text-sm text-secondary">{copy.supportBody}</p>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href={`#${qaAnchorId}`} className="font-semibold text-accent hover:underline">
            {copy.openQa}
          </Link>
          {supportContext ? (
            <ResourceVersionHelpSupportLink
              context={supportContext}
              className="font-semibold text-accent hover:underline"
            >
              {copy.openSupport}
            </ResourceVersionHelpSupportLink>
          ) : null}
        </div>
      </div>
    </section>
  );
}
