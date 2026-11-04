import { EmptyState, ErrorState, SectionHeader } from "@nexus/ui";
import Link from "next/link";
import type { PersonalChangesSummary } from "../lib/home-personal-changes-types";
import type { HomePersonalPreference } from "../lib/home-personal-preference";
import { HomePersonalOptOut } from "./home-personal-opt-out";

export type HomePersonalCopy = {
  title: string;
  description: string;
  scopeNote: string;
  empty: string;
  emptyHint: string;
  error: string;
  retry: string;
  partial: string;
  hidden: string;
  hiddenHint: string;
  hidePreference: string;
  showPreference: string;
  reasonReleaseWatch: string;
  reasonDiscussionFollow: string;
  reasonReplyToMe: string;
  openInbox: string;
};

const reasonKey = {
  releaseWatch: "reasonReleaseWatch",
  discussionFollow: "reasonDiscussionFollow",
  replyToMe: "reasonReplyToMe",
} as const;

const actionLinkClass =
  "inline-flex min-h-11 items-center rounded text-sm font-semibold text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export const HOME_PERSONAL_CHANGES_HEADING_ID = "home-personal-changes-heading";
export const HOME_PERSONAL_CHANGES_SCOPE_NOTE_ID = "home-personal-changes-scope-note";

export function HomePersonalChangesPanel({
  summary,
  preference,
  copy,
}: {
  summary: PersonalChangesSummary;
  preference: HomePersonalPreference;
  copy: HomePersonalCopy;
}) {
  return (
    <section
      aria-labelledby={HOME_PERSONAL_CHANGES_HEADING_ID}
      className="min-w-0 space-y-3 overflow-x-clip"
    >
      <SectionHeader
        title={copy.title}
        description={copy.description}
        titleId={HOME_PERSONAL_CHANGES_HEADING_ID}
        action={
          <HomePersonalOptOut
            preference={preference}
            hideLabel={copy.hidePreference}
            showLabel={copy.showPreference}
            describedBy={HOME_PERSONAL_CHANGES_SCOPE_NOTE_ID}
          />
        }
      />
      <p id={HOME_PERSONAL_CHANGES_SCOPE_NOTE_ID} className="text-xs text-muted">
        {copy.scopeNote}
      </p>

      {summary.status === "hidden" ? (
        <EmptyState title={copy.hidden} description={copy.hiddenHint} />
      ) : null}

      {summary.status === "empty" ? (
        <EmptyState
          title={copy.empty}
          description={copy.emptyHint}
          action={
            <Link href="/notifications?state=unread" className={actionLinkClass}>
              {copy.openInbox}
            </Link>
          }
        />
      ) : null}

      {summary.status === "error" ? (
        <ErrorState
          title={copy.error}
          action={
            <div className="flex min-w-0 flex-wrap items-center justify-center gap-3">
              <Link href="/" className={actionLinkClass}>
                {copy.retry}
              </Link>
              <Link href="/notifications?state=unread" className={actionLinkClass}>
                {copy.openInbox}
              </Link>
            </div>
          }
        />
      ) : null}

      {summary.status === "partial" || summary.status === "ok" ? (
        <div className="min-w-0 space-y-3 overflow-x-clip">
          {summary.status === "partial" ? (
            <p className="text-sm text-muted">{copy.partial}</p>
          ) : null}
          <ul className="min-w-0 divide-y divide-base overflow-x-clip rounded-lg border border-base bg-elevated">
            {summary.items.map((item) => (
              <li key={item.id} className="min-w-0">
                <Link
                  href={item.href}
                  className="flex min-h-11 min-w-0 flex-col justify-center gap-1 overflow-x-clip px-4 py-3 text-sm transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--nexus-accent)]"
                >
                  <span className="font-label uppercase text-faint">
                    {copy[reasonKey[item.reason]]}
                  </span>
                  <span className="break-words font-semibold text-primary">{item.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
