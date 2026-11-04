"use client";
import { Button } from "@nexus/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useRef, useState } from "react";
import { authorPublicationDeskCopy } from "../lib/author-publication-desk-copy";
import type { Locale } from "../lib/i18n";
import {
  organizationContentCopy,
  organizationContentMutationError,
} from "../lib/organization-content-copy";
import { serverContentCopy, serverContentMutationError } from "../lib/server-content-copy";
import { publicationSupportHref } from "../lib/support-workspace-contract";
import {
  type EditableContent,
  parseEditableContent,
  platformFieldClass,
  platformRequest,
} from "../lib/user-platform-client";
import { contentFieldsSchema, editorialTypes, writerTypes } from "../lib/user-platform-contract";
import { getUserPlatformCopy, userPlatformError } from "../lib/user-platform-copy";
import { confirmAction } from "./confirm-action";

export function AuthorContentForm({
  locale,
  initial,
  organization,
  server,
}: {
  locale: Locale;
  initial?: EditableContent;
  organization?: { id: string; name: string };
  server?: { id: string; name: string };
}) {
  const copy = getUserPlatformCopy(locale);
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [latest, setLatest] = useState<EditableContent | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const pending = useRef(false);
  const archived = saved?.status === "archived";
  const workspacePath = server
    ? `/workspace/servers/${encodeURIComponent(server.id)}/content`
    : organization
      ? `/workspace/organizations/${encodeURIComponent(organization.id)}/content`
      : "/workspace/content";
  const apiPath = server
    ? `/api/workspace/servers/${encodeURIComponent(server.id)}/content`
    : organization
      ? `/api/workspace/organizations/${encodeURIComponent(organization.id)}/content`
      : "/api/workspace/content";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || archived || latest) return;
    const form = new FormData(event.currentTarget);
    const fields = {
      title: String(form.get("title") ?? "").trim(),
      body: String(form.get("body") ?? "").trim(),
      excerpt: String(form.get("excerpt") ?? "").trim(),
      coverImageUrl: String(form.get("coverImageUrl") ?? "").trim(),
      tags: [
        ...new Set(
          String(form.get("tags") ?? "")
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
        ),
      ],
    };
    const parsed = contentFieldsSchema.safeParse(fields);
    if (!parsed.success) {
      setNotice({ text: copy.VALIDATION_FAILED, error: true });
      return;
    }
    const input = saved
      ? { ...fields, expectedUpdatedAt: saved.updatedAt, expectedStatus: saved.status }
      : {
          ...fields,
          slug: String(form.get("slug") ?? "").trim(),
          type: String(form.get("type") ?? "article"),
        };
    pending.current = true;
    setBusy(true);
    setNotice(null);
    setLatest(null);
    try {
      const result = await platformRequest(
        saved ? `${apiPath}/${encodeURIComponent(saved.id)}` : apiPath,
        locale,
        saved ? "PATCH" : "POST",
        input,
        undefined,
        server
          ? serverContentMutationError
          : organization
            ? organizationContentMutationError
            : userPlatformError,
      );
      const confirmed = parseEditableContent(result.content);
      const expectedType = saved?.type ?? String(form.get("type"));
      const expectedStatus =
        expectedType === "post" || expectedType === "question" ? "published" : "draft";
      if (
        result.success !== true ||
        !confirmed ||
        (organization && confirmed.organizationId !== organization.id) ||
        (server && confirmed.serverId !== server.id) ||
        (saved &&
          (confirmed.id !== saved.id ||
            confirmed.slug !== saved.slug ||
            Date.parse(confirmed.updatedAt) <= Date.parse(saved.updatedAt))) ||
        confirmed.type !== expectedType ||
        confirmed.status !== expectedStatus ||
        (!saved && confirmed.slug !== String(form.get("slug")).trim()) ||
        confirmed.title !== fields.title ||
        confirmed.body !== fields.body ||
        confirmed.excerpt !== fields.excerpt ||
        confirmed.coverImageUrl !== fields.coverImageUrl ||
        JSON.stringify(confirmed.tags) !== JSON.stringify(fields.tags)
      )
        throw new Error(
          (server
            ? serverContentMutationError
            : organization
              ? organizationContentMutationError
              : userPlatformError)(locale, "UNCONFIRMED"),
        );
      if (!saved) {
        router.replace(`${workspacePath}/${encodeURIComponent(confirmed.id)}`);
        router.refresh();
      }
      setSaved(confirmed);
      setNotice({ text: copy.saved, error: false });
      setPreview(null);
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : copy.unavailable, error: true });
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function checkSavedVersion() {
    if (!saved || pending.current) return;
    pending.current = true;
    setBusy(true);
    setLatest(null);
    try {
      const result = await platformRequest(
        `${apiPath}/${encodeURIComponent(saved.id)}`,
        locale,
        "GET",
        undefined,
        undefined,
        server
          ? serverContentMutationError
          : organization
            ? organizationContentMutationError
            : userPlatformError,
      );
      const next = parseEditableContent(result.content);
      if (
        !next ||
        next.id !== saved.id ||
        next.slug !== saved.slug ||
        next.type !== saved.type ||
        Date.parse(next.updatedAt) < Date.parse(saved.updatedAt) ||
        (organization && next.organizationId !== organization.id) ||
        (server && next.serverId !== server.id)
      )
        throw new Error(copy.UNCONFIRMED);
      setLatest(next);
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : copy.unavailable, error: true });
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function archive() {
    if (
      !saved ||
      pending.current ||
      latest ||
      !(await confirmAction({
        title: copy.archive,
        object: saved.title,
        consequences: copy.archiveConfirm,
        confirmLabel: copy.archive,
        cancelLabel: copy.back,
        closeLabel: copy.back,
      }))
    )
      return;
    pending.current = true;
    setBusy(true);
    setNotice(null);
    try {
      const result = await platformRequest(
        `${apiPath}/${encodeURIComponent(saved.id)}`,
        locale,
        "DELETE",
        { expectedUpdatedAt: saved.updatedAt, expectedStatus: saved.status },
        undefined,
        server
          ? serverContentMutationError
          : organization
            ? organizationContentMutationError
            : userPlatformError,
      );
      const confirmed = parseEditableContent(result.content);
      if (
        result.success !== true ||
        !confirmed ||
        confirmed.id !== saved.id ||
        (organization && confirmed.organizationId !== organization.id) ||
        (server && confirmed.serverId !== server.id) ||
        confirmed.status !== "archived" ||
        Date.parse(confirmed.updatedAt) <= Date.parse(saved.updatedAt)
      )
        throw new Error(
          (server
            ? serverContentMutationError
            : organization
              ? organizationContentMutationError
              : userPlatformError)(locale, "UNCONFIRMED"),
        );
      setSaved(confirmed);
      setNotice({ text: copy.archivedNote, error: false });
      router.refresh();
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : copy.unavailable, error: true });
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="min-w-0 space-y-4 overflow-x-clip">
      {server && (
        <p className="text-sm text-secondary">
          {serverContentCopy(locale).context}: <strong>{server.name}</strong>
        </p>
      )}
      {organization && (
        <p className="text-sm text-secondary">
          {organizationContentCopy(locale).context}: <strong>{organization.name}</strong>
        </p>
      )}
      <p className="rounded-lg border border-base bg-inset p-4 text-sm text-muted">
        {archived ? copy.archivedNote : copy.reviewNote}
      </p>
      {saved && (
        <div className="flex flex-wrap items-center gap-4 text-sm">
          {!server && !organization && (
            <Link
              prefetch={false}
              href={`/workspace/content/${encodeURIComponent(saved.id)}/history`}
              className="inline-flex min-h-11 items-center rounded text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {authorPublicationDeskCopy(locale).history}
            </Link>
          )}
          <span className="text-secondary">
            {copy.status}: {copy[saved.status]}
          </span>
          {saved.status === "published" && (
            <Link
              href={`/articles/${saved.slug}`}
              className="inline-flex min-h-11 items-center rounded text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {copy.publicView}
            </Link>
          )}
          {archived && (
            <Link
              href={publicationSupportHref(saved.title)}
              className="inline-flex min-h-11 items-center rounded text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {copy.archivedNote}
            </Link>
          )}
        </div>
      )}
      {notice && (
        <div className="space-y-2">
          <p
            role={notice.error ? "alert" : "status"}
            className={`text-sm ${notice.error ? "text-danger" : "text-success"}`}
          >
            {notice.text}
          </p>
          {notice.error && saved && (
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => void checkSavedVersion()}
              className="h-auto min-h-11 rounded px-0 text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {copy.checkLatestContent}
            </Button>
          )}
          {notice.error && (organization || server) && !saved && (
            <Link
              href={workspacePath}
              className="inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {server ? serverContentCopy(locale).title : organizationContentCopy(locale).title}
            </Link>
          )}
        </div>
      )}
      {latest && (
        <section className="nexus-panel min-w-0 space-y-3 p-5" aria-label={copy.latestContent}>
          <h2 className="font-semibold">{copy.latestContent}</h2>
          <p className="text-sm text-muted">{copy.latestContentHelp}</p>
          <p>
            {copy.status}: {copy[latest.status]}
          </p>
          <p>
            {copy.title}: {latest.title}
          </p>
          <p className="whitespace-pre-wrap break-words">
            {copy.excerpt}: {latest.excerpt}
          </p>
          <p className="whitespace-pre-wrap break-words">
            {copy.body}: {latest.body}
          </p>
          <p className="break-words">
            {copy.tags}: {latest.tags.join(", ")}
          </p>
          <p className="break-words">
            {copy.cover}: {latest.coverImageUrl}
          </p>
          {latest.status !== "archived" && (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setSaved(latest);
                setLatest(null);
                setNotice(null);
              }}
            >
              {copy.useLatestContent}
            </Button>
          )}
        </section>
      )}
      <form
        key={saved?.id ?? "new"}
        ref={formRef}
        onSubmit={submit}
        aria-busy={busy}
        className="nexus-panel min-w-0 space-y-4 p-5 sm:p-6"
      >
        <fieldset disabled={busy || archived} className="space-y-4">
          {!saved && (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1 text-sm text-secondary">
                <span>{copy.type}</span>
                <select name="type" className={platformFieldClass}>
                  {(server ? editorialTypes : writerTypes).map((type) => (
                    <option key={type} value={type}>
                      {copy[type]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1 text-sm text-secondary">
                <span>{copy.slug}</span>
                <input
                  name="slug"
                  required
                  minLength={3}
                  maxLength={200}
                  pattern="[a-z0-9-]+"
                  className={platformFieldClass}
                />
              </label>
            </div>
          )}
          <label className="block space-y-1 text-sm text-secondary">
            <span>{copy.title}</span>
            <input
              name="title"
              required
              minLength={3}
              maxLength={200}
              defaultValue={saved?.title}
              className={platformFieldClass}
            />
          </label>
          <label className="block space-y-1 text-sm text-secondary">
            <span>{copy.excerpt}</span>
            <textarea
              name="excerpt"
              rows={2}
              maxLength={350}
              defaultValue={saved?.excerpt}
              className={platformFieldClass}
            />
          </label>
          <label className="block space-y-1 text-sm text-secondary">
            <span>{copy.body}</span>
            <textarea
              name="body"
              required
              minLength={10}
              maxLength={20_000}
              rows={16}
              defaultValue={saved?.body}
              className={platformFieldClass}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1 text-sm text-secondary">
              <span>{copy.tags}</span>
              <input
                name="tags"
                maxLength={320}
                defaultValue={saved?.tags.join(", ")}
                className={platformFieldClass}
              />
            </label>
            <label className="block space-y-1 text-sm text-secondary">
              <span>{copy.cover}</span>
              <input
                name="coverImageUrl"
                type="url"
                maxLength={2048}
                defaultValue={saved?.coverImageUrl}
                className={platformFieldClass}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" isLoading={busy} disabled={Boolean(latest)} className="min-h-11">
              {saved ? copy.save : copy.submit}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-auto min-h-11 rounded px-0 text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
              onClick={() =>
                setPreview(
                  preview === null
                    ? String(
                        formRef.current ? (new FormData(formRef.current).get("body") ?? "") : "",
                      )
                    : null,
                )
              }
            >
              {preview === null ? copy.preview : copy.editText}
            </Button>
          </div>
        </fieldset>
      </form>
      {preview !== null && (
        <section
          aria-label={copy.preview}
          className="nexus-panel min-w-0 whitespace-pre-wrap break-words p-5 text-sm text-primary"
        >
          {preview}
        </section>
      )}
      {saved && !archived && (
        <Button
          type="button"
          variant="ghost"
          disabled={busy || Boolean(latest)}
          onClick={() => void archive()}
          className="h-auto min-h-11 px-0 text-sm font-semibold text-danger"
        >
          {copy.archive}
        </Button>
      )}
    </div>
  );
}
