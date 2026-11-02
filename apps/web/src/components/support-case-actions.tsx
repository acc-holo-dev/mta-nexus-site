"use client";

import { Button } from "@nexus/ui";
import { getDictionary, type Locale } from "../lib/i18n";
import type { SupportCaseData, SupportCaseStatus } from "../lib/support-response";
import { supportWorkspaceCopy } from "../lib/support-workspace-copy";
import { confirmAction } from "./confirm-action";
export function SupportCaseActions({
  supportCase,
  staff,
  requester,
  busy,
  locale,
  onChangeStatus,
}: {
  supportCase: SupportCaseData;
  staff: boolean;
  requester: boolean;
  busy: boolean;
  locale: Locale;
  onChangeStatus: (status: SupportCaseStatus) => void;
}) {
  if (!supportCase.updatedAt || (!staff && (!requester || supportCase.status === "closed")))
    return null;
  const copy = getDictionary(locale).support,
    workspace = supportWorkspaceCopy(locale);
  const actions: { status: SupportCaseStatus; label: string }[] = staff
    ? ([
        { status: "open", label: copy.reopen },
        { status: "resolved", label: copy.resolve },
        { status: "closed", label: copy.close },
      ].filter((action) => action.status !== supportCase.status) as {
        status: SupportCaseStatus;
        label: string;
      }[])
    : [
        {
          status: supportCase.status === "open" ? "resolved" : "open",
          label: supportCase.status === "open" ? workspace.resolveOwn : workspace.reopenOwn,
        },
      ];
  async function changeStatus(status: SupportCaseStatus, label: string) {
    if (busy) return;
    const confirmed = await confirmAction({
      title: workspace.confirmStatus,
      object: supportCase.subject,
      consequences: workspace.confirmStatusNote,
      confirmLabel: label,
      cancelLabel: workspace.cancel,
      closeLabel: workspace.cancel,
      danger: status === "closed",
    });
    if (!confirmed) return;
    onChangeStatus(status);
  }
  return (
    <div className="space-y-2">
      {!staff && <p className="text-sm text-muted">{workspace.ownHelp}</p>}
      {supportCase.status === "resolved" && !staff ? (
        <p className="text-sm text-secondary">{workspace.resolvedReplyReopens}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action.status}
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void changeStatus(action.status, action.label)}
            className={
              action.status === "closed"
                ? "min-h-10 border-danger/30 text-danger"
                : "min-h-10 text-accent"
            }
          >
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
