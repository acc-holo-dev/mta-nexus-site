"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { editProductDetailsSchema } from "@nexus/validation";
import { useNexusLocale } from "./locale-context";
import {
  exceedsBuildFileSizeLimit,
  getSupportedBuildExtension,
} from "../lib/build-file-validation";
import { getResourceSubmissionErrorMessage } from "../lib/publishing-error-message";

const inputClass =
  "w-full rounded-md border border-base bg-surface px-3 py-2 text-sm text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";
const buttonClass =
  "rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";

export function AuthorResourceForms({
  product,
}: {
  product: {
    id: string;
    title: string;
    shortDescription: string;
    description: string;
    tags: string[];
  };
}) {
  const { dictionary } = useNexusLocale();
  const copy = dictionary.authorResources;
  const publishing = dictionary.publishing;
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = new FormData(event.currentTarget);
    const parsed = editProductDetailsSchema.safeParse({
      title: form.get("title"),
      shortDescription: form.get("shortDescription"),
      description: form.get("description"),
      tags: String(form.get("tags") ?? "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    });
    setSaved(false);
    setError("");
    if (!parsed.success) {
      setError(copy.invalid);
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
        signal: AbortSignal.timeout(15_000),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(
          body.code === "PRODUCT_METADATA_INVALID"
            ? copy.invalid
            : body.code === "UNAUTHORIZED"
              ? publishing.authenticationRequired
              : body.code === "NOT_FOUND"
                ? publishing.buildForbidden
                : body.code === "RATE_LIMIT_EXCEEDED"
                  ? publishing.uploadRateLimited
                  : copy.failed,
        );
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError(copy.failed);
    } finally {
      setSaving(false);
    }
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (uploading) return;
    const element = event.currentTarget;
    const data = new FormData(element);
    const file = data.get("file");
    setUploadError("");
    setSubmitted(false);
    if (!(file instanceof File) || !file.size || !getSupportedBuildExtension(file.name)) {
      setUploadError(publishing.buildFileTypeNotAllowed);
      return;
    }
    if (exceedsBuildFileSizeLimit(file.size)) {
      setUploadError(publishing.buildFileTooLarge.replace("{maxFileSize}", "64"));
      return;
    }
    setUploading(true);
    try {
      const response = await fetch(`/api/products/${product.id}/builds`, {
        method: "POST",
        body: data,
        signal: AbortSignal.timeout(120_000),
      });
      const body = await response.json();
      if (!response.ok) {
        setUploadError(
          getResourceSubmissionErrorMessage(body.code, {
            fileTooLarge: publishing.buildFileTooLarge.replace("{maxFileSize}", "64"),
            malwareDetected: publishing.scannerMalwareDetected,
            scanLimitExceeded: publishing.scannerLimitExceeded,
            scannerUnavailable: publishing.scannerUnavailable,
            authenticationRequired: publishing.authenticationRequired,
            uploadRateLimited: publishing.uploadRateLimited,
            resourceNotFound: publishing.resourceNotFound,
            buildForbidden: publishing.buildForbidden,
            versionAlreadyExists: publishing.versionAlreadyExists,
            metadataInvalid: publishing.metadataInvalid,
            buildFileTypeNotAllowed: publishing.buildFileTypeNotAllowed,
            buildContentMismatch: publishing.buildContentMismatch,
            buildFileNameInvalid: publishing.buildFileNameInvalid,
            paidPublishingUnavailable: publishing.paidPublishingUnavailable,
          }) ?? copy.uploadFailed,
        );
        return;
      }
      element.reset();
      setSubmitted(true);
      router.refresh();
    } catch {
      setUploadError(copy.uploadFailed);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <form
        onSubmit={save}
        aria-label={copy.edit}
        className="space-y-4 rounded-lg border border-base bg-surface p-5"
      >
        <h2 className="text-xl font-semibold text-primary">{copy.edit}</h2>
        <fieldset disabled={saving} className="space-y-4">
          <label className="block space-y-1 text-sm text-secondary">
            <span>{publishing.title}</span>
            <input
              name="title"
              required
              minLength={3}
              maxLength={120}
              defaultValue={product.title}
              className={inputClass}
            />
          </label>
          <label className="block space-y-1 text-sm text-secondary">
            <span>{publishing.shortDescription}</span>
            <input
              name="shortDescription"
              maxLength={250}
              defaultValue={product.shortDescription}
              className={inputClass}
            />
          </label>
          <label className="block space-y-1 text-sm text-secondary">
            <span>{publishing.description}</span>
            <textarea
              name="description"
              required
              minLength={10}
              maxLength={10000}
              rows={6}
              defaultValue={product.description}
              className={inputClass}
            />
          </label>
          <label className="block space-y-1 text-sm text-secondary">
            <span>{publishing.tags}</span>
            <input name="tags" defaultValue={product.tags.join(", ")} className={inputClass} />
          </label>
        </fieldset>
        {error && (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        )}
        {saved && (
          <p role="status" className="text-sm text-success">
            {copy.saved}
          </p>
        )}
        <button type="submit" disabled={saving} className={buttonClass}>
          {saving ? copy.saving : copy.save}
        </button>
      </form>
      <form
        onSubmit={upload}
        aria-label={copy.newVersion}
        className="space-y-4 rounded-lg border border-base bg-surface p-5"
      >
        <h2 className="text-xl font-semibold text-primary">{copy.newVersion}</h2>
        <p className="text-sm text-secondary">{publishing.submittedDescription}</p>
        <fieldset disabled={uploading} className="space-y-4">
          <label className="block space-y-1 text-sm text-secondary">
            <span>{publishing.version}</span>
            <input
              name="version"
              required
              maxLength={64}
              placeholder="1.1.0"
              pattern="v?[0-9]+\.[0-9]+(\.[0-9]+)?(-[a-zA-Z0-9.]+)?"
              className={inputClass}
            />
          </label>
          <label className="block space-y-1 text-sm text-secondary">
            <span>{publishing.minMtaVersion}</span>
            <input
              name="mtaVersionTarget"
              maxLength={64}
              placeholder="1.6.0"
              className={inputClass}
            />
          </label>
          <label className="block space-y-1 text-sm text-secondary">
            <span>{publishing.releaseNotes}</span>
            <textarea name="releaseNotes" maxLength={5000} rows={4} className={inputClass} />
          </label>
          <label className="block space-y-1 text-sm text-secondary">
            <span>{publishing.buildArchive}</span>
            <input
              name="file"
              type="file"
              required
              accept=".zip,.rar,.7z,.lua"
              className={inputClass}
            />
            <span className="block text-xs text-muted">
              {publishing.buildFileRequirements.replace("{maxFileSize}", "64")}
            </span>
          </label>
        </fieldset>
        {uploadError && (
          <p role="alert" className="text-sm text-error">
            {uploadError}
          </p>
        )}
        {submitted && (
          <p role="status" className="text-sm text-success">
            {copy.versionSubmitted}
          </p>
        )}
        <button type="submit" disabled={uploading} className={buttonClass}>
          {uploading ? publishing.submitting : copy.newVersion}
        </button>
      </form>
    </div>
  );
}

export function RetireBuildForm({
  productId,
  buildId,
  version,
}: {
  productId: string;
  buildId: string;
  version: string;
}) {
  const { dictionary } = useNexusLocale();
  const copy = dictionary.authorResources;
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function retire(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "").trim();
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/products/${productId}/builds/${buildId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retire", reason }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        setError(copy.retireFailed);
        return;
      }
      router.refresh();
    } catch {
      setError(copy.retireFailed);
    } finally {
      setPending(false);
    }
  }
  return (
    <details className="text-sm text-secondary">
      <summary className="cursor-pointer">
        {copy.retire} · {version}
      </summary>
      <form onSubmit={retire} className="mt-3 space-y-3">
        <p>{copy.retireHint}</p>
        <label className="block space-y-1">
          <span>{copy.retireReason}</span>
          <textarea
            name="reason"
            required
            minLength={3}
            maxLength={2000}
            disabled={pending}
            className={inputClass}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? copy.retiring : copy.retire}
        </button>
      </form>
    </details>
  );
}
