import { SettingsDeveloperScreen } from "../../../features/accounts/settings-developer-server";
import { verificationCopy } from "../../../features/trust/verification-workspace-copy";
import { getRequestLocale } from "../../../lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return {
    title: verificationCopy(await getRequestLocale()).profile,
    robots: { index: false, follow: false },
  };
}

export default async function Page() {
  return SettingsDeveloperScreen();
}
