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

  useEffect(() => {
    let cancelled = false;

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
          typeof data.activeContextId === "string"
            ? data.activeContextId
            : "personal",
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
  }, [copy.loadError]);

  async function switchContext(contextId: string) {
    if (saving || contextId === activeContextId) return;

    const previousContextId = activeContextId;
    setActiveContextId(contextId);
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

      if (!response.ok) {
        setActiveContextId(previousContextId);
        setError(data?.error || copy.switchError);
        return;
      }

      router.refresh();
    } catch {
      setActiveContextId(previousContextId);
      setError(copy.switchError);
    } finally {
      setSaving(false);
    }
  }

  if (loading || contexts.length <= 1) return null;

  return (
    <section className="nexus-panel space-y-3 p-5">
      <div>
        <h2 className="text-sm font-semibold text-primary">{copy.title}</h2>
        <p className="mt-1 text-xs text-muted">{copy.description}</p>
      </div>

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
              {context.type === "personal"
                ? context.name
                : `${context.name} (${context.role})`}
            </option>
          ))}
        </select>
      </label>

      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}

      <p className="text-[11px] text-faint">{copy.note}</p>
    </section>
  );
}
