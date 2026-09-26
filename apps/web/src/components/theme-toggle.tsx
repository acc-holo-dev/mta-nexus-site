"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useNexusLocale } from "./locale-context";

export function ThemeToggle() {
  const { dictionary } = useNexusLocale();
  const copy = dictionary.theme;
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const stored = localStorage.getItem("nexus-theme");
    const initial =
      stored === "light" || stored === "dark" ? stored : "dark";
    setTheme(initial);
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("nexus-theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  const label =
    theme === "dark" ? copy.switchToLight : copy.switchToDark;

  return (
    <button
      type="button"
      onClick={toggle}
      className="cursor-pointer rounded-lg border border-base bg-elevated p-2 text-muted transition-colors hover:bg-hover hover:text-primary"
      aria-label={label}
      title={label}
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Moon className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  );
}
