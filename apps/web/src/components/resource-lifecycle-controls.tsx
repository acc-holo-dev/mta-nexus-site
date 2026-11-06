"use client";

import {
  classifyBuildAvailability,
  type ProductStatus,
  type ResourceLifecycleAction,
  resourceLifecycleActionsFor,
  resourceLifecycleNextStep,
  resourceLifecycleTarget,
  unavailableBuildSupportHref,
} from "@nexus/domain";
import { Button, ErrorState } from "@nexus/ui";
import { resourceLifecycleSchema } from "@nexus/validation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { privateApiRequest } from "../lib/private-api-request";
import { getResourceCommerceCopy, resourceCommerceError } from "../lib/resource-commerce-i18n";
import { ActionConfirmCheckbox } from "./action-confirm-checkbox";
import { confirmAction } from "./confirm-action";
import { useNexusLocale } from "./locale-context";
import { stashSupportObjectContext } from "./support-center";

const controlClass =
  "min-h-11 w-full rounded-lg border border-base bg-inset px-3 py-2 text-sm text-primary transition-colors hover:border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)]";
const textareaClass =
  "w-full rounded-lg border border-base bg-inset px-3 py-2 text-sm text-primary transition-colors placeholder:text-[color:var(--nexus-text-faint)] hover:border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)]";
const nativeLabelClass = "block font-label uppercase text-secondary";

