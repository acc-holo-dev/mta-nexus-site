import * as React from "react";
import { X } from "lucide-react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

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
}

export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  children,
}: DialogProps) {
  const titleId = React.useId();
  const descriptionId = React.useId();
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!isOpen) return;

    const previousFocus = document.activeElement;
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus();
      }
    };
  }, [isOpen, onClose]);

  const trapFocus = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;

      const targets = Array.from(
        root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter(
        (element) =>
          element.getClientRects().length > 0 &&
          getComputedStyle(element).visibility !== "hidden",
      );
      const activeIndex = targets.indexOf(
        document.activeElement as HTMLElement,
      );
      const nextIndex = nextDialogFocusIndex(
        targets.length,
        activeIndex,
        event.shiftKey,
      );
      if (nextIndex === null) return;

      event.preventDefault();
      targets[nextIndex]?.focus();
    },
    [],
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        onKeyDown={trapFocus}
        className="relative w-full max-w-lg rounded-xl border border-base bg-elevated p-6 text-primary shadow-nexus-lg"
      >
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1 text-muted transition-colors hover:bg-hover hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)]"
          aria-label="Close dialog"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="mb-4 pr-8">
          <h3 id={titleId} className="text-lg font-bold text-primary">
            {title}
          </h3>
          {description && (
            <p
              id={descriptionId}
              className="mt-1 text-sm text-muted"
            >
              {description}
            </p>
          )}
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}
