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
import { privateApiRequest } from "../../../lib/http/private-api-request";
import {
  resourceBuildStatusLabel,
  resourceStatusLabel,
} from "../../library/resource-release-control-i18n";
import { ActionConfirmCheckbox } from "../../shell/action-confirm-checkbox";
import { confirmAction } from "../../shell/confirm-action";
import { linkAccentSm } from "../../shell/link-shell";
import { useNexusLocale } from "../../shell/locale";
import { panelSpace4P5 } from "../../shell/panel-shell";
import {
  typeGridGap2SmSecondarySm2,
  typeLabelBlockUpperSecondary,
  typeLabelUpperMuted,
  typeSmSecondary,
  typeSmSuccess,
  typeXlSemiboldPrimary,
} from "../../shell/type-shell";
import { stashSupportObjectContext } from "../../support/center";
import { getResourceCommerceCopy, resourceCommerceError } from "../resource-commerce-i18n";

const controlClass =
  "min-h-11 w-full rounded-lg border border-base bg-inset px-3 py-2 text-sm text-primary transition-colors hover:border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)]";
const textareaClass =
  "w-full rounded-lg border border-base bg-inset px-3 py-2 text-sm text-primary transition-colors placeholder:text-[color:var(--nexus-text-faint)] hover:border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)]";
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
          ? copy.waitReviewNote
          : nextStep === "suspended_support"
            ? copy.blocked
            : nextStep === "archive"
              ? copy.archiveNote
              : null;

  return (
    <section
      id="author-resource-lifecycle"
      className={panelSpace4P5}
      aria-labelledby={`${fieldId}-heading`}
    >
      <h2 id={`${fieldId}-heading`} className={typeXlSemiboldPrimary}>
        {copy.lifecycle}
      </h2>
      <dl className={typeGridGap2SmSecondarySm2}>
        <div>
          <dt className={typeLabelUpperMuted}>{copy.resourceStatus}</dt>
          <dd className="text-primary">{resourceStatusLabel(locale, product.status)}</dd>
        </div>
        <div>
          <dt className={typeLabelUpperMuted}>{copy.selectedBuild}</dt>
          <dd className="text-primary">
            {selectedBuild
              ? `${selectedBuild.version ?? selectedBuild.id} · ${resourceBuildStatusLabel(locale, selectedBuild.status)}`
              : copy.noneSelected}
          </dd>
        </div>
      </dl>
      {nextStepCopy ? <p className={typeSmSecondary}>{nextStepCopy}</p> : null}
      {selectedBuild && buildAvailability !== "available" ? (
        <ErrorState
          title={copy.buildUnavailableTitle}
          description={copy.buildUnavailableDescription}
          action={
            <Link
              href={unavailableBuildSupportHref()}
              className={linkAccentSm}
              onClick={() =>
                stashSupportObjectContext({ productId: product.id, buildId: selectedBuild.id })
              }
            >
              {copy.contactSupportContext}
            </Link>
          }
        />
      ) : null}
      {actions.length === 0 ? (
        <ErrorState
          title={copy.blocked}
          description={copy.actionFailedDescription}
          action={
            product.status === "suspended" ? (
              <Link
                href={unavailableBuildSupportHref()}
                className={linkAccentSm}
                onClick={() => stashSupportObjectContext({ productId: product.id })}
              >
                {copy.openSupportCase}
              </Link>
            ) : undefined
          }
        />
      ) : (
        <form onSubmit={submit} aria-busy={busy} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor={`${fieldId}-action`} className={typeLabelBlockUpperSecondary}>
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
          <p id={`${fieldId}-note`} className={typeSmSecondary}>
            {notes[action]}
            {target ? (
              <span className="mt-1 block">
                {copy.nextStatus}: {target}
                {target === "draft" ? copy.thenSubmitReview : ""}
              </span>
            ) : null}
          </p>
          {action === "restore" ? (
            <ErrorState
              id="resource-lifecycle-restore-draft"
              title={copy.restoreDraftWarning}
              description={copy.restoreNote}
            />
          ) : null}
          <div className="space-y-1.5">
            <label htmlFor={`${fieldId}-reason`} className={typeLabelBlockUpperSecondary}>
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
        <p role="status" className={typeSmSuccess}>
          {copy.updated}
          {action === "restore" ? copy.restoreDraftSaved : ""}
        </p>
      )}
    </section>
  );
}
