import { safeExternalWebUrl } from "@nexus/validation";
import { ShieldCheck } from "lucide-react";
import type { Locale } from "../../../lib/i18n";
import { panelSpace4P5 } from "../../shell/panel-shell";
import { typeBreakSmSecondary, typeFlexWrapGap2, typeHeadingPrimary } from "../../shell/type-shell";
import { verificationCopy } from "../../trust/verification-workspace-copy";
export function DeveloperExperience({
  profile,
  locale,
}: {
  profile: {
    specialties: string[];
    githubUrl: string | null;
    discordTag: string | null;
    verifiedDeveloper: boolean;
  } | null;
  locale: Locale;
}) {
  if (!profile) return null;
  const copy = verificationCopy(locale);
  const githubUrl = safeExternalWebUrl(profile.githubUrl);
  return (
    <section className={panelSpace4P5} aria-label={copy.profile}>
      <h2 className={typeHeadingPrimary}>{copy.profile}</h2>
      {profile.verifiedDeveloper && (
        <p className="flex items-center gap-2 text-sm font-semibold text-success">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          {copy.experience}
        </p>
      )}
      <ul className={typeFlexWrapGap2}>
        {profile.specialties.map((specialty) => (
          <li
            key={specialty}
            className="rounded-md border border-base px-3 py-1 text-xs text-secondary"
          >
            {specialty}
          </li>
        ))}
      </ul>
      {githubUrl && (
        <a
          className="block break-all text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
          href={githubUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {copy.github}
        </a>
      )}
      {profile.discordTag && (
        <p className={typeBreakSmSecondary}>
          {copy.discord}: {profile.discordTag}
        </p>
      )}
    </section>
  );
}
