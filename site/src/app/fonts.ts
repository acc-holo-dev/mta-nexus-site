import { Source_Sans_3, Unbounded } from "next/font/google";

/** Display: Unbounded (Latin + Cyrillic) — brand-first hero/headings, not Inter/system. */
export const displayFont = Unbounded({
  subsets: ["latin", "cyrillic"],
  variable: "--font-nexus-display",
  display: "swap",
});

export const bodyFont = Source_Sans_3({
  subsets: ["latin", "cyrillic"],
  variable: "--font-nexus-sans",
  display: "swap",
});
