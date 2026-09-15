import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "../components/navbar";
import { Footer } from "../components/footer";

export const metadata: Metadata = {
  title: "MTA NEXUS — Unified Infrastructure & Resource Ecosystem for MTA:SA",
  description:
    "Production platform for Multi Theft Auto servers, scripters, 3D artists, studio teams, and players. Buy, license, publish, and manage MTA resources.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col bg-[#090a0f] text-[#f1f5f9] antialiased">
        <Navbar />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
