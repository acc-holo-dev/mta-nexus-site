import { safeExternalWebUrl } from "@nexus/validation";
import { linkAccentTightBreakAll } from "../../shell/link-shell";

export function ReportEvidenceLinks({ urls, label }: { urls: string[]; label: string }) {
  const links = [
    ...new Set(
      urls
        .slice(0, 5)
        .map(safeExternalWebUrl)
        .filter((url): url is string => url !== undefined),
    ),
  ];
  if (links.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 font-caption text-faint">
      <span>{label}:</span>
      {links.map((url, index) => (
        <a
          key={url}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${label} ${index + 1}: ${url}`}
          className={linkAccentTightBreakAll}
        >
          {index + 1}
        </a>
      ))}
    </div>
  );
}
