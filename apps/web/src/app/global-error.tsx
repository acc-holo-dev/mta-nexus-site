"use client";

import { useEffect, useState } from "react";

type Locale = "en" | "ru";

const copy = {
  en: {
    title: "MTA NEXUS could not start",
    message:
      "A critical interface error prevented the application shell from loading. Retry the page or return to the home page.",
    retry: "Try again",
    home: "Home",
  },
  ru: {
    title: "Не удалось запустить MTA NEXUS",
    message:
      "Критическая ошибка интерфейса помешала загрузить оболочку приложения. Повторите попытку или вернитесь на главную страницу.",
    retry: "Повторить",
    home: "На главную",
  },
} as const;

function detectLocale(): Locale {
  if (typeof document === "undefined") return "en";

  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .some((part) => part === "nexus_locale=ru")
    ? "ru"
    : "en";
}

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    setLocale(detectLocale());
  }, []);

  const text = copy[locale];

  return (
    <html lang={locale}>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
          boxSizing: "border-box",
          background: "#0b0d10",
          color: "#f5f7fa",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        <main
          style={{
            width: "100%",
            maxWidth: "560px",
            padding: "28px",
            border: "1px solid #2a3038",
            borderRadius: "14px",
            background: "#12161b",
            boxSizing: "border-box",
          }}
        >
          <p
            style={{
              margin: "0 0 8px",
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: "#8d99a8",
            }}
          >
            MTA NEXUS
          </p>
          <h1
            style={{
              margin: 0,
              fontSize: "24px",
              lineHeight: 1.2,
            }}
          >
            {text.title}
          </h1>
          <p
            style={{
              margin: "12px 0 0",
              lineHeight: 1.6,
              color: "#b8c0ca",
            }}
          >
            {text.message}
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
              marginTop: "22px",
            }}
          >
            <button
              type="button"
              onClick={reset}
              style={{
                minHeight: "40px",
                border: 0,
                borderRadius: "8px",
                padding: "0 16px",
                cursor: "pointer",
                background: "#5865f2",
                color: "#ffffff",
                fontWeight: 700,
              }}
            >
              {text.retry}
            </button>
            <a
              href="/"
              style={{
                minHeight: "40px",
                display: "inline-flex",
                alignItems: "center",
                border: "1px solid #39414c",
                borderRadius: "8px",
                padding: "0 16px",
                color: "#f5f7fa",
                textDecoration: "none",
                fontWeight: 700,
                boxSizing: "border-box",
              }}
            >
              {text.home}
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
