import type { Metadata } from "next";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";

export async function settingsLayoutMetadata(): Promise<Metadata> {
  return {
    title: `${getDictionary(await getRequestLocale()).settings.title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export function SettingsPassthroughLayout({ children }: { children: React.ReactNode }) {
  return children;
}
