"use client";

import { Button } from "@nexus/ui";
import { useRouter } from "next/navigation";
import {
  HOME_PERSONAL_HIDE,
  HOME_PERSONAL_SHOW,
  homePersonalPreferenceCookie,
  type HomePersonalPreference,
} from "../lib/home-personal-preference";

export function HomePersonalOptOut({
  preference,
  hideLabel,
  showLabel,
  describedBy,
}: {
  preference: HomePersonalPreference;
  hideLabel: string;
  showLabel: string;
  describedBy?: string;
}) {
  const router = useRouter();
  const next = preference === "hide" ? HOME_PERSONAL_SHOW : HOME_PERSONAL_HIDE;
  const label = preference === "hide" ? showLabel : hideLabel;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-auto min-h-11 px-2 text-xs font-medium text-muted"
      aria-describedby={describedBy}
      onClick={() => {
        // biome-ignore lint/suspicious/noDocumentCookie: non-sensitive SameSite preference before refresh.
        document.cookie = homePersonalPreferenceCookie(next);
        router.refresh();
      }}
    >
      {label}
    </Button>
  );
}
