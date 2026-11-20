import { privateChangeHistoryCopy } from "../../../features/accounts/private-change-history-copy";
import { SettingsHistoryScreen } from "../../../features/accounts/settings-history-server";
import { getRequestLocale } from "../../../lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return {
    title: privateChangeHistoryCopy(await getRequestLocale()).profileTitle,
    robots: { index: false, follow: false },
  };
}

export default async function Page(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return SettingsHistoryScreen(props);
}
