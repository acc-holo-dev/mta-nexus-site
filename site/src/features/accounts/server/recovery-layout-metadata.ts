import type { Metadata } from "next";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";

async function recoveryLayoutMetadata(
  titleKey: "forgotTitle" | "resetTitle" | "verifyTitle",
): Promise<Metadata> {
  return {
    title: `${getDictionary(await getRequestLocale()).recovery[titleKey]} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function forgotPasswordLayoutMetadata(): Promise<Metadata> {
  return recoveryLayoutMetadata("forgotTitle");
}

export async function resetPasswordLayoutMetadata(): Promise<Metadata> {
  return recoveryLayoutMetadata("resetTitle");
}

export async function verifyEmailLayoutMetadata(): Promise<Metadata> {
  return recoveryLayoutMetadata("verifyTitle");
}
