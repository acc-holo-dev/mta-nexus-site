"use client";
import {
  type ProductStatus,
  resourceModerationActionsFor,
  resourceModerationTarget,
  unavailableBuildSupportHref,
} from "@nexus/domain";
import { Button, ErrorState } from "@nexus/ui";
import { resourceModerationCommandSchema } from "@nexus/validation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { privateApiRequest } from "../lib/private-api-request";
import { confirmedResourceModeration } from "../lib/resource-release-control-confirmation";
import {
  getResourceReleaseControlCopy,
  resourceReleaseControlError,
} from "../lib/resource-release-control-i18n";
import { confirmAction } from "./confirm-action";
import { useNexusLocale } from "./locale-context";
import { stashSupportObjectContext } from "./support-center";

const textareaClass =
  "w-full rounded-lg border border-base bg-inset px-3 py-2 text-sm text-primary transition-colors placeholder:text-[color:var(--nexus-text-faint)] hover:border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)]";
const nativeLabelClass = "block font-label uppercase text-secondary";
export function ResourceModerationControls({
  product,
  selectedBuild = null,
}: {
  product: { id: string; status: string; updatedAt: string };
  selectedBuild?: { id: string; status: string; version?: string } | null;
}) {
  const { locale } = useNexusLocale(),
    copy = getResourceReleaseControlCopy(locale),
    field = useId(),
    router = useRouter(),
    lock = useRef(false);
  const status = product.status as ProductStatus;
  const observedStatus = useRef(product.status);
  const observedRevision = useRef(product.updatedAt);
  const allowed = resourceModerationActionsFor(status);
  const release = allowed.includes("release");
  const action = release ? "release" : "suspend";
  const target = resourceModerationTarget(status, action);
  const [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false),
    [error, setError] = useState("");

  useEffect(() => {
    if (
      observedStatus.current !== product.status ||
      observedRevision.current !== product.updatedAt
    ) {
      observedStatus.current = product.status;
      observedRevision.current = product.updatedAt;
      setSaved(false);
      setError("");
    }
  }, [product.status, product.updatedAt]);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (lock.current || saved) return;
    if (
      observedStatus.current !== product.status ||
      observedRevision.current !== product.updatedAt
    ) {
      setError(resourceReleaseControlError(locale, "PRODUCT_STATE_CHANGED"));
      router.refresh();
      return;
    }
    if (!target || allowed.length === 0) {
      setError(resourceReleaseControlError(locale, "PRODUCT_STATE_CHANGED"));
      router.refresh();
      return;
    }
    const parsed = resourceModerationCommandSchema.safeParse({
      action,
      reason,
      expectedUpdatedAt: product.updatedAt,
    });
    if (!parsed.success) {
      setError(copy.errors.RESOURCE_MODERATION_INVALID);
      return;
    }
    if (
      !(await confirmAction({
        title: release ? copy.release : copy.suspend,
        object: product.id,
        consequences: release ? copy.confirmRelease : copy.confirmSuspend,
        confirmLabel: release ? copy.release : copy.suspend,
        cancelLabel: copy.back,
        closeLabel: copy.back,
        ...(release ? { danger: false } : {}),
      }))
    )
      return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/resources/${encodeURIComponent(product.id)}`,
        privateApiRequest({ method: "POST", json: parsed.data }),
      );
      const value = await response.json().catch(() => null);
      if (!response.ok || !confirmedResourceModeration(value, product.id, parsed.data)) {
        setError(resourceReleaseControlError(locale, value?.code));
        if (response.status === 409) router.refresh();
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError(copy.errors.fallback);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  if (allowed.length === 0) {
    return (
      <div className="nexus-panel space-y-3 p-5">
        <p role="note" className="text-sm text-secondary">
          {copy.moderationNote}
        </p>
        <ErrorState
          title={
            locale === "ru"
              ? "Для текущего статуса нет разрешённого moderation-перехода."
              : "No moderation transition is allowed for the current status."
          }
        />
      </div>
    );
  }

  return (
    <form onSubmit={send} className="nexus-panel space-y-4 p-5">
      <p role="note" className="text-sm text-secondary">
        {copy.moderationNote}
      </p>
      <dl className="grid gap-2 text-sm text-secondary sm:grid-cols-2">
        <div>
          <dt className="font-label uppercase text-muted">
            {locale === "ru" ? "Статус ресурса" : "Resource status"}
          </dt>
          <dd className="text-primary">{product.status}</dd>
        </div>
        <div>
          <dt className="font-label uppercase text-muted">
            {locale === "ru" ? "Разрешённое действие" : "Allowed action"}
          </dt>
          <dd className="text-primary">{release ? copy.release : copy.suspend}</dd>
        </div>
      </dl>
      {release ? (
        <p className="text-sm text-warning">
          {locale === "ru"
            ? "Снятие ограничения возвращает черновик и требует новой проверки. Автоматической публикации нет."
            : "Release returns a draft and requires a new review. Nothing is auto-published."}
        </p>
      ) : null}
      {selectedBuild && selectedBuild.status !== "published" ? (
        <div className="rounded-lg border border-base bg-inset p-3 text-sm text-secondary">
          <p>
            {locale === "ru"
              ? `Сборка ${selectedBuild.version ?? selectedBuild.id} сейчас ${selectedBuild.status}.`
              : `Build ${selectedBuild.version ?? selectedBuild.id} is currently ${selectedBuild.status}.`}
          </p>
          <Link
            href={unavailableBuildSupportHref()}
            className="mt-2 inline-flex min-h-11 items-center text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            onClick={() =>
              stashSupportObjectContext({ productId: product.id, buildId: selectedBuild.id })
            }
          >
            {locale === "ru" ? "Контекст для поддержки" : "Support context"}
          </Link>
        </div>
      ) : null}
      <fieldset disabled={busy || saved} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor={`${field}-reason`} className={nativeLabelClass}>
            {copy.reason}
          </label>
          <textarea
            id={`${field}-reason`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            minLength={5}
            maxLength={2000}
            rows={3}
            required
            className={textareaClass}
          />
        </div>
      </fieldset>
      {error ? <ErrorState title={error} description={copy.actionFailedDescription} /> : null}
      {saved ? (
        <p role="status" className="text-sm text-success">
          {copy.saved}
          {release
            ? locale === "ru"
              ? " Следующий шаг автора — отправка черновика на проверку."
              : " Next author step: submit the draft for review."
            : ""}
        </p>
      ) : null}
      <Button type="submit" isLoading={busy} disabled={saved} className="min-h-11">
        {busy ? copy.saving : release ? copy.release : copy.suspend}
      </Button>
    </form>
  );
}
