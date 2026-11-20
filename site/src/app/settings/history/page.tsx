import {
  SettingsHistoryScreen,
  settingsHistoryMetadata,
} from "../../../features/accounts/settings-history-server";

export const dynamic = "force-dynamic";

export const generateMetadata = settingsHistoryMetadata;

export default async function Page(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return SettingsHistoryScreen(props);
}
