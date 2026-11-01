import * as React from "react";
import { X } from "lucide-react";
import { Button } from "./button";

const FOCUSABLE_SELECTOR =
  'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/** Shared Tab wrap math used by native dialogs and ConfirmDialog. */
export function nextDialogFocusIndex(
  length: number,
  activeIndex: number,
  shiftKey: boolean,
): number | null {
  if (length <= 0) return null;
  if (shiftKey && activeIndex <= 0) return length - 1;
  if (!shiftKey && (activeIndex < 0 || activeIndex >= length - 1)) return 0;
  return null;
}

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  /** Localized accessible label for the close control. */
  closeLabel?: string;
}

/**
 * Native `<dialog>` shell (UX-06 A). Prefer this over inventing a second overlay.
 * Escape/backdrop/inert/return-focus come from the browser; Tab wrap is reinforced.
 */
export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  closeLabel = "Close dialog",
}: DialogProps) {
  const titleId = React.useId();
  const descriptionId = React.useId();
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!isOpen) {
      if (dialog.open) dialog.close();
      return;
    }
    const previousFocus = document.activeElement;
    if (!dialog.open) dialog.showModal();
    closeButtonRef.current?.focus();
    const wrapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const targets = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (element) =>
          element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden",
      );
      const activeIndex = targets.indexOf(document.activeElement as HTMLElement);
      const nextIndex = nextDialogFocusIndex(targets.length, activeIndex, event.shiftKey);
      if (nextIndex === null) return;
      event.preventDefault();
      targets[nextIndex]?.focus();
    };
    const dismissOnBackdrop = (event: MouseEvent) => {
      if (event.target === dialog) onClose();
    };
    dialog.addEventListener("keydown", wrapFocus);
    dialog.addEventListener("click", dismissOnBackdrop);
    return () => {
      dialog.removeEventListener("keydown", wrapFocus);
      dialog.removeEventListener("click", dismissOnBackdrop);
      if (dialog.open) dialog.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="fixed inset-0 z-50 m-auto max-h-[min(100%,calc(100dvh-2rem))] w-[calc(100%-2rem)] max-w-lg open:flex flex-col overflow-hidden rounded-xl border border-base bg-elevated p-0 text-primary shadow-nexus-lg backdrop:bg-black/60"
    >
      <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain p-6">
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1 text-muted transition-colors hover:bg-hover hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)]"
          aria-label={closeLabel}
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="mb-4 pr-8">
          <h3 id={titleId} className="text-lg font-bold text-primary">
            {title}
          </h3>
          {description ? (
            <p id={descriptionId} className="mt-1 text-sm text-muted">
              {description}
            </p>
          ) : null}
        </div>
        <div>{children}</div>
      </div>
    </dialog>
  );
}

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  /** Concrete object under change (name, handle, id label). */
  object: string;
  /** Optional scale of the action (count, selection size). */
  scope?: string;
  /** What happens if confirmed. */
  consequences: string;
  confirmLabel: string;
  cancelLabel: string;
  closeLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Destructive confirm surface: object + optional scope + consequences. Cancel sends nothing. */
export function ConfirmDialog({
  isOpen,
  title,
  object,
  scope,
  consequences,
  confirmLabel,
  cancelLabel,
  closeLabel = "Close dialog",
  danger = true,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog isOpen={isOpen} onClose={onCancel} title={title} closeLabel={closeLabel}>
      <div className="space-y-4">
        <div className="space-y-2 text-sm">
          <p className="break-words font-semibold text-primary">{object}</p>
          {scope ? <p className="break-words text-secondary">{scope}</p> : null}
          <p className="break-words text-secondary">{consequences}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={danger ? "danger" : "primary"}
            disabled={busy}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
