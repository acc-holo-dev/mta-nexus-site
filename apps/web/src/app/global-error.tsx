"use client";

import { Button } from "@nexus/ui";
import { useEffect, useState } from "react";
import { readSafePublicErrorReference } from "../lib/safe-public-error-reference";

type Locale = "en" | "ru";

const copy = {
  en: {
    title: "MTA NEXUS could not start",
    message:
      "A critical interface error prevented the application shell from loading. Retry the page or return to the home page.",
    retry: "Try again",
    home: "Home",
    referenceLabel: "Support reference",
    referenceHint: "Include this code when contacting support.",
    copyReference: "Copy reference",
    copied: "Copied",
    copyUnavailable: "Select and copy the code manually",
  },
  ru: {
    title: "Не удалось запустить MTA NEXUS",
    message:
      "Критическая ошибка интерфейса помешала загрузить оболочку приложения. Повторите попытку или вернитесь на главную страницу.",
    retry: "Повторить",
    home: "На главную",
    referenceLabel: "Код для поддержки",
    referenceHint: "Укажите этот код при обращении в поддержку.",
    copyReference: "Скопировать код",
    copied: "Скопировано",
    copyUnavailable: "Выделите и скопируйте код вручную",
  },
} as const;

const focusRingStyle = `
  button:focus-visible, a:focus-visible {
    outline: 2px solid #7b86f7;
    outline-offset: 2px;
  }
`;

export function detectGlobalErrorLocale(cookie: string): Locale {
  return cookie
    .split(";")
    .map((part) => part.trim())
    .some((part) => part === "nexus_locale=ru")
    ? "ru"
    : "en";
}

function detectLocale(): Locale {
  if (typeof document === "undefined") return "en";
  return detectGlobalErrorLocale(document.cookie);
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [locale, setLocale] = useState<Locale>("en");
  const [copyMessage, setCopyMessage] = useState("");
  const reference = readSafePublicErrorReference(error);

  useEffect(() => {
    setLocale(detectLocale());
  }, []);

  const text = copy[locale];

  async function copyReference() {
    if (!reference) return;
    setCopyMessage("");
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard unavailable");
      }
      await navigator.clipboard.writeText(reference);
      setCopyMessage(text.copied);
    } catch {
      setCopyMessage(text.copyUnavailable);
    }
  }

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
          fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        <style>{focusRingStyle}</style>
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

          {reference ? (
            <div
              style={{
                marginTop: "18px",
                padding: "12px 14px",
                borderRadius: "10px",
                border: "1px solid #2a3038",
                background: "#0b0d10",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "12px",
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  color: "#8d99a8",
                  textTransform: "uppercase",
                }}
              >
                {text.referenceLabel}
              </p>
              <code
                data-testid="error-public-reference"
                style={{
                  display: "block",
                  marginTop: "8px",
                  fontSize: "14px",
                  lineHeight: 1.4,
                  wordBreak: "break-all",
                  color: "#f5f7fa",
                }}
              >
                {reference}
              </code>
              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: "13px",
                  lineHeight: 1.5,
                  color: "#b8c0ca",
                }}
              >
                {text.referenceHint}
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void copyReference()}
                className="font-semibold"
                style={{
                  marginTop: "12px",
                  minHeight: "36px",
                  border: "1px solid #39414c",
                  borderRadius: "8px",
                  padding: "0 12px",
                  background: "transparent",
                  color: "#f5f7fa",
                }}
              >
                {text.copyReference}
              </Button>
              {copyMessage ? (
                <p
                  role="status"
                  style={{
                    margin: "8px 0 0",
                    fontSize: "12px",
                    color: "#8d99a8",
                  }}
                >
                  {copyMessage}
                </p>
              ) : null}
            </div>
          ) : null}

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
              marginTop: "22px",
            }}
          >
            <Button
              type="button"
              size="sm"
              onClick={reset}
              className="font-bold"
              style={{
                minHeight: "40px",
                border: 0,
                borderRadius: "8px",
                padding: "0 16px",
                background: "#5865f2",
                color: "#ffffff",
              }}
            >
              {text.retry}
            </Button>
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
