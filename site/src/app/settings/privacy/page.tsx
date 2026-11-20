import { profilePrivacyCopy } from "../../../features/accounts/profile-privacy-copy";
import { SettingsPrivacyScreen } from "../../../features/accounts/settings-privacy-server";
import { getRequestLocale } from "../../../lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return {
    title: profilePrivacyCopy(await getRequestLocale()).title,
    robots: { index: false, follow: false },
  };
}

export default async function Page() {
  return SettingsPrivacyScreen();
}
