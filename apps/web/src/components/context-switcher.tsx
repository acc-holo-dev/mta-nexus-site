"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type ContextOption = {
  id: string;
  type: "personal" | "organization";
  name: string;
  slug?: string;
  role: string;
};

export function ContextSwitcher() {
  const router = useRouter();
  const [contexts, setContexts] = useState<ContextOption[]>([]);
  const [activeContextId, setActiveContextId] = useState("personal");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/context", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load account contexts");
        return response.json();
      })
      .then((data) => {
        if (cancelled) return;
        setContexts(Array.isArray(data.contexts) ? data.contexts : []);
        setActiveContextId(
          typeof data.activeContextId === "string" ? data.activeContextId : "personal"
        );
      })
      .catch(() => {
        if (!cancelled) setError("Could not load account contexts.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function switchContext(contextId: string) {
    const previousContextId = activeContextId;
    setActiveContextId(contextId);
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contextId }),
      });
      const data = await response.json();

      if (!response.ok) {
        setActiveContextId(previousContextId);
        setError(data.error || "Could not switch context.");
        return;
      }

      router.refresh();
    } catch {
      setActiveContextId(previousContextId);
      setError("Could not switch context.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || contexts.length <= 1) return null;

  return (
    <section className="nexus-panel p-5 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-primary">Active workspace context</h2>
        <p className="text-xs text-muted mt-1">
          Switch between your personal workspace and organizations where you are a member.
        </p>
      </div>
      <label className="block space-y-1.5">
        <span className="text-xs text-muted">Context</span>
        <select
          value={activeContextId}
          onChange={(event) => switchContext(event.target.value)}
          disabled={saving}
          className="w-full h-10 rounded-md bg-inset border border-base px-3 text-sm text-primary disabled:opacity-60"
        >
          {contexts.map((context) => (
            <option key={context.id} value={context.id}>
              {context.type === "personal" ? context.name : context.name + " (" + context.role + ")"}
            </option>
          ))}
        </select>
      </label>
      {error && <p className="text-xs text-danger">{error}</p>}
      <p className="text-[11px] text-faint">
        Context switching changes the active workspace only; permissions still come from membership.
      </p>
    </section>
  );
}
