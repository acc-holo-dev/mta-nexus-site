import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { NexusShell } from "../components/nexus-shell";
import { PwaServiceWorker } from "../components/pwa-service-worker";
import { getDictionary } from "../lib/i18n";
import { getRequestLocale } from "../lib/i18n-server";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);

  return {
    title: {
      default: dictionary.meta.title,
      template: "%s | MTA NEXUS",
    },
    description: dictionary.meta.description,
    openGraph: {
      title: dictionary.meta.title,
      description: dictionary.meta.description,
      type: "website",
    },
  };
}

const themeInitScript = `
(function() {
  try {
    var t = localStorage.getItem('nexus-theme');
    if (t === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {
    document.documentElement.classList.add('dark');
  }
})();
`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getRequestLocale();

  return (
    <html lang={locale} className="dark" suppressHydrationWarning>
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
