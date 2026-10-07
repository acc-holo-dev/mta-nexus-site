"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import {
  nextThemePreference,
  parseThemePreference,
  resolveThemePreference,
  SYSTEM_THEME_QUERY,
  type ThemePreference,
} from "../lib/theme-preference";
import { useNexusLocale } from "./locale-context";

export function ThemeToggle() {
  const { dictionary } = useNexusLocale();
  const copy = dictionary.theme;
  const [theme, setTheme] = useState<ThemePreference>("system");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      setTheme(parseThemePreference(localStorage.getItem("nexus-theme")));
    } catch {
      setTheme("system");
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    const media = window.matchMedia(SYSTEM_THEME_QUERY);
    const apply = () => {
      const resolved = resolveThemePreference(theme, media.matches);
      document.documentElement.classList.toggle("dark", resolved === "dark");
    };

    apply();

    if (theme !== "system") {
      return;
    }

    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  const nextTheme = nextThemePreference(theme);
  const label =
    nextTheme === "light"
      ? copy.switchToLight
      : nextTheme === "dark"
        ? copy.switchToDark
        : copy.useSystem;

  const toggle = () => {
    setTheme(nextTheme);

    try {
      localStorage.setItem("nexus-theme", nextTheme);
    } catch {
      // Keep the preference for this page even if browser storage is unavailable.
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={!hydrated}
      data-theme-toggle=""
      data-hydrated={hydrated ? "true" : "false"}
      className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-base bg-elevated p-0 text-muted transition-colors hover:bg-hover hover:text-primary disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
      aria-label={label}
      title={label}
    >
      {nextTheme === "light" ? (
        <Sun className="h-4 w-4" aria-hidden="true" />
      ) : nextTheme === "dark" ? (
        <Moon className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Monitor className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  );
}
