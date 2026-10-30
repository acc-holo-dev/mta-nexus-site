import { PRODUCT_TYPES, type PublisherResourceQuery, RESOURCE_READINESS } from "@nexus/domain";
import { Button, Input } from "@nexus/ui";
import Link from "next/link";
import { getDictionary } from "../lib/i18n";
import { PRODUCT_PUBLISHING_KEYS } from "../lib/product-type-labels";
import { getResourcePublisherCopy } from "../lib/resource-publisher-i18n";
import { resourcePublisherUrl } from "../lib/resource-publisher-query";

const controlClass =
  "h-10 w-full rounded-lg border border-base bg-inset px-3 py-2 text-sm text-primary transition-colors placeholder:text-[color:var(--nexus-text-faint)] hover:border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)]";
const nativeLabelClass = "block font-label uppercase text-secondary";

export function ResourcePublisherFilters({
  query,
  statusCounts,
  locale,
}: {
  query: PublisherResourceQuery & { page: number };
  statusCounts: Record<string, number>;
  locale: "ru" | "en";
}) {
  const copy = getResourcePublisherCopy(locale),
    dictionary = getDictionary(locale),
    labels = dictionary.authorResources;
  return (
    <section className="space-y-4" aria-label={copy.filters}>
      <form
        action="/workspace/resources"
        method="get"
        className="nexus-panel grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3"
      >
        <input type="hidden" name="status" value={query.status} />
        <Input
          id="publisher-search"
          name="q"
          label={copy.search}
          defaultValue={query.q}
          maxLength={120}
        />
        <div className="space-y-1.5">
          <label htmlFor="publisher-type" className={nativeLabelClass}>
            {copy.type}
          </label>
          <select
            id="publisher-type"
            name="type"
            defaultValue={query.type}
            className={controlClass}
          >
            <option value="all">{copy.all}</option>
            {PRODUCT_TYPES.map((type) => (
              <option key={type} value={type}>
                {dictionary.publishing[PRODUCT_PUBLISHING_KEYS[type]]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="publisher-scope" className={nativeLabelClass}>
            {copy.scope}
          </label>
          <select
            id="publisher-scope"
            name="scope"
            defaultValue={query.scope}
            className={controlClass}
          >
            {["all", "personal", "organization"].map((scope) => (
              <option key={scope} value={scope}>
                {copy[scope as "all" | "personal" | "organization"]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="publisher-readiness" className={nativeLabelClass}>
            {copy.readinessLabel}
          </label>
          <select
            id="publisher-readiness"
            name="readiness"
            defaultValue={query.readiness}
            className={controlClass}
          >
            <option value="all">{copy.all}</option>
            {RESOURCE_READINESS.map((value) => (
              <option key={value} value={value}>
                {copy.readiness[value]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="publisher-sort" className={nativeLabelClass}>
            {copy.sort}
          </label>
          <select
            id="publisher-sort"
            name="sort"
            defaultValue={query.sort}
            className={controlClass}
          >
            {["updated", "created", "title"].map((sort) => (
              <option key={sort} value={sort}>
                {copy[sort as "updated" | "created" | "title"]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-4">
          <Button type="submit" className="min-h-11">
            {copy.apply}
          </Button>
          <Link className="text-sm text-accent underline" href="/workspace/resources">
            {copy.reset}
          </Link>
        </div>
      </form>
      <nav aria-label={labels.status} className="flex flex-wrap gap-2">
        {(["all", "draft", "pending_review", "published", "suspended", "archived"] as const).map(
          (status) => (
            <Link
              key={status}
              href={resourcePublisherUrl({ ...query, status, page: 1 })}
              aria-current={query.status === status ? "page" : undefined}
              className="rounded-md border border-base px-3 py-2 text-sm aria-[current=page]:bg-accent aria-[current=page]:text-white"
            >
              {status === "all" ? copy.all : labels.statusLabels[status]} ·{" "}
              {status === "all"
                ? Object.values(statusCounts).reduce((sum, value) => sum + value, 0)
                : (statusCounts[status] ?? 0)}
            </Link>
          ),
        )}
      </nav>
    </section>
  );
}
