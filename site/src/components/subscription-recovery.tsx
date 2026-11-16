"use client";
import { commercialPlanTermsSchema, subscriptionCommandSchema } from "@nexus/validation";
import { useEffect, useState } from "react";
import { privateApiRequest } from "../lib/private-api-request";
import { useNexusLocale } from "./locale-context";
import { SubscriptionControls } from "./subscription-controls";
import { PlanReviewTerms } from "./plan-review-terms";

export function SubscriptionRecovery({ actorId }: { actorId: string }) {
  const { locale } = useNexusLocale();
  const [item, setItem] = useState<{
    actorId: string;
    command: ReturnType<typeof subscriptionCommandSchema.parse>;
    snapshot: {
      terms: ReturnType<typeof commercialPlanTermsSchema.parse>;
      planId: string;
      planRevision: number;
      startedAt?: string;
      expiresAt?: string;
    };
  } | null>(null);
  useEffect(() => {
    let active = true;
    let generation = 0;
    async function load() {
      const current = ++generation;
      try {
        const response = await fetch("/api/auth/session", privateApiRequest());
        const session = await response.json();
        if (!response.ok || session?.authenticated !== true || session?.user?.id !== actorId)
          throw new Error("identity");
        const raw = sessionStorage.getItem(
          `nexus:subscription-intent:v1:${encodeURIComponent(actorId)}`,
        );
        if (!raw || raw.length > 20000) {
          if (active && current === generation) setItem(null);
          return;
        }
        const saved = JSON.parse(raw);
        const command = subscriptionCommandSchema.parse(saved.command);
        const terms = commercialPlanTermsSchema.parse(saved.snapshot?.terms);
        if (
          saved.actorId !== actorId ||
          saved.subjectId !== (command.organizationId ?? actorId) ||
          typeof saved.snapshot?.planId !== "string" ||
          !Number.isSafeInteger(saved.snapshot?.planRevision) ||
          (command.action === "cancel" &&
            (typeof saved.snapshot.startedAt !== "string" ||
              typeof saved.snapshot.expiresAt !== "string"))
        )
          throw new Error("storage");
        if (active && current === generation)
          setItem({ actorId, command, snapshot: { ...saved.snapshot, terms } });
      } catch {
        if (active && current === generation) setItem(null);
      }
    }
    void load();
    window.addEventListener("nexus-subscription-intent", load);
    return () => {
      active = false;
      window.removeEventListener("nexus-subscription-intent", load);
    };
  }, [actorId]);
  if (!item || item.actorId !== actorId) return null;
  const { command, snapshot } = item;
  return (
    <section className="space-y-4">
      <h2>
        {locale === "ru" ? "Восстановление операции подписки" : "Recover subscription operation"}
      </h2>
      <p>
        {locale === "ru"
          ? "Результат предыдущего запроса не подтверждён. Повторите исходный запрос или проверьте историю."
          : "The previous request was not confirmed. Retry the original request or check history."}
      </p>
      <PlanReviewTerms terms={snapshot.terms} locale={locale} />
      {command.action === "activate" ? (
        <SubscriptionControls
          actorId={actorId}
          action="activate"
          planId={snapshot.planId}
          planRevision={snapshot.planRevision}
          terms={snapshot.terms}
          scope={command.organizationId ? "organization" : "user"}
          scopes={
            command.organizationId
              ? [{ id: command.organizationId, name: command.organizationId }]
              : []
          }
        />
      ) : (
        <SubscriptionControls
          actorId={actorId}
          action="cancel"
          planId={snapshot.planId}
          planRevision={snapshot.planRevision}
          terms={snapshot.terms}
          subscriptionId={command.subscriptionId}
          organizationId={command.organizationId}
          startedAt={snapshot.startedAt ?? ""}
          expiresAt={snapshot.expiresAt ?? ""}
        />
      )}
    </section>
  );
}
