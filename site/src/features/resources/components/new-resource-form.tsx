"use client";

import { PRODUCT_TYPES } from "@nexus/domain";
import { Button, ErrorState, fieldControlClass, Input } from "@nexus/ui";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { confirmedAuthorBuild } from "../../../lib/author-resource-response";
import {
  MAX_BUILD_FILE_SIZE_BYTES,
  validateBuildFileSelection,
} from "../../../lib/build-file-validation";
import { buildPackageCopy } from "../../../lib/build-package-i18n";
import { confirmedCreatedResource } from "../../../lib/new-resource-response";
import {
  createPendingResourceDraft,
  PENDING_RESOURCE_DRAFT_KEY,
  parsePendingResourceDraft,
  pendingResourceDraftKey,
} from "../../../lib/pending-resource-draft";
import { PRODUCT_PUBLISHING_KEYS } from "../../../lib/product-type-labels";
import { getResourceSubmissionErrorMessage } from "../../../lib/publishing-error-message";
import {
  parseResourceIntent,
  type ResourceSubmissionIntent,
  resourceFileHash,
  resourceIntentKey,
} from "../../../lib/resource-submission-intent";
import { useNexusLocale } from "../../../components/locale-context";
import { MtaMetaInspectorPanel } from "../../../components/mta-meta-inspector-panel";
import { ResourceSubmissionSuccess } from "./resource-submission-success";

const nativeLabelClass = "block font-label uppercase text-secondary";
const fileClass =
  "w-full rounded-lg border border-base bg-inset px-3 py-2 text-sm text-secondary file:mr-3 file:rounded-md file:border-0 file:bg-accent-soft file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-accent";

