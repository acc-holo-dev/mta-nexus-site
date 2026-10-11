import { PRODUCT_TYPES, RESOURCE_READINESS, type PublisherResourceQuery } from "@nexus/domain";
import Link from "next/link";
import { getResourcePublisherCopy } from "../lib/resource-publisher-i18n";
import { resourcePublisherUrl } from "../lib/resource-publisher-query";
import { PRODUCT_PUBLISHING_KEYS } from "../lib/product-type-labels";
import { getDictionary } from "../lib/i18n";
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
  const input = "w-full rounded-md border border-base bg-surface px-3 py-2 text-sm text-primary";
  return (
    <section className="space-y-4" aria-label={copy.filters}>
      <form
        action="/workspace/resources"
        method="get"
        className="nexus-panel grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3"
      >
        <input type="hidden" name="status" value={query.status} />
        <label className="space-y-1 text-sm text-secondary">
          {copy.search}
          <input name="q" defaultValue={query.q} maxLength={120} className={input} />
        </label>
        <label className="space-y-1 text-sm text-secondary">
          {copy.type}
          <select name="type" defaultValue={query.type} className={input}>
            <option value="all">{copy.all}</option>
            {PRODUCT_TYPES.map((type) => (
              <option key={type} value={type}>
                {dictionary.publishing[PRODUCT_PUBLISHING_KEYS[type]]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm text-secondary">
          {copy.scope}
          <select name="scope" defaultValue={query.scope} className={input}>
            {["all", "personal", "organization"].map((scope) => (
              <option key={scope} value={scope}>
                {copy[scope as "all" | "personal" | "organization"]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm text-secondary">
          {copy.readinessLabel}
          <select name="readiness" defaultValue={query.readiness} className={input}>
            <option value="all">{copy.all}</option>
            {RESOURCE_READINESS.map((value) => (
              <option key={value} value={value}>
                {copy.readiness[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm text-secondary">
          {copy.sort}
          <select name="sort" defaultValue={query.sort} className={input}>
            {["updated", "created", "title"].map((sort) => (
              <option key={sort} value={sort}>
                {copy[sort as "updated" | "created" | "title"]}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-4">
          <button className="rounded-md bg-accent px-4 py-2 text-sm text-white" type="submit">
            {copy.apply}
          </button>
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
