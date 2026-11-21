import Script from "next/script";
import type { ReactNode } from "react";
import { getRequestLocale } from "../../../lib/i18n/server";
import { isWalletEngineEnabled } from "../../../lib/services/commerce/wallet-payment-service";
import { bodyFont, displayFont } from "../fonts";
import { PwaServiceWorker } from "../pwa-service-worker";
import { NexusShell } from "../shell";
import { themeInitScript } from "../theme-init-script";

export async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getRequestLocale();
  const walletEnabled = isWalletEngineEnabled();

  return (
    <html
      lang={locale}
      className={`dark ${displayFont.variable} ${bodyFont.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-page text-primary antialiased">
        <Script
          id="nexus-theme-init"
          strategy="beforeInteractive"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: This script is a static local constant with no user input.
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
        <PwaServiceWorker />
        <NexusShell locale={locale} walletEnabled={walletEnabled}>
          {children}
        </NexusShell>
      </body>
    </html>
  );
}
