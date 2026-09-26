import Link from "next/link";
import { CheckCircle2, Code2, ShieldCheck } from "lucide-react";
import { Avatar, EmptyState } from "@nexus/ui";
import { authService } from "../../lib/services/auth-service";
import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function DevelopersPage() {
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);
  const copy = dictionary.developers;
  const developers = await authService.listDevelopers(100);

  return (
    <div className="space-y-8">
      <div className="border-b border-base pb-6">
        <h1 className="flex items-center gap-2.5 text-2xl font-extrabold text-primary sm:text-3xl">
          <Code2 className="h-7 w-7 text-purple" aria-hidden="true" />
          <span>{copy.title}</span>
        </h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted">
          {copy.description}
        </p>
      </div>

      {developers.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {developers.map((developer) => (
            <Link
              key={developer.id}
              href={`/developers/${developer.username}`}
              className="group flex flex-col rounded-xl border border-base bg-surface p-6 shadow-nexus-sm transition-all hover:border-strong hover:shadow-nexus"
            >
              <div className="mb-4 flex items-center gap-4">
                <Avatar
                  src={developer.avatarUrl || undefined}
                  alt={developer.displayName}
                  fallback={developer.displayName || developer.username}
                  size="lg"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="truncate text-sm font-bold text-primary transition-colors group-hover:text-accent">
                      {developer.displayName}
                    </h3>
                    {developer.isVerified && (
                      <span title={copy.verifiedIdentity}>
                        <ShieldCheck
                          className="h-4 w-4 text-success"
                          aria-hidden="true"
                        />
                      </span>
                    )}
                  </div>
                  <div className="truncate text-xs text-faint">
                    @{developer.username}
                  </div>
                </div>
              </div>

              <p className="mb-4 line-clamp-2 flex-1 text-xs leading-relaxed text-muted">
                {developer.bio || copy.bioFallback}
              </p>

              <div className="flex items-center justify-between gap-3 border-t border-base pt-4 text-xs">
                <span className="flex min-w-0 items-center gap-1 font-medium text-success">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">
                    {developer.isVerified
                      ? copy.verifiedIdentity
                      : copy.creatorProfile}
                  </span>
                </span>
                <span className="shrink-0 font-semibold text-accent group-hover:underline">
                  {copy.viewPortfolio} →
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          title={copy.empty}
          description={copy.description}
          icon={<Code2 className="h-6 w-6" />}
        />
      )}
    </div>
  );
}
