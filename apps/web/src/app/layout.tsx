import type { Metadata } from "next";
import "./globals.css";
import { NexusShell } from "../components/nexus-shell";

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
      <body className="min-h-screen bg-[#090a0f] text-[#f1f5f9] antialiased">
        <NexusShell>{children}</NexusShell>
      </body>
    </html>
  );
}
