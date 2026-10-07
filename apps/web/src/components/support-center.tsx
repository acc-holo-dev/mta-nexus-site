"use client";

import { LifeBuoy, MessageSquareText, Plus } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { useNexusLocale } from "./locale-context";

type SupportCaseSummary = {
  id: string;
  category: string;
  subject: string;
  status: "open" | "resolved" | "closed";
  updatedAt: string;
  requesterUsername?: string;
};

export function SupportCenter({ staffMode = false }: { staffMode?: boolean }) {
  const { locale, dictionary } = useNexusLocale();
  const copy = dictionary.support;
  const [cases, setCases] = useState<SupportCaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState("account");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const categories = [
    ["account", copy.categoryAccount],
    ["resource", copy.categoryResource],
    ["server", copy.categoryServer],
    ["purchase", copy.categoryPurchase],
    ["license", copy.categoryLicense],
    ["payment", copy.categoryPayment],
    ["seller", copy.categorySeller],
    ["integration", copy.categoryIntegration],
    ["other", copy.categoryOther],
  ] as const;

  const categoryLabel = (value: string) =>
    categories.find(([candidate]) => candidate === value)?.[1] ?? value;

  const loadCases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        staffMode ? "/api/support?scope=staff" : "/api/support",
        {
          cache: "no-store",
          credentials: "same-origin",
          signal: AbortSignal.timeout(15_000),
        },
      );
      if (response.status === 401) {
        setAuthRequired(true);
        setCases([]);
        return;
      }

      const data = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(data?.cases)) {
        throw new Error(copy.loadError);
      }

      setAuthRequired(false);
      setCases(data.cases);
    } catch {
      setCases([]);
      setError(copy.loadError);
    } finally {
      setLoading(false);
    }
  }, [copy.loadError, staffMode]);

  useEffect(() => {
    void loadCases();
  }, [loadCases]);

  async function createCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creating) return;

    setCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/support", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, subject, message }),
        signal: AbortSignal.timeout(15_000),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.success !== true || !data?.supportCase?.id) {
        throw new Error(copy.createError);
      }

      setSubject("");
      setMessage("");
      await loadCases();
    } catch {
      setError(copy.createError);
    } finally {
      setCreating(false);
    }
  }

  const dateLocale = locale === "ru" ? "ru-RU" : "en-US";
  const basePath = staffMode ? "/admin/support" : "/support";
  const statusLabel = (status: SupportCaseSummary["status"]) =>
    status === "open"
      ? copy.open
      : status === "resolved"
        ? copy.resolved
        : copy.closed;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="space-y-2 border-b border-base pb-6">
        <h1 className="flex items-center gap-2.5 font-display text-primary">
          <LifeBuoy className="h-6 w-6 text-accent" aria-hidden="true" />
          <span>{staffMode ? copy.staffQueue : copy.title}</span>
        </h1>
        <p className="max-w-3xl text-sm text-muted">
          {staffMode ? copy.staffDescription : copy.description}
        </p>
        {!staffMode && (
          <p className="text-xs text-warning">{copy.noGuaranteedSla}</p>
        )}
      </header>

      {authRequired ? (
        <div className="nexus-panel space-y-3 p-5">
          <p className="text-sm text-secondary">{copy.authRequired}</p>
          <Link
            href="/auth/login"
            className="inline-flex rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
          >
            {copy.signIn}
          </Link>
        </div>
      ) : (
        <>
          {!staffMode && (
            <form
              onSubmit={(event) => void createCase(event)}
              className="nexus-panel space-y-4 p-5"
            >
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-accent" aria-hidden="true" />
                <h2 className="font-heading text-primary">{copy.newCase}</h2>
              </div>

              <label className="block space-y-1.5">
                <span className="font-label text-secondary">{copy.category}</span>
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="w-full rounded-lg border border-base bg-surface px-3 py-2 text-sm text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                >
                  {categories.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="font-label text-secondary">{copy.subject}</span>
                <input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  minLength={5}
                  maxLength={120}
                  required
                  className="w-full rounded-lg border border-base bg-surface px-3 py-2 text-sm text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                  placeholder={copy.subjectPlaceholder}
                />
              </label>

              <label className="block space-y-1.5">
                <span className="font-label text-secondary">{copy.message}</span>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  minLength={10}
                  maxLength={4000}
                  required
                  rows={5}
                  className="w-full resize-y rounded-lg border border-base bg-surface px-3 py-2 text-sm text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                  placeholder={copy.messagePlaceholder}
                />
              </label>

              <button
                type="submit"
                disabled={creating}
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              >
                <MessageSquareText className="h-4 w-4" aria-hidden="true" />
                {creating ? copy.creating : copy.create}
              </button>
            </form>
          )}

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-[color:var(--nexus-danger)]/25 bg-danger-soft p-4 text-sm text-danger"
            >
              {error}
            </div>
          )}

          <section className="space-y-3">
            <h2 className="font-heading text-primary">
              {staffMode ? copy.staffQueue : copy.yourCases}
            </h2>

            {loading ? (
              <p className="text-sm text-muted">{copy.loading}</p>
            ) : cases.length === 0 ? (
              <div className="nexus-panel p-5 text-sm text-muted">
                {copy.empty}
              </div>
            ) : (
              cases.map((supportCase) => (
                <Link
                  key={supportCase.id}
                  href={`${basePath}/${encodeURIComponent(supportCase.id)}`}
                  className="nexus-panel block space-y-2 p-4 transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="break-words text-sm font-bold text-primary">
                        {supportCase.subject}
                      </h3>
                      {staffMode && supportCase.requesterUsername && (
                        <p className="mt-1 text-xs text-muted">
                          {copy.requester}: @{supportCase.requesterUsername}
                        </p>
                      )}
                    </div>
                    <span className="rounded-full border border-base bg-inset px-2.5 py-1 font-label text-muted">
                      {statusLabel(supportCase.status)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-faint">
                    <span>{categoryLabel(supportCase.category)}</span>
                    <time
                      dateTime={new Date(supportCase.updatedAt).toISOString()}
                    >
                      {copy.updated}:{" "}
                      {new Date(supportCase.updatedAt).toLocaleString(dateLocale)}
                    </time>
                  </div>
                </Link>
              ))
            )}
          </section>
        </>
      )}
    </div>
  );
}
