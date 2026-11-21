import type { Metadata } from "next";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { isWalletEngineEnabled } from "../../../lib/services/commerce/wallet-payment-service";

export async function rootLayoutMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);
  const walletEnabled = isWalletEngineEnabled();
  const title = walletEnabled ? dictionary.meta.walletTitle : dictionary.meta.title;
  const description = walletEnabled
    ? dictionary.meta.walletDescription
    : dictionary.meta.description;

  return {
    title: {
      default: title,
      template: "%s | MTA NEXUS",
    },
    description,
    openGraph: {
      title,
      description,
      type: "website",
    },
  };
}
