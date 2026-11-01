"use client";

import { ConfirmDialog, type ConfirmDialogProps } from "@nexus/ui";
import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";

export type ConfirmActionRequest = Pick<
  ConfirmDialogProps,
  "title" | "object" | "scope" | "consequences" | "confirmLabel" | "cancelLabel" | "closeLabel" | "danger"
>;

/**
 * Imperative native confirm (UX-06 A). Replaces `window.confirm` without weakening
 * password/slug/revision/busy guards at the call site — callers still validate first.
 * Cancel resolves false and never runs the caller's mutation.
 */
export function confirmAction(request: ConfirmActionRequest): Promise<boolean> {
  if (typeof document === "undefined") return Promise.resolve(false);

  return new Promise((resolve) => {
    const host = document.createElement("div");
    host.dataset.nexusConfirm = "true";
    document.body.appendChild(host);
    const root: Root = createRoot(host);
    let settled = false;

    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      root.unmount();
      host.remove();
      resolve(value);
    };

    root.render(
      createElement(ConfirmDialog, {
        isOpen: true,
        title: request.title,
        object: request.object,
        scope: request.scope,
        consequences: request.consequences,
        confirmLabel: request.confirmLabel,
        cancelLabel: request.cancelLabel,
        closeLabel: request.closeLabel,
        danger: request.danger ?? true,
        onConfirm: () => finish(true),
        onCancel: () => finish(false),
      }),
    );
  });
}