export function NewResourceForm({ actorId }: { actorId: string }) {
  const storageKey = pendingResourceDraftKey(actorId);
  const intentKey = resourceIntentKey(actorId);
  const { locale, dictionary } = useNexusLocale();
  const copy = dictionary.publishing;
  const maxFileSizeMb = String(MAX_BUILD_FILE_SIZE_BYTES / (1024 * 1024));
  const buildFileTooLarge = copy.buildFileTooLarge.replace("{maxFileSize}", maxFileSizeMb);
  const buildFileRequirements = copy.buildFileRequirements.replace("{maxFileSize}", maxFileSizeMb);
  const publishingErrorMessages = {
    packageInvalid: buildPackageCopy(locale).invalid,
    packageUnsupported: buildPackageCopy(locale).unsupported,
    packageUnsafePath: buildPackageCopy(locale).path,
    packageLimitExceeded: buildPackageCopy(locale).limit,
    packageInspectorBusy: buildPackageCopy(locale).busy,
    fileTooLarge: buildFileTooLarge,
    malwareDetected: copy.scannerMalwareDetected,
    scanLimitExceeded: copy.scannerLimitExceeded,
    scannerUnavailable: copy.scannerUnavailable,
    authenticationRequired: copy.authenticationRequired,
    uploadRateLimited: copy.uploadRateLimited,
    resourceNotFound: copy.resourceNotFound,
    buildForbidden: copy.buildForbidden,
    paidPublishingUnavailable: copy.paidPublishingUnavailable,
    versionAlreadyExists: copy.versionAlreadyExists,
    multipartRequired: copy.multipartRequired,
    multipartInvalid: copy.multipartInvalid,
    metadataInvalid: copy.metadataInvalid,
    buildFileTypeNotAllowed: copy.buildFileTypeNotAllowed,
    buildContentMismatch: copy.buildContentMismatch,
    buildFileNameInvalid: copy.buildFileNameInvalid,
    resourceMetadataInvalid: copy.resourceMetadataInvalid,
    resourceSlugAlreadyExists: copy.resourceSlugAlreadyExists,
    resourceCreationFailed: copy.resourceCreationFailed,
  };
  const [loading, setLoading] = useState(false);
  const [identityVerified, setIdentityVerified] = useState(false);
  const [intent, setIntent] = useState<ResourceSubmissionIntent | null>(null);
  const lock = useRef(false);
  const intentRef = useRef<ResourceSubmissionIntent | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const message = (ru: string, en: string) => (locale === "ru" ? ru : en);
  const [resultId, setResultId] = useState<string | null>(null);
  const [createdProduct, setCreatedProduct] = useState<{
    id: string;
    slug: string;
    mtaVersionTarget: string;
  } | null>(null);
  const [formEpoch, setFormEpoch] = useState(0);
  const [mtaVersionTarget, setMtaVersionTarget] = useState("1.6.0");
  const [draftReady, setDraftReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startNewSubmission() {
    if (intentRef.current || lock.current) return;
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      // The in-memory state still resets if storage is unavailable.
    }
    setCreatedProduct(null);
    setMtaVersionTarget("1.6.0");
    setError(null);
    setFormEpoch((current) => current + 1);
  }

  useEffect(() => {
    let alive = true;
    async function restore() {
      try {
        const response = await fetch("/api/auth/session", {
          cache: "no-store",
          credentials: "same-origin",
          signal: AbortSignal.timeout(10000),
        });
        const session = await response.json();
        if (!response.ok || session?.authenticated !== true || session?.user?.id !== actorId)
          throw new Error("identity");
        const raw = sessionStorage.getItem(intentKey);
        const pending = parseResourceIntent(raw, actorId);
        if (raw && !pending) throw new Error("storage");
        sessionStorage.removeItem(PENDING_RESOURCE_DRAFT_KEY);
        const stored = sessionStorage.getItem(storageKey);
        const oldDraft = parsePendingResourceDraft(stored, actorId);
        if (alive) {
          if (pending) {
            intentRef.current = pending;
            setIntent(pending);
            setCreatedProduct(pending.product);
            setMtaVersionTarget(pending.build.mtaVersionTarget);
          } else if (oldDraft) {
            setCreatedProduct(oldDraft);
            setMtaVersionTarget(oldDraft.mtaVersionTarget);
          }
          setIdentityVerified(true);
          setDraftReady(true);
        }
      } catch {
        if (alive)
          setError(
            locale === "ru"
              ? "Не удалось проверить сессию или восстановить отправку. Войдите в исходный аккаунт и обновите страницу."
              : "Could not verify the session or restore the submission. Sign in to the original account and refresh.",
          );
      }
    }
    void restore();
    return () => {
      alive = false;
    };
  }, [actorId, intentKey, storageKey, locale]);

  useEffect(() => {
    if (!intent || !formRef.current) return;
    const request = intent.request;
    const values: Record<string, string> = {
      ...(request
        ? {
            title: request.title,
            slug: request.slug,
            shortDescription: request.shortDescription ?? "",
            description: request.description,
            type: request.type,
            tags: (request.tags ?? []).join(", "),
            dependencies: (request.compatibility?.dependencies ?? []).join(", "),
          }
        : {}),
      version: intent.build.version,
      releaseNotes: intent.build.releaseNotes,
    };
    for (const [name, value] of Object.entries(values)) {
      const field = formRef.current.elements.namedItem(name);
      if (
        field instanceof HTMLInputElement ||
        field instanceof HTMLTextAreaElement ||
        field instanceof HTMLSelectElement
      )
        field.value = value;
    }
  }, [intent]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draftReady || !identityVerified || loading || lock.current) return;
    lock.current = true;
    const firstAttempt = !intentRef.current && !createdProduct;
    let productRecoverable = Boolean(createdProduct);
    const releaseKnownFailure = () => {
      if (!firstAttempt) return;
      try {
        sessionStorage.removeItem(intentKey);
        intentRef.current = null;
        setIntent(null);
      } catch {
        /* retain pending if storage could not be cleared */
      }
    };

    setLoading(true);
    setError(null);
    const form = new FormData(event.currentTarget);

    try {
      const fileEntry = form.get("file");
      const file = fileEntry instanceof File ? fileEntry : null;
      const fileIssue = validateBuildFileSelection(file);
      if (fileIssue === "missing") {
        throw new Error(copy.chooseArchive);
      }
      if (fileIssue === "too_large") {
        throw new Error(buildFileTooLarge);
      }
      if (fileIssue === "unsupported_type") {
        throw new Error(copy.buildFileTypeNotAllowed);
      }
      if (!file) {
        throw new Error(copy.chooseArchive);
      }

      const hash = await resourceFileHash(file);
      let active = intentRef.current;
      if (active) {
        if (
          file.name !== active.build.fileName ||
          file.size !== active.build.size ||
          hash !== active.build.sha256
        )
          throw new Error(
            message(
              "Выберите тот же файл: содержимое или имя не совпадает с исходной отправкой.",
              "Choose the same file: its name or contents do not match the original submission.",
            ),
          );
      } else {
        const mtaTarget = String(form.get("mtaMinVersion") || mtaVersionTarget || "").trim();
        const request = createdProduct
          ? null
          : {
              title: String(form.get("title") || "").trim(),
              slug: String(form.get("slug") || "")
                .trim()
                .toLowerCase(),
              shortDescription: String(form.get("shortDescription") || "").trim(),
              description: String(form.get("description") || "").trim(),
              type: String(form.get("type") || "script") as "script",
              price: 0,
              currency: "USD" as const,
              licenseModel: "unlimited" as const,
              tags: String(form.get("tags") || "")
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean),
              compatibility: {
                mtaMinVersion: mtaTarget || undefined,
                dependencies: String(form.get("dependencies") || "")
                  .split(",")
                  .map((dependency) => dependency.trim().toLowerCase())
                  .filter(Boolean),
              },
            };
        active = {
          actorId,
          request,
          product: createdProduct,
          build: {
            version: String(form.get("version") || "1.0.0").trim(),
            releaseNotes: String(form.get("releaseNotes") || "").trim(),
            mtaVersionTarget: createdProduct?.mtaVersionTarget ?? mtaTarget,
            fileName: file.name,
            size: file.size,
            sha256: hash,
          },
        };
        const raw = JSON.stringify(active);
        if (!parseResourceIntent(raw, actorId))
          throw new Error(message("Проверьте поля отправки.", "Check the submission fields."));
        try {
          sessionStorage.setItem(intentKey, raw);
        } catch {
          throw new Error(
            message(
              "Не удалось сохранить данные для восстановления. Отправка не началась.",
              "Could not save recovery information. Submission was not started.",
            ),
          );
        }
        intentRef.current = active;
        setIntent(active);
      }

      let product = active.product;
      if (!product) {
        if (!active.request) throw new Error(copy.createError);
        const productResponse = await fetch("/api/products", {
          method: "POST",
          cache: "no-store",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json", "x-nexus-actor-id": actorId },
          body: JSON.stringify(active.request),
          signal: AbortSignal.timeout(15_000),
        });
        const productData = await productResponse.json().catch(() => null);
        if (productResponse.status === 401 || productData?.code === "ACTOR_CHANGED")
          setIdentityVerified(false);
        const confirmed = confirmedCreatedResource(
          productResponse.status,
          productData,
          actorId,
          active.request,
        );
        if (!confirmed) {
          if (
            [400, 403, 413, 415, 422, 428, 429].includes(productResponse.status) ||
            productData?.code === "PRODUCT_SLUG_EXISTS"
          )
            releaseKnownFailure();
          throw new Error(
            !firstAttempt
              ? message(
                  "Не удалось подтвердить исходное создание. Проверьте черновики и повторите исходную отправку позже.",
                  "Could not confirm the original creation. Check your drafts and retry the original submission later.",
                )
              : getResourceSubmissionErrorMessage(productData?.code, publishingErrorMessages) ||
                  productData?.error ||
                  copy.createError,
          );
        }
        product = {
          id: confirmed.id,
          slug: confirmed.slug,
          mtaVersionTarget: active.build.mtaVersionTarget,
        };
        active = { ...active, product };
        intentRef.current = active;
        setIntent(active);
        setCreatedProduct(product);
        try {
          sessionStorage.setItem(intentKey, JSON.stringify(active));
          sessionStorage.setItem(
            storageKey,
            JSON.stringify(createPendingResourceDraft(product, actorId)),
          );
          productRecoverable = true;
        } catch {
          /* original intent remains recoverable by exact retry */
        }
      }

      const buildForm = new FormData();
      buildForm.set("version", active.build.version);
      buildForm.set("releaseNotes", active.build.releaseNotes);
      buildForm.set("mtaVersionTarget", active.build.mtaVersionTarget);
      buildForm.set("file", file);

      const buildResponse = await fetch(`/api/products/${encodeURIComponent(product.id)}/builds`, {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        body: buildForm,
        headers: { "x-nexus-actor-id": actorId },
        signal: AbortSignal.timeout(60_000),
      });
      const buildData = await buildResponse.json().catch(() => null);
      if (buildResponse.status === 401 || buildData?.code === "ACTOR_CHANGED")
        setIdentityVerified(false);
      if (
        !confirmedAuthorBuild(buildResponse.status, buildData, product.id, active.build.version)
      ) {
        if (
          productRecoverable &&
          [400, 403, 413, 415, 422, 428, 429].includes(buildResponse.status)
        )
          releaseKnownFailure();
        const publishingMessage = getResourceSubmissionErrorMessage(
          buildData?.code,
          publishingErrorMessages,
        );
        throw new Error(
          !firstAttempt
            ? message(
                "Не удалось подтвердить исходную сборку. Проверьте версии ресурса и повторите исходную отправку позже.",
                "Could not confirm the original build. Check the resource versions and retry the original submission later.",
              )
            : publishingMessage || buildData?.error || copy.buildError,
        );
      }

      try {
        sessionStorage.removeItem(storageKey);
        sessionStorage.removeItem(intentKey);
      } catch {
        // A completed submission must still show success if storage is blocked.
      }
      intentRef.current = null;
      setIntent(null);
      setCreatedProduct(null);
      setResultId(product.id);
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : copy.unexpectedError);
    } finally {
      setLoading(false);
      lock.current = false;
    }
  }

  if (resultId) {
    return <ResourceSubmissionSuccess resultId={resultId} locale={locale} />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8">
      <div className="space-y-1.5">
        <h1 className="font-display text-primary">{copy.resourceTitle}</h1>
        <p className="max-w-xl text-sm leading-relaxed text-muted">{copy.resourceDescription}</p>
      </div>

      {intent ? (
        <ErrorState
          title={message(
            "Результат может быть неизвестен. Для безопасного повтора выберите тот же файл; исходные данные сохранены.",
            "The result may be unknown. To retry safely, select the same file; the original details are saved.",
          )}
        />
      ) : null}
      {createdProduct && (
        <div className="flex flex-col gap-3 rounded-lg border border-base bg-inset p-4 sm:flex-row sm:items-center sm:justify-between">
          <p role="status" className="text-sm text-secondary">
            {copy.buildRetryReady} {copy.pendingDraftLabel} {createdProduct.slug}
          </p>
          <Button
            type="button"
            variant="outline"
            size="touch"
            onClick={startNewSubmission}
            disabled={loading || Boolean(intent)}
            className="min-h-11 shrink-0"
          >
            {copy.startNewResource}
          </Button>
        </div>
      )}

      {error ? (
        <ErrorState
          title={error}
          description={message(
            "Отправка могла завершиться. Повтор использует исходные данные и тот же файл.",
            "The submission may have completed. A retry uses the original details and the same file.",
          )}
        />
      ) : null}

      <MtaMetaInspectorPanel
        onApplyMinimumVersion={setMtaVersionTarget}
        minimumVersionLocked={loading || Boolean(createdProduct || intent)}
      />

      <form
        ref={formRef}
        hidden={!identityVerified}
        style={!identityVerified ? { display: "none" } : undefined}
        key={formEpoch}
        onSubmit={submit}
        aria-busy={loading}
        className="nexus-panel grid min-w-0 grid-cols-1 gap-4 overflow-x-clip p-5 shadow-nexus-sm sm:grid-cols-2 sm:p-6"
      >
        <fieldset disabled={loading} className="contents">
          <Input
            id="resource-title"
            name="title"
            label={copy.title}
            required
            minLength={3}
            maxLength={120}
            readOnly={Boolean(createdProduct || intent)}
          />

          <Input
            id="resource-slug"
            name="slug"
            label={copy.slug}
            required
            minLength={3}
            maxLength={120}
            pattern="[a-z0-9-]+"
            autoCapitalize="none"
            spellCheck={false}
            readOnly={Boolean(createdProduct || intent)}
          />

          <div className="sm:col-span-2">
            <Input
              id="resource-short-description"
              name="shortDescription"
              label={copy.shortDescription}
              maxLength={240}
              readOnly={Boolean(createdProduct || intent)}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="resource-description" className={nativeLabelClass}>
              {copy.description}
            </label>
            <textarea
              id="resource-description"
              name="description"
              required
              minLength={10}
              maxLength={10_000}
              rows={6}
              readOnly={Boolean(createdProduct || intent)}
              className={fieldControlClass({
                disabled: Boolean(createdProduct || intent),
                className: "h-auto min-h-28",
              })}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="resource-type" className={nativeLabelClass}>
              {copy.type}
            </label>
            <select
              id="resource-type"
              name="type"
              className={fieldControlClass({
                disabled: Boolean(createdProduct || intent),
                className: "min-h-11",
              })}
              disabled={Boolean(createdProduct || intent)}
            >
              {PRODUCT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {copy[PRODUCT_PUBLISHING_KEYS[type]]}
                </option>
              ))}
            </select>
          </div>

          <Input
            id="resource-tags"
            name="tags"
            label={copy.tags}
            maxLength={500}
            readOnly={Boolean(createdProduct || intent)}
          />

          <Input
            id="resource-version"
            name="version"
            label={copy.version}
            defaultValue="1.0.0"
            readOnly={Boolean(intent)}
            required
            maxLength={64}
            pattern="v?[0-9]+\.[0-9]+(\.[0-9]+)?(-[a-zA-Z0-9.]+)?"
          />

          <Input
            id="resource-min-mta"
            name="mtaMinVersion"
            label={copy.minMtaVersion}
            value={mtaVersionTarget}
            onChange={(event) => setMtaVersionTarget(event.target.value)}
            pattern="1\.[0-9]+(\.[0-9]+)?"
            maxLength={64}
            readOnly={Boolean(createdProduct || intent)}
          />

          <div className="sm:col-span-2">
            <Input
              id="resource-dependencies"
              name="dependencies"
              label={copy.dependencies}
              maxLength={1000}
              placeholder="core-ui, vehicle-pack"
              readOnly={Boolean(createdProduct || intent)}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="resource-build-file" className={nativeLabelClass}>
              {copy.buildArchive}
            </label>
            <input
              id="resource-build-file"
              name="file"
              type="file"
              accept=".zip,.rar,.7z,.lua"
              required
              className={fileClass}
            />
            <span className="text-xs text-muted">{buildFileRequirements}</span>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="resource-release-notes" className={nativeLabelClass}>
              {copy.releaseNotes}
            </label>
            <textarea
              id="resource-release-notes"
              name="releaseNotes"
              readOnly={Boolean(intent)}
              rows={3}
              maxLength={5000}
              className={fieldControlClass({
                className: "h-auto min-h-24",
              })}
            />
          </div>

          <Button
            type="submit"
            isLoading={loading}
            disabled={!draftReady}
            className="min-h-11 sm:col-span-2"
          >
            {!draftReady
              ? copy.checkingDraft
              : loading
                ? copy.submitting
                : intent
                  ? message("Повторить исходную отправку", "Retry original submission")
                  : createdProduct
                    ? copy.retryBuild
                    : copy.submit}
          </Button>
        </fieldset>
      </form>
    </div>
  );
}
