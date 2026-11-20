import { can } from "@nexus/security";
import { ErrorState } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { PlatformGuestAuthPanel, PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSmRounded } from "../../shell/link-shell";
import {
  pageShellMax5xlBare,
  pageShellMax5xlDenseTight,
  pageShellMax5xlLooseTight,
} from "../../shell/page-shell";
import { PlatformSessionError } from "../../shell/session-error";
import { typeDisplayPrimary } from "../../shell/type-shell";
import { SupportCenter } from "../center";
import { supportQuery } from "../support-workspace-contract";
import { supportWorkspaceCopy } from "../support-workspace-copy";
import { SupportCaseThread } from "../thread";

export async function supportMetadata(staff = false) {
  const copy = getDictionary(await getRequestLocale()).support;
  return { title: staff ? copy.staffQueue : copy.title, robots: { index: false, follow: false } };
}

export async function SupportPageSurface({
  searchParams,
  staff = false,
  id,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
  staff?: boolean;
  id?: string;
}) {
  const locale = await getRequestLocale(),
    copy = supportWorkspaceCopy(locale),
    dictionary = getDictionary(locale),
    support = dictionary.support;
  const base = staff ? "/admin/support" : "/support";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries((await searchParams) ?? {})) {
    if (Array.isArray(value)) for (const item of value) params.append(key, item);
    else if (value !== undefined) params.append(key, value);
  }
  const listReturnPath = params.size ? `${base}?${params}` : base;
  const validId = id !== undefined && /^sup_[a-f0-9]{24}$/u.test(id);
  const casePath = validId ? `${base}/${id}` : base;
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={support.title}
        message={copy.unavailable}
        retryHref={id === undefined ? listReturnPath : casePath}
      />
    );
  }
  if (!actor) {
    // Case detail uses the shared gate; the list keeps the Support H1 shell a11y asserts.
    if (id !== undefined) return <PlatformSignIn locale={locale} returnPath={casePath} />;
    return (
      <div className={pageShellMax5xlLooseTight}>
        <header className="space-y-2 border-b border-base pb-6">
          <h1 className={typeDisplayPrimary}>{support.title}</h1>
          <p className="max-w-3xl text-sm text-muted">{support.description}</p>
          <ErrorState
            id="support-no-guaranteed-sla"
            title={support.noGuaranteedSla}
            description={support.noGuaranteedSlaHint}
          />
        </header>
        <PlatformGuestAuthPanel locale={locale} returnPath={listReturnPath} />
      </div>
    );
  }
  if (staff && !can(actor, "admin.moderation"))
    return (
      <div className={pageShellMax5xlBare}>
        <h1 className={typeDisplayPrimary}>{support.staffQueue}</h1>
        <ErrorState
          title={copy.forbidden}
          description={copy.forbiddenHint}
          action={
            <Link href="/support" className={linkAccentSmRounded}>
              {support.title}
            </Link>
          }
        />
      </div>
    );
  if (id !== undefined)
    return validId ? (
      <SupportCaseThread
        key={`${actor.id}:${id}`}
        caseId={id}
        staffMode={staff}
        actorId={actor.id}
      />
    ) : (
      <div className={pageShellMax5xlDenseTight}>
        <h1 className={typeDisplayPrimary}>{staff ? support.staffQueue : support.title}</h1>
        <ErrorState
          title={copy.notFound}
          description={copy.notFoundHint}
          action={
            <Link href={base} className={linkAccentSmRounded}>
              {support.back}
            </Link>
          }
        />
      </div>
    );
  const filters = supportQuery(params);
  if (!filters)
    return (
      <div className={pageShellMax5xlDenseTight}>
        <h1 className={typeDisplayPrimary}>{staff ? support.staffQueue : support.title}</h1>
        <ErrorState
          title={copy.queryInvalid}
          description={copy.queryInvalidHint}
          action={
            <Link href={base} className={linkAccentSmRounded}>
              {copy.reset}
            </Link>
          }
        />
      </div>
    );
  return (
    <SupportCenter
      staffMode={staff}
      actorId={actor.id}
      initialFilters={filters}
      initialDraft={
        filters.draft === "publication" && filters.subject
          ? { category: "other", subject: filters.subject }
          : null
      }
      key={`${actor.id}:${params.toString()}`}
    />
  );
}

export const memberSupportMetadata = () => supportMetadata(false);
export const adminSupportMetadata = () => supportMetadata(true);

export function MemberSupportQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return SupportPageSurface({ searchParams });
}

export function AdminSupportQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return SupportPageSurface({ searchParams, staff: true });
}

export async function MemberSupportCasePage({ params }: { params: Promise<{ id: string }> }) {
  return SupportPageSurface({ id: (await params).id });
}

export async function AdminSupportCasePage({ params }: { params: Promise<{ id: string }> }) {
  return SupportPageSurface({ id: (await params).id, staff: true });
}
