"use client";

import { useEffect, useState } from "react";
import {
  detectGlobalErrorLocale,
  type GlobalErrorLocale,
  globalErrorCopy,
} from "../features/shell/global-error-copy";
import { readSafePublicErrorReference } from "../features/shell/safe-public-error-reference";

export { detectGlobalErrorLocale } from "../features/shell/global-error-copy";

const focusRingStyle = `
  button:focus-visible, a:focus-visible {
    outline: 2px solid #7b86f7;
    outline-offset: 2px;
  }
`;

function detectLocale(): GlobalErrorLocale {
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
  const [locale, setLocale] = useState<GlobalErrorLocale>("en");
  const [copyMessage, setCopyMessage] = useState("");
  const reference = readSafePublicErrorReference(error);

  useEffect(() => {
    setLocale(detectLocale());
  }, []);

  const text = globalErrorCopy(locale);

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
              <button
                type="button"
                onClick={() => void copyReference()}
                style={{
                  marginTop: "12px",
                  minHeight: "36px",
                  border: "1px solid #39414c",
                  borderRadius: "8px",
                  padding: "0 12px",
                  cursor: "pointer",
                  background: "transparent",
                  color: "#f5f7fa",
                  fontWeight: 600,
                }}
              >
                {text.copyReference}
              </button>
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
