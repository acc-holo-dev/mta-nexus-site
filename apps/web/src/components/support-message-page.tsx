import { AppError, RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import { ErrorState } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { getRequestLocale } from "../lib/i18n-server";
import { authService } from "../lib/services/auth-service";
import { supportMessageDiscoveryService } from "../lib/services/support-message-discovery-service";
import { parseSupportMessageQuery } from "../lib/support-message-discovery-contract";
import { supportMessageCopy, supportMessageError } from "../lib/support-message-discovery-copy";
import { PlatformSignIn } from "./platform-sign-in";
import { SupportMessageBrowser } from "./support-message-browser";

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
    copy = supportMessageCopy(locale),
    store = await cookies(),
    actor = await authService.getSession(store.get("nexus_session")?.value);
  const validId = /^sup_[a-f0-9]{24}$/u.test(id);
  const path = validId
    ? `${staff ? "/admin/support" : "/support"}/${id}/messages`
    : staff
      ? "/admin/support"
      : "/support";
  if (!actor) return <PlatformSignIn locale={locale} returnPath={path} />;
  try {
    if (!validId) throw new AppError("Support case not found", 404, "NOT_FOUND");
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(await searchParams)) {
      if (Array.isArray(value)) for (const item of value) query.append(key, item);
      else if (value !== undefined) query.append(key, value);
    }
    const filters = parseSupportMessageQuery(query);
    if (!filters)
      throw new AppError("Invalid message filters", 400, "CHANGE_HISTORY_FILTER_INVALID");
    if (!(await consumeRateLimit("search", actor.id)).success) throw new RateLimitExceededError();
    const page = await supportMessageDiscoveryService.page(
      id,
      actor.id,
      filters,
      staff,
      store.get("nexus_session")?.value ?? "",
    );
    return <SupportMessageBrowser page={page} filters={filters} locale={locale} staff={staff} />;
  } catch (error) {
    return (
      <div className="mx-auto min-w-0 max-w-4xl space-y-4 overflow-x-clip">
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
