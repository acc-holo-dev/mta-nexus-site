import Script from "next/script";
import "./globals.css";
import { PwaServiceWorker } from "../features/shell/pwa-service-worker";
import { rootLayoutMetadata } from "../features/shell/root-layout-metadata-server";
import { NexusShell } from "../features/shell/shell";
import { themeInitScript } from "../features/shell/theme-init-script";
import { getRequestLocale } from "../lib/i18n/server";
import { bodyFont, displayFont } from "./fonts";

export const generateMetadata = rootLayoutMetadata;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getRequestLocale();

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
        <NexusShell locale={locale}>{children}</NexusShell>
      </body>
    </html>
  );
}
