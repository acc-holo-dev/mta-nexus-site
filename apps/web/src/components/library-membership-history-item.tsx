import type { LibraryMembershipHistoryItem } from "@nexus/domain";
import Link from "next/link";
import { libraryMembershipHistoryCopy } from "../lib/library-membership-history-i18n";
import { libraryCollectionHistoryCopy } from "../lib/library-collection-history-i18n";
import { libraryCollectionsCopy } from "../lib/library-collections-i18n";
import { collectionHref } from "../lib/library-collections-query";
import { membershipHistoryHref } from "../lib/library-membership-history-query";
export function LibraryMembershipHistoryEntry({
  item,
  locale,
}: {
  item: LibraryMembershipHistoryItem;
  locale: "ru" | "en";
}) {
  const c = libraryCollectionsCopy(locale),
    h = libraryCollectionHistoryCopy(locale),
    m = libraryMembershipHistoryCopy(locale);
  const receipt = item.receipt,
    resource = item.resource;
  return (
    <article className="nexus-panel space-y-4 p-5">
      <h2>
        <Link href={membershipHistoryHref(item.id)} className="text-accent underline">
          {m.detail}
        </Link>
      </h2>
      <p>
        {h.time}: <time dateTime={item.createdAt}>{item.createdAt}</time>
      </p>
      <code className="block break-all text-xs">
        {c.receipt}: {item.id}
      </code>
      {!receipt ? (
        <p>{h.unknown}</p>
      ) : (
        <>
          <code className="block break-all text-xs">
            {c.request}: {receipt.requestId}
          </code>
          {resource && (
            <div>
              <p>
                {resource.currentAvailable
                  ? (resource.currentTitle ?? h.unavailable)
                  : h.unavailable}
              </p>
              <code className="block break-all text-xs">{resource.productId}</code>
              {resource.currentAvailable && (
                <Link
                  href={`/workspace/library/${encodeURIComponent(resource.productId)}/collections`}
                  className="text-accent underline"
                >
                  {c.resourceCollections}
                </Link>
              )}
            </div>
          )}
          <ol className="space-y-4">
            {receipt.children.map((child, index) => {
              const change = receipt.command.changes[index],
                now = item.collections.find((value) => value.collectionId === child.collection.id);
              return (
                <li key={child.id} className="space-y-2 border-t border-base pt-3">
                  <p>{child.command.action === "add" ? c.add : c.remove}</p>
                  <p className="break-words">
                    {h.recorded}: {child.collection.name} · {c[child.collection.status]} ·{" "}
                    {c.revision} {child.collection.revision}
                  </p>
                  <code className="block break-all text-xs">{child.collection.id}</code>
                  <p>
                    {m.before}: {change?.wasInCollection ? m.present : m.absent} · {m.after}:{" "}
                    {change?.inCollection ? m.present : m.absent}
                  </p>
                  {now?.current ? (
                    <>
                      <p className="break-words">
                        {h.current}:{" "}
                        <Link
                          href={collectionHref(now.current.id)}
                          className="text-accent underline"
                        >
                          {now.current.name}
                        </Link>{" "}
                        · {c[now.current.status]} · {c.revision} {now.current.revision}
                      </p>
                      <p>
                        {m.currentMembership}:{" "}
                        {now.inCollection === null
                          ? h.noCurrent
                          : now.inCollection
                            ? m.present
                            : m.absent}
                      </p>
                    </>
                  ) : (
                    <p>{h.noCurrent}</p>
                  )}
                  <Link
                    href={collectionHref(child.collection.id, "history")}
                    className="text-accent underline"
                  >
                    {c.history}
                  </Link>
                  <code className="block break-all text-xs">
                    {c.receipt}: {child.id}
                  </code>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </article>
  );
}
