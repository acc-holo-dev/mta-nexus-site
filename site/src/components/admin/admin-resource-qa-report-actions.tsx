"use client";

import { Button, ErrorState } from "@nexus/ui";
import { LoaderCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { confirmsAdminAction } from "../../lib/admin-action-confirmation";
import { communityReportCopy } from "../../lib/community-report-copy";
import { privateApiRequest } from "../../lib/private-api-request";
import { resourceQaCopy, resourceQaError } from "../../lib/resource-qa-i18n";
import { confirmAction } from "../confirm-action";
import { useNexusLocale } from "../locale-context";

/**
 * Staff bridge: remove the reported Q&A thread, then resolve the report record.
 * Uses the existing public remove route + admin report decide action.
 */
export function AdminResourceQaReportActions({
  reportId,
  productId,
  threadId,
  revision,
}: {
  reportId: string;
  productId: string;
  threadId: string;
  revision: number;
}) {
  const router = useRouter();
  const { dictionary, locale } = useNexusLocale();
  const admin = dictionary.admin;
  const qa = resourceQaCopy(locale);
  const labels = communityReportCopy(locale);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);

  async function removeAndResolve() {
    if (busy.current || pending) return;
    if (
      !(await confirmAction({
        title: qa.removeThreadConfirmTitle,
        object: threadId,
        consequences: `${qa.removeThreadConfirm} ${admin.resolveReportConfirm}`,
        confirmLabel: admin.removeReportedQaThread,
        cancelLabel: labels.cancel,
        closeLabel: labels.cancel,
        danger: true,
      }))
    )
      return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const removeResponse = await fetch(
        `/api/products/${encodeURIComponent(productId)}/qa/${encodeURIComponent(threadId)}/remove`,
        privateApiRequest({
          method: "POST",
          timeoutMs: 15_000,
          json: { action: "remove", expectedRevision: revision },
        }),
      );
      const removePayload: unknown = await removeResponse.json().catch(() => null);
      const removed =
        removeResponse.ok &&
        Boolean(
          removePayload &&
            typeof removePayload === "object" &&
            (removePayload as { success?: boolean }).success,
        );
      if (!removed) {
        const code =
          removePayload && typeof removePayload === "object"
            ? (removePayload as { code?: string }).code
            : null;
        setError(resourceQaError(locale, code ?? "UNCONFIRMED"));
        return;
      }

      const decideResponse = await fetch("/api/admin/actions", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "report",
          targetId: reportId,
          action: "resolve",
          notes: admin.removeReportedQaThreadNotes,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const decidePayload = await decideResponse.json().catch(() => null);
      if (!confirmsAdminAction(decideResponse.status, decidePayload, reportId, "resolve")) {
        setError(decidePayload?.error || admin.reportDecisionFailed);
        return;
      }
      router.refresh();
    } catch {
      setError(admin.reportDecisionUnavailable);
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        className="min-h-11 gap-1.5 bg-danger-soft text-danger text-xs"
        disabled={pending}
        onClick={() => void removeAndResolve()}
      >
        {pending ? (
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        )}
        {admin.removeReportedQaThread}
      </Button>
      {error ? (
        <ErrorState title={error} description={admin.reportDecisionFailedDescription} />
      ) : null}
    </div>
  );
}