export function ResourceLifecycleControls({
  product,
  selectedBuild = null,
}: {
  product: { id: string; status: ProductStatus; updatedAt: string };
  selectedBuild?: { id: string; status: string; version?: string } | null;
}) {
  const { locale } = useNexusLocale();
  const copy = getResourceCommerceCopy(locale);
  const router = useRouter();
  const fieldId = useId();
  const lock = useRef(false);
  const observedStatus = useRef(product.status);
  const observedRevision = useRef(product.updatedAt);
  const actions = resourceLifecycleActionsFor(product.status);
  const [action, setAction] = useState<ResourceLifecycleAction>(actions[0] ?? "archive");
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (
      observedStatus.current !== product.status ||
      observedRevision.current !== product.updatedAt
    ) {
      observedStatus.current = product.status;
      observedRevision.current = product.updatedAt;
      const next = resourceLifecycleActionsFor(product.status);
      setAction(next[0] ?? "archive");
      setConfirmed(false);
      setSaved(false);
      setError("");
    }
  }, [product.status, product.updatedAt]);

  const labels = { archive: copy.archive, restore: copy.restore, submit: copy.submit };
  const notes = { archive: copy.archiveNote, restore: copy.restoreNote, submit: copy.submitNote };
  const nextStep = resourceLifecycleNextStep(product.status);
  const buildAvailability = classifyBuildAvailability(selectedBuild?.status);
  const target = resourceLifecycleTarget(product.status, action);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || saved) return;
    if (
      observedStatus.current !== product.status ||
      observedRevision.current !== product.updatedAt
    ) {
      setError(copy.errors.PRODUCT_METADATA_CONFLICT ?? copy.errors.fallback);
      router.refresh();
      return;
    }
    const parsed = resourceLifecycleSchema.safeParse({
      action,
      reason,
      expectedUpdatedAt: product.updatedAt,
    });
    if (!parsed.success || !confirmed) {
      setError(copy.errors.RESOURCE_LIFECYCLE_INVALID);
      return;
    }
    if (
      !(await confirmAction({
        title: labels[action],
        object: product.id,
        consequences: notes[action],
        confirmLabel: labels[action],
        cancelLabel: copy.cancel,
        closeLabel: copy.cancel,
        ...(action === "archive" ? {} : { danger: false }),
      }))
    ) {
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/products/${product.id}/lifecycle`,
        privateApiRequest({ method: "POST", json: parsed.data }),
      );
      const body = await response.json().catch(() => null);
      const expectedTarget =
        target ??
        (action === "archive" ? "archived" : action === "restore" ? "draft" : "pending_review");
      if (
        !response.ok ||
        body?.product?.id !== product.id ||
        body.product.status !== expectedTarget ||
        typeof body.product.updatedAt !== "string" ||
        !Number.isFinite(Date.parse(body.product.updatedAt)) ||
        Date.parse(body.product.updatedAt) <= Date.parse(product.updatedAt)
      ) {
        setError(resourceCommerceError(locale, body?.code));
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

  const nextStepCopy =
    nextStep === "submit"
      ? copy.submitNote
      : nextStep === "restore"
        ? copy.restoreNote
        : nextStep === "wait_review"
          ? locale === "ru"
            ? "Ресурс ожидает проверки. Публикация не происходит автоматически."
            : "This resource is waiting for review. It is not published automatically."
          : nextStep === "suspended_support"
            ? copy.blocked
            : nextStep === "archive"
              ? copy.archiveNote
              : null;

  return (
    <section
      id="author-resource-lifecycle"
      className="nexus-panel space-y-4 p-5"
      aria-labelledby={`${fieldId}-heading`}
    >
      <h2 id={`${fieldId}-heading`} className="text-xl font-semibold text-primary">
        {copy.lifecycle}
      </h2>
      <dl className="grid gap-2 text-sm text-secondary sm:grid-cols-2">
        <div>
          <dt className="font-label uppercase text-muted">
            {locale === "ru" ? "Статус ресурса" : "Resource status"}
          </dt>
          <dd className="text-primary">{product.status}</dd>
        </div>
        <div>
          <dt className="font-label uppercase text-muted">
            {locale === "ru" ? "Выбранная сборка" : "Selected build"}
          </dt>
          <dd className="text-primary">
            {selectedBuild
              ? `${selectedBuild.version ?? selectedBuild.id} · ${selectedBuild.status}`
              : locale === "ru"
                ? "Не выбрана"
                : "None selected"}
          </dd>
        </div>
      </dl>
      {nextStepCopy ? <p className="text-sm text-secondary">{nextStepCopy}</p> : null}
      {selectedBuild && buildAvailability !== "available" ? (
        <ErrorState
          title={
            locale === "ru"
              ? "Эта сборка недоступна для публичной выдачи"
              : "This build is unavailable for public delivery"
          }
          description={
            locale === "ru"
              ? "Скачивание и новая подписка на релизы блокируются, пока сборка снова не станет допустимой."
              : "Download and new release watches stay blocked until a valid build is available."
          }
          action={
            <Link
              href={unavailableBuildSupportHref()}
              className="inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              onClick={() =>
                stashSupportObjectContext({ productId: product.id, buildId: selectedBuild.id })
              }
            >
              {locale === "ru"
                ? "Обратиться в поддержку с этим контекстом"
                : "Contact support with this context"}
            </Link>
          }
        />
      ) : null}
      {actions.length === 0 ? (
        <ErrorState
          id="resource-lifecycle-blocked"
          title={copy.blocked}
          action={
            product.status === "suspended" ? (
              <Link
                href={unavailableBuildSupportHref()}
                className="inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
                onClick={() => stashSupportObjectContext({ productId: product.id })}
              >
                {locale === "ru" ? "Открыть обращение" : "Open a support case"}
              </Link>
            ) : undefined
          }
        />
      ) : (
        <form onSubmit={submit} aria-busy={busy} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor={`${fieldId}-action`} className={nativeLabelClass}>
              {copy.lifecycle}
            </label>
            <select
              id={`${fieldId}-action`}
              value={action}
              disabled={busy || saved}
              onChange={(event) => {
                setAction(event.target.value as ResourceLifecycleAction);
                setConfirmed(false);
              }}
              className={controlClass}
            >
              {actions.map((value) => (
                <option key={value} value={value}>
                  {labels[value]}
                </option>
              ))}
            </select>
          </div>
          <p id={`${fieldId}-note`} className="text-sm text-secondary">
            {notes[action]}
            {target ? (
              <span className="mt-1 block">
                {locale === "ru" ? "Следующее состояние" : "Next status"}: {target}
                {target === "draft"
                  ? locale === "ru"
                    ? " → затем отправка на проверку"
                    : " → then submit for review"
                  : ""}
              </span>
            ) : null}
          </p>
          {action === "restore" ? (
            <ErrorState
              id="resource-lifecycle-restore-draft"
              title={
                locale === "ru"
                  ? "После восстановления ресурс станет черновиком, а не снова опубликованным."
                  : "Restore returns a draft. It does not republish the resource."
              }
            />
          ) : null}
          <div className="space-y-1.5">
            <label htmlFor={`${fieldId}-reason`} className={nativeLabelClass}>
              {copy.reason}
            </label>
            <textarea
              id={`${fieldId}-reason`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required
              minLength={5}
              maxLength={1000}
              rows={3}
              disabled={busy || saved}
              className={textareaClass}
            />
          </div>
          <ActionConfirmCheckbox
            id={`${fieldId}-confirm`}
            checked={confirmed}
            onCheckedChange={setConfirmed}
            disabled={busy || saved}
            required
            labelClassName="flex items-start gap-3 text-sm text-secondary"
            describedBy={`${fieldId}-note`}
          >
            {copy.confirm}
          </ActionConfirmCheckbox>
          <Button
            type="submit"
            isLoading={busy}
            disabled={saved || !confirmed}
            className="min-h-11"
          >
            {busy ? copy.working : labels[action]}
          </Button>
        </form>
      )}
      {error ? <ErrorState title={error} description={copy.actionFailedDescription} /> : null}
      {saved && (
        <p role="status" className="text-sm text-success">
          {copy.updated}
          {action === "restore"
            ? locale === "ru"
              ? " Черновик готов к проверке; автоматической публикации нет."
              : " Draft is ready for review; nothing was auto-published."
            : ""}
        </p>
      )}
    </section>
  );
}
