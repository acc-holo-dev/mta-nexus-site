import type { Metadata } from "next";
import { Source_Sans_3, Unbounded } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { NexusShell } from "../components/nexus-shell";
import { PwaServiceWorker } from "../components/pwa-service-worker";
import { getDictionary } from "../lib/i18n";
import { getRequestLocale } from "../lib/i18n-server";

/** Display: Unbounded (Latin + Cyrillic) — brand-first hero/headings, not Inter/system. */
const displayFont = Unbounded({
  subsets: ["latin", "cyrillic"],
  variable: "--font-nexus-display",
  display: "swap",
});

const bodyFont = Source_Sans_3({
  subsets: ["latin", "cyrillic"],
  variable: "--font-nexus-sans",
  display: "swap",
});

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
  var preference = 'system';

  try {
    var stored = localStorage.getItem('nexus-theme');
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      preference = stored;
    }
  } catch (e) {
    // Storage can be unavailable in hardened browser modes. System theme remains safe.
  }

  var prefersDark =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : true;
  var useDark =
    preference === 'dark' || (preference === 'system' && prefersDark);

  document.documentElement.classList.toggle('dark', useDark);
  document.documentElement.style.colorScheme = useDark ? 'dark' : 'light';
})();
`;

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
