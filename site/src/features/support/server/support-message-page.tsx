import { AppError, RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import { ErrorState } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n-server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { supportMessageDiscoveryService } from "../../../lib/services/support/support-message-discovery-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { SupportMessageBrowser } from "../components/support-message-browser";
import { parseSupportMessageQuery } from "../support-message-discovery-contract";
import { supportMessageCopy, supportMessageError } from "../support-message-discovery-copy";

export async function supportMessageMetadata() {
  return {
    title: supportMessageCopy(await getRequestLocale()).title,
    robots: { index: false, follow: false },
  };
}
export async function SupportMessagePage({
  id,
  searchParams,
  staff = false,
}: {
  id: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  staff?: boolean;
}) {
  const locale = await getRequestLocale(),
    copy = supportMessageCopy(locale);
  const validId = /^sup_[a-f0-9]{24}$/u.test(id);
  const path = validId
    ? `${staff ? "/admin/support" : "/support"}/${id}/messages`
    : staff
      ? "/admin/support"
      : "/support";
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (Array.isArray(value)) for (const item of value) query.append(key, item);
    else if (value !== undefined) query.append(key, value);
  }
  let token: string | undefined;
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    token = (await cookies()).get("nexus_session")?.value;
    actor = await authService.getSession(token);
  } catch {
    return (
      <div className="mx-auto min-w-0 max-w-4xl space-y-4 overflow-x-clip">
        <h1 className="font-display text-primary">{copy.title}</h1>
        <ErrorState
          title={copy.unavailable}
          action={
            <Link
              href={validId && query.size ? `${path}?${query}` : path}
              className="inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {getDictionary(locale).errors.retry}
            </Link>
          }
        />
      </div>
    );
  }
  if (!actor) return <PlatformSignIn locale={locale} returnPath={path} />;
  try {
    if (!validId) throw new AppError("Support case not found", 404, "NOT_FOUND");
    const filters = parseSupportMessageQuery(query);
    if (!filters)
      throw new AppError("Invalid message filters", 400, "CHANGE_HISTORY_FILTER_INVALID");
    if (!(await consumeRateLimit("search", actor.id)).success) throw new RateLimitExceededError();
    const page = await supportMessageDiscoveryService.page(
      id,
      actor.id,
      filters,
      staff,
      token ?? "",
    );
    return <SupportMessageBrowser page={page} filters={filters} locale={locale} staff={staff} />;
  } catch (error) {
    return (
      <div className="mx-auto min-w-0 max-w-4xl space-y-4 overflow-x-clip">
        <h1 className="font-display text-primary">{copy.title}</h1>
        <ErrorState
          title={supportMessageError(
            locale,
            error instanceof AppError ? error.code : "INTERNAL_ERROR",
          )}
          action={
            <Link
              href={path}
              className="inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {copy.reset}
            </Link>
          }
        />
      </div>
    );
  }
}
