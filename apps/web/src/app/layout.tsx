import type { Metadata } from "next";
import "./globals.css";
import { NexusShell } from "../components/nexus-shell";
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
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen bg-page text-primary antialiased">
        <NexusShell locale={locale}>{children}</NexusShell>
      </body>
    </html>
  );
}
