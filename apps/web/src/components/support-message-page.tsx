import { AppError, RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import { cookies } from "next/headers";
import Link from "next/link";
import { getRequestLocale } from "../lib/i18n-server";
import { authService } from "../lib/services/auth-service";
import { supportMessageDiscoveryService } from "../lib/services/support-message-discovery-service";
import { parseSupportMessageQuery } from "../lib/support-message-discovery-contract";
import { supportMessageCopy, supportMessageError } from "../lib/support-message-discovery-copy";
import { PlatformSignIn } from "./content-catalog-controls";
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
  if (!actor) return <PlatformSignIn locale={locale} />;
  const validId = /^sup_[a-f0-9]{24}$/u.test(id);
  const path = validId
    ? `${staff ? "/admin/support" : "/support"}/${id}/messages`
    : staff
      ? "/admin/support"
      : "/support";
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
    const page = await supportMessageDiscoveryService.page(id, actor.id, filters, staff);
    return <SupportMessageBrowser page={page} filters={filters} locale={locale} staff={staff} />;
  } catch (error) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <p role="alert" className="nexus-panel p-5 text-danger">
          {supportMessageError(locale, error instanceof AppError ? error.code : "INTERNAL_ERROR")}
        </p>
        <Link href={path} className="text-accent underline">
          {copy.reset}
        </Link>
      </div>
    );
  }
}
