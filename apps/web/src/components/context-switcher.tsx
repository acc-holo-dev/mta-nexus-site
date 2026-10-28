"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useNexusLocale } from "./locale-context";

type ContextOption = {
  id: string;
  type: "personal" | "organization";
  name: string;
  slug?: string;
  role: string;
};

export function ContextSwitcher() {
  const router = useRouter();
  const { dictionary } = useNexusLocale();
  const copy = dictionary.workspaceContext;
  const [contexts, setContexts] = useState<ContextOption[]>([]);
  const [activeContextId, setActiveContextId] = useState("personal");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies(reload): Explicit refresh trigger; changing it must restart this request.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch("/api/auth/context", {
      cache: "no-store",
      credentials: "same-origin",
      signal: AbortSignal.timeout(10_000),
    })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok || !data) {
          throw new Error(copy.loadError);
        }
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        setContexts(Array.isArray(data.contexts) ? data.contexts : []);
        setActiveContextId(
          typeof data.activeContextId === "string" ? data.activeContextId : "personal",
        );
      })
      .catch(() => {
        if (!cancelled) setError(copy.loadError);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [copy.loadError, reload]);

  async function switchContext(contextId: string) {
    if (saving || contextId === activeContextId) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/context", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contextId }),
        signal: AbortSignal.timeout(10_000),
      });
      const data = await response.json().catch(() => null);

      if (
        !response.ok ||
        data?.success !== true ||
        typeof data.activeContextId !== "string" ||
        data.activeContextId !== contextId
      ) {
        setError(data?.error || copy.switchError);
        return;
      }

      setActiveContextId(data.activeContextId);
      router.refresh();
    } catch {
      setError(copy.switchError);
    } finally {
      setSaving(false);
    }
  }

  if (loading || (contexts.length <= 1 && !error)) return null;

  return (
    <section className="nexus-panel space-y-3 p-5">
      <div>
        <h2 className="text-sm font-semibold text-primary">{copy.title}</h2>
        <p className="mt-1 text-xs text-muted">{copy.description}</p>
      </div>

      {contexts.length > 1 && (
        <label className="block space-y-1.5">
          <span className="text-xs text-muted">{copy.label}</span>
          <select
            value={activeContextId}
            onChange={(event) => void switchContext(event.target.value)}
            disabled={saving}
            className="h-10 w-full rounded-md border border-base bg-inset px-3 text-sm text-primary outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] disabled:opacity-60"
          >
            {contexts.map((context) => (
              <option key={context.id} value={context.id}>
                {context.type === "personal" ? context.name : `${context.name} (${context.role})`}
              </option>
            ))}
          </select>
        </label>
      )}

      {error && (
        <div className="flex flex-wrap items-center gap-3">
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
          <button
            type="button"
            onClick={() => setReload((value) => value + 1)}
            disabled={loading || saving}
            className="rounded-md border border-base px-3 py-1.5 text-xs font-medium text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--nexus-accent)] disabled:opacity-60"
          >
            {copy.retry}
          </button>
        </div>
      )}

      <p className="text-[11px] text-faint">{copy.note}</p>
    </section>
  );
}
