import {
  Code2,
  Flag,
  Heart,
  MessagesSquare,
  Newspaper,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import type { Locale } from "../../../lib/i18n";
import { communityReportCopy } from "../../community/community-report-copy";
import { reactionCopy } from "../../community/content-reaction-copy";
import { ownDiscussionCopy } from "../../community/discussion-workspace-copy";
import { publicationCopy } from "../../community/publication-feed-copy";
import { platformReportCopy } from "../../moderation/platform-report-i18n";
import { verificationCopy } from "../../trust/verification-workspace-copy";

/** Shared member destinations: the mobile and desktop shell expose the same tools. */
export function publicationDestinations(locale: Locale) {
  return [
    { href: "/workspace/feed", label: publicationCopy(locale).title, icon: Newspaper },
    {
      href: "/workspace/discussions",
      label: ownDiscussionCopy(locale).title,
      icon: MessagesSquare,
    },
    { href: "/workspace/reactions", label: reactionCopy(locale).my, icon: Heart },
    { href: "/workspace/reports", label: communityReportCopy(locale).myReports, icon: Flag },
    {
      href: "/workspace/platform-reports",
      label: platformReportCopy(locale).myReports,
      icon: ShieldAlert,
    },
    { href: "/workspace/verification", label: verificationCopy(locale).title, icon: ShieldCheck },
    { href: "/settings/developer", label: verificationCopy(locale).profile, icon: Code2 },
  ];
}
