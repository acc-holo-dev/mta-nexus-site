"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { Button } from "@nexus/ui";
import { MtaMetaInspectorPanel } from "../../../../components/mta-meta-inspector-panel";
import { useNexusLocale } from "../../../../components/locale-context";

const fieldClass =
  "w-full rounded-lg border border-base bg-inset px-3 py-2 text-sm text-primary outline-none transition-colors placeholder:text-[color:var(--nexus-text-faint)] hover:border-strong focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)]";
const labelClass = "space-y-1.5";
const labelTextClass = "font-label text-secondary";

export default function NewResourcePage() {
  const { dictionary } = useNexusLocale();
  const copy = dictionary.publishing;
  const [loading, setLoading] = useState(false);
  const [resultSlug, setResultSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);
    const form = new FormData(event.currentTarget);

    try {
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
            mtaMinVersion:
              String(form.get("mtaMinVersion") || "").trim() || undefined,
            dependencies: String(form.get("dependencies") || "")
              .split(",")
              .map((dependency) => dependency.trim().toLowerCase())
              .filter(Boolean),
          },
        }),
        signal: AbortSignal.timeout(15_000),
      });
      const productData = await productResponse.json().catch(() => null);
      if (!productResponse.ok || !productData?.product?.id) {
        throw new Error(productData?.error || copy.createError);
      }

      const buildForm = new FormData();
      buildForm.set("version", String(form.get("version") || "1.0.0").trim());
      buildForm.set(
        "releaseNotes",
        String(form.get("releaseNotes") || "").trim(),
      );
      buildForm.set(
        "mtaVersionTarget",
        String(form.get("mtaMinVersion") || "").trim(),
      );

      const file = form.get("file");
      if (!(file instanceof File) || file.size === 0) {
        throw new Error(copy.chooseArchive);
      }
      buildForm.set("file", file);

      const buildResponse = await fetch(
        `/api/products/${encodeURIComponent(productData.product.id)}/builds`,
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
        throw new Error(buildData?.error || copy.buildError);
      }

      setResultSlug(productData.product.slug);
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
          />
        </label>

        <label className={`${labelClass} sm:col-span-2`}>
          <span className={labelTextClass}>{copy.shortDescription}</span>
          <input
            name="shortDescription"
            maxLength={240}
            className={fieldClass}
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
          />
        </label>

        <label className={labelClass}>
          <span className={labelTextClass}>{copy.type}</span>
          <select name="type" className={fieldClass}>
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
          <input name="tags" maxLength={500} className={fieldClass} />
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
          />
        </label>

        <label className={`${labelClass} sm:col-span-2`}>
          <span className={labelTextClass}>{copy.dependencies}</span>
          <input
            name="dependencies"
            maxLength={1000}
            placeholder="core-ui, vehicle-pack"
            className={fieldClass}
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
          className="sm:col-span-2"
        >
          {loading ? copy.submitting : copy.submit}
        </Button>
      </form>
    </div>
  );
}
