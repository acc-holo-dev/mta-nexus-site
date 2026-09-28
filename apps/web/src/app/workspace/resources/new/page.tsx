"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@nexus/ui";
import { MtaMetaInspectorPanel } from "../../../../components/mta-meta-inspector-panel";
import { useNexusLocale } from "../../../../components/locale-context";
import { getResourceSubmissionErrorMessage } from "../../../../lib/publishing-error-message";
import {
  exceedsBuildFileSizeLimit,
  MAX_BUILD_FILE_SIZE_BYTES,
} from "../../../../lib/build-file-validation";
import {
  parsePendingResourceDraft,
  PENDING_RESOURCE_DRAFT_KEY,
} from "../../../../lib/pending-resource-draft";

const fieldClass =
  "w-full rounded-lg border border-base bg-inset px-3 py-2 text-sm text-primary outline-none transition-colors placeholder:text-[color:var(--nexus-text-faint)] hover:border-strong focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)]";
const labelClass = "space-y-1.5";
const labelTextClass = "font-label text-secondary";

export default function NewResourcePage() {
  const { dictionary } = useNexusLocale();
  const copy = dictionary.publishing;
  const maxFileSizeMb = String(
    MAX_BUILD_FILE_SIZE_BYTES / (1024 * 1024),
  );
  const buildFileTooLarge = copy.buildFileTooLarge.replace(
    "{maxFileSize}",
    maxFileSizeMb,
  );
  const buildFileRequirements = copy.buildFileRequirements.replace(
    "{maxFileSize}",
    maxFileSizeMb,
  );
  const publishingErrorMessages = {
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
  const [resultSlug, setResultSlug] = useState<string | null>(null);
  const [createdProduct, setCreatedProduct] = useState<{
    id: string;
    slug: string;
    mtaVersionTarget: string;
  } | null>(null);
  const [formEpoch, setFormEpoch] = useState(0);
  const [draftReady, setDraftReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startNewSubmission() {
    try {
      sessionStorage.removeItem(PENDING_RESOURCE_DRAFT_KEY);
    } catch {
      // The in-memory state still resets if storage is unavailable.
    }
    setCreatedProduct(null);
    setError(null);
    setFormEpoch((current) => current + 1);
  }

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(PENDING_RESOURCE_DRAFT_KEY);
      const pendingDraft = parsePendingResourceDraft(stored);
      if (pendingDraft) {
        setCreatedProduct(pendingDraft);
      } else if (stored) {
        sessionStorage.removeItem(PENDING_RESOURCE_DRAFT_KEY);
      }
    } catch {
      // Storage can be unavailable in restricted browser contexts.
    } finally {
      setDraftReady(true);
    }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draftReady || loading) return;

    setLoading(true);
    setError(null);
    const form = new FormData(event.currentTarget);

    try {
      const file = form.get("file");
      if (!(file instanceof File) || file.size === 0) {
        throw new Error(copy.chooseArchive);
      }
      if (exceedsBuildFileSizeLimit(file.size)) {
        throw new Error(buildFileTooLarge);
      }

      let product = createdProduct;
      if (!product) {
        const mtaVersionTarget = String(form.get("mtaMinVersion") || "").trim();
        const productResponse = await fetch("/api/products", {
          method: "POST",
          cache: "no-store",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: String(form.get("title") || "").trim(),
            slug: String(form.get("slug") || "").trim().toLowerCase(),
            shortDescription: String(form.get("shortDescription") || "").trim(),
            description: String(form.get("description") || "").trim(),
            type: String(form.get("type") || "script"),
            price: 0,
            currency: "USD",
            licenseModel: "unlimited",
            tags: String(form.get("tags") || "")
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean),
            compatibility: {
              mtaMinVersion: mtaVersionTarget || undefined,
              dependencies: String(form.get("dependencies") || "")
                .split(",")
                .map((dependency) => dependency.trim().toLowerCase())
                .filter(Boolean),
            },
          }),
          signal: AbortSignal.timeout(15_000),
        });
        const productData = await productResponse.json().catch(() => null);
        const productErrorMessage = getResourceSubmissionErrorMessage(
          productData?.code,
          publishingErrorMessages,
        );
        if (
          !productResponse.ok ||
          !productData?.product?.id ||
          !productData?.product?.slug
        ) {
          throw new Error(
            productErrorMessage || productData?.error || copy.createError,
          );
        }
        product = {
          id: productData.product.id,
          slug: productData.product.slug,
          mtaVersionTarget,
        };
        setCreatedProduct(product);
        try {
          sessionStorage.setItem(
            PENDING_RESOURCE_DRAFT_KEY,
            JSON.stringify(product),
          );
        } catch {
          // Keep the in-memory retry path if session storage is unavailable.
        }
      }

      const buildForm = new FormData();
      buildForm.set("version", String(form.get("version") || "1.0.0").trim());
      buildForm.set(
        "releaseNotes",
        String(form.get("releaseNotes") || "").trim(),
      );
      buildForm.set("mtaVersionTarget", product.mtaVersionTarget);
      buildForm.set("file", file);

      const buildResponse = await fetch(
        `/api/products/${encodeURIComponent(product.id)}/builds`,
        {
          method: "POST",
          cache: "no-store",
          credentials: "same-origin",
          body: buildForm,
          signal: AbortSignal.timeout(60_000),
        },
      );
      const buildData = await buildResponse.json().catch(() => null);
      if (!buildResponse.ok) {
        const publishingMessage = getResourceSubmissionErrorMessage(
          buildData?.code,
          publishingErrorMessages,
        );
        throw new Error(publishingMessage || buildData?.error || copy.buildError);
      }

      try {
        sessionStorage.removeItem(PENDING_RESOURCE_DRAFT_KEY);
      } catch {
        // A completed submission must still show success if storage is blocked.
      }
      setCreatedProduct(null);
      setResultSlug(product.slug);
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : copy.unexpectedError,
      );
    } finally {
      setLoading(false);
    }
  }

  if (resultSlug) {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-12">
        <div className="nexus-panel space-y-4 p-6 shadow-nexus-sm">
          <div className="inline-flex rounded-full bg-success-soft px-2.5 py-1 font-label text-success">
            {dictionary.nav.closedBeta}
          </div>
          <h1 className="text-2xl font-black text-primary">
            {copy.submittedTitle}
          </h1>
          <p className="text-sm leading-relaxed text-muted">
            {copy.submittedDescription}
          </p>
          <Link
            href={`/market/${resultSlug}`}
            className="inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--nexus-accent-hover)]"
          >
            {copy.openStatus}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8">
      <div className="space-y-1.5">
        <h1 className="font-display text-primary">{copy.resourceTitle}</h1>
        <p className="max-w-xl text-sm leading-relaxed text-muted">
          {copy.resourceDescription}
        </p>
      </div>

      {createdProduct && (
        <div className="flex flex-col gap-3 rounded-lg border border-base bg-inset p-4 sm:flex-row sm:items-center sm:justify-between">
          <p role="status" className="text-sm text-secondary">
            {copy.buildRetryReady} {copy.pendingDraftLabel} {createdProduct.slug}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={startNewSubmission}
            disabled={loading}
            className="shrink-0"
          >
            {copy.startNewResource}
          </Button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-[color:var(--nexus-danger)]/25 bg-danger-soft p-4 text-sm text-danger"
        >
          {error}
        </div>
      )}

      <MtaMetaInspectorPanel />

      <form
        key={formEpoch}
        onSubmit={submit}
        aria-busy={loading}
        className="nexus-panel grid grid-cols-1 gap-4 p-5 shadow-nexus-sm sm:grid-cols-2 sm:p-6"
      >
        <label className={labelClass}>
          <span className={labelTextClass}>{copy.title}</span>
          <input
            name="title"
            required
            minLength={3}
            maxLength={120}
            className={fieldClass}
            disabled={Boolean(createdProduct)}
          />
        </label>

        <label className={labelClass}>
          <span className={labelTextClass}>{copy.slug}</span>
          <input
            name="slug"
            required
            minLength={3}
            maxLength={120}
            pattern="[a-z0-9-]+"
            autoCapitalize="none"
            spellCheck={false}
            className={fieldClass}
            disabled={Boolean(createdProduct)}
          />
        </label>

        <label className={`${labelClass} sm:col-span-2`}>
          <span className={labelTextClass}>{copy.shortDescription}</span>
          <input
            name="shortDescription"
            maxLength={240}
            className={fieldClass}
            disabled={Boolean(createdProduct)}
          />
        </label>

        <label className={`${labelClass} sm:col-span-2`}>
          <span className={labelTextClass}>{copy.description}</span>
          <textarea
            name="description"
            required
            minLength={10}
            maxLength={20_000}
            rows={6}
            className={fieldClass}
            disabled={Boolean(createdProduct)}
          />
        </label>

        <label className={labelClass}>
          <span className={labelTextClass}>{copy.type}</span>
          <select
            name="type"
            className={fieldClass}
            disabled={Boolean(createdProduct)}
          >
            <option value="script">{copy.typeScript}</option>
            <option value="map">{copy.typeMap}</option>
            <option value="vehicle">{copy.typeVehicle}</option>
            <option value="model">{copy.typeModel}</option>
            <option value="ui">{copy.typeUi}</option>
            <option value="plugin">{copy.typePlugin}</option>
          </select>
        </label>

        <label className={labelClass}>
          <span className={labelTextClass}>{copy.tags}</span>
          <input
            name="tags"
            maxLength={500}
            className={fieldClass}
            disabled={Boolean(createdProduct)}
          />
        </label>

        <label className={labelClass}>
          <span className={labelTextClass}>{copy.version}</span>
          <input
            name="version"
            defaultValue="1.0.0"
            required
            maxLength={64}
            className={fieldClass}
          />
        </label>

        <label className={labelClass}>
          <span className={labelTextClass}>{copy.minMtaVersion}</span>
          <input
            name="mtaMinVersion"
            defaultValue="1.6.0"
            maxLength={64}
            className={fieldClass}
            disabled={Boolean(createdProduct)}
          />
        </label>

        <label className={`${labelClass} sm:col-span-2`}>
          <span className={labelTextClass}>{copy.dependencies}</span>
          <input
            name="dependencies"
            maxLength={1000}
            placeholder="core-ui, vehicle-pack"
            className={fieldClass}
            disabled={Boolean(createdProduct)}
          />
        </label>

        <label className={`${labelClass} sm:col-span-2`}>
          <span className={labelTextClass}>{copy.buildArchive}</span>
          <input
            name="file"
            type="file"
            accept=".zip,.rar,.7z,.lua"
            required
            className="w-full rounded-lg border border-base bg-inset px-3 py-2 text-sm text-secondary file:mr-3 file:rounded-md file:border-0 file:bg-accent-soft file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-accent"
          />
          <span className="text-xs text-muted">{buildFileRequirements}</span>
        </label>

        <label className={`${labelClass} sm:col-span-2`}>
          <span className={labelTextClass}>{copy.releaseNotes}</span>
          <textarea
            name="releaseNotes"
            rows={3}
            maxLength={5000}
            className={fieldClass}
          />
        </label>

        <Button
          type="submit"
          isLoading={loading}
          disabled={!draftReady}
          className="sm:col-span-2"
        >
          {!draftReady
            ? copy.checkingDraft
            : loading
            ? copy.submitting
            : createdProduct
              ? copy.retryBuild
              : copy.submit}
        </Button>
      </form>
    </div>
  );
}
