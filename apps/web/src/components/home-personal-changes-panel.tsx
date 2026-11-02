import { SectionHeader } from "@nexus/ui";
import Link from "next/link";
import type { PersonalChangesSummary } from "../lib/home-personal-changes-types";
import type { HomePersonalPreference } from "../lib/home-personal-preference";
import { HomePersonalOptOut } from "./home-personal-opt-out";

export type HomePersonalCopy = {
  title: string;
  description: string;
  scopeNote: string;
  empty: string;
  error: string;
  partial: string;
  hidden: string;
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
    <section aria-labelledby={HOME_PERSONAL_CHANGES_HEADING_ID}>
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

      {summary.status === "hidden" ? <p className="text-sm text-muted">{copy.hidden}</p> : null}

      {summary.status === "empty" ? <p className="text-sm text-muted">{copy.empty}</p> : null}

      {summary.status === "error" ? (
        <div className="space-y-2 text-sm text-muted">
          <p>{copy.error}</p>
          <Link
            href="/notifications?state=unread"
            className="font-semibold text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
          >
            {copy.openInbox}
          </Link>
        </div>
      ) : null}

      {summary.status === "partial" || summary.status === "ok" ? (
        <div className="space-y-3">
          {summary.status === "partial" ? (
            <p className="text-sm text-muted">{copy.partial}</p>
          ) : null}
          <ul className="divide-y divide-base rounded-lg border border-base bg-elevated">
            {summary.items.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex flex-col gap-1 px-4 py-3 text-sm transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--nexus-accent)]"
                >
                  <span className="font-label uppercase text-faint">
                    {copy[reasonKey[item.reason]]}
                  </span>
                  <span className="font-semibold text-primary">{item.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
