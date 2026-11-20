"use client";

import { Button, ErrorState, fieldControlClass } from "@nexus/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { HonestLoadingShell } from "../../shell/honest-loading";
import { useNexusLocale } from "../../shell/locale";
import { panelSpace3P5 } from "../../shell/panel-shell";
import {
  typeElevenFaint,
  typeItemsStretchPy4,
  typeMt1XsMuted,
  typeSmSemiboldPrimary,
  typeXsMuted,
} from "../../shell/type-shell";

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
  const loadingLabel = dictionary.workspace.loading;
  const [contexts, setContexts] = useState<ContextOption[]>([]);
  const [activeContextId, setActiveContextId] = useState("personal");
  const [actorId, setActorId] = useState<string | null>(null);
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
        if (
          !response.ok ||
          !data ||
          typeof data.actorId !== "string" ||
          !data.actorId ||
          data.actorId.length > 128 ||
          data.actorId.trim() !== data.actorId
        ) {
          throw new Error(copy.loadError);
        }
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        setActorId(data.actorId);
        setContexts(Array.isArray(data.contexts) ? data.contexts : []);
        setActiveContextId(
          typeof data.activeContextId === "string" ? data.activeContextId : "personal",
        );
      })
      .catch(() => {
        if (!cancelled) {
          setActorId(null);
          setContexts([]);
          setError(copy.loadError);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [copy.loadError, reload]);

  async function switchContext(contextId: string) {
    if (saving || !actorId || contextId === activeContextId) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/context", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contextId, expectedActorId: actorId }),
        signal: AbortSignal.timeout(10_000),
      });
      const data = await response.json().catch(() => null);

      if (
        !response.ok ||
        data?.success !== true ||
        data.actorId !== actorId ||
        typeof data.activeContextId !== "string" ||
        data.activeContextId !== contextId
      ) {
        if (
          data?.code === "ACTOR_CHANGED" ||
          (data?.success === true && data.actorId !== actorId)
        ) {
          setActorId(null);
          setContexts([]);
        }
        setError(copy.switchError);
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

  if (loading) {
    return (
      <HonestLoadingShell
        className={panelSpace3P5}
        headingId="workspace-context-loading-heading"
        headingLevel={2}
        title={copy.title}
        description={<p className={typeMt1XsMuted}>{copy.description}</p>}
        loadingLabel={loadingLabel}
        titleClassName="text-sm font-semibold text-primary"
        statusClassName="text-xs text-muted"
        headerClassName="space-y-1"
      />
    );
  }

  if (contexts.length <= 1 && !error) return null;

  return (
    <section aria-busy={saving ? true : undefined} className={panelSpace3P5}>
      <div>
        <h2 className={typeSmSemiboldPrimary}>{copy.title}</h2>
        <p className={typeMt1XsMuted}>{copy.description}</p>
      </div>

      {contexts.length > 1 && (
        <label className="block space-y-1.5">
          <span className={typeXsMuted}>{copy.label}</span>
          <select
            value={activeContextId}
            onChange={(event) => void switchContext(event.target.value)}
            disabled={saving}
            className={fieldControlClass({
              disabled: saving,
              className: "min-h-11",
            })}
          >
            {contexts.map((context) => (
              <option key={context.id} value={context.id}>
                {context.type === "personal" ? context.name : `${context.name} (${context.role})`}
              </option>
            ))}
          </select>
        </label>
      )}

      {error ? (
        <ErrorState
          title={error}
          description={copy.errorHint}
          className={typeItemsStretchPy4}
          action={
            <Button
              type="button"
              variant="outline"
              onClick={() => setReload((value) => value + 1)}
              disabled={loading || saving}
              className="min-h-11 rounded-md"
            >
              {copy.retry}
            </Button>
          }
        />
      ) : null}

      <p className={typeElevenFaint}>{copy.note}</p>
    </section>
  );
}
