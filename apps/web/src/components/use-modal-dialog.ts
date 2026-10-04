"use client";

import { useEffect, useRef, type MouseEvent } from "react";

/** Native modal behavior supplies focus containment and makes the page inert. */
export function useModalDialog(isOpen: boolean) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement;
    if (!dialog.open) dialog.showModal();
    // Native modality makes the background inert; explicit wrapping also keeps
    // sequential focus from leaving the dialog for browser chrome at its edges.
    const wrapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const targets = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          "a[href], button, input, select, textarea, [tabindex]",
        ),
      ).filter(
        (element) =>
          element.tabIndex >= 0 &&
          !element.matches(":disabled") &&
          element.getClientRects().length > 0 &&
          getComputedStyle(element).visibility !== "hidden",
      );
      const first = targets[0];
      const last = targets[targets.length - 1];
      if (!first || !last) {
        event.preventDefault();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener("keydown", wrapFocus);
    return () => {
      dialog.removeEventListener("keydown", wrapFocus);
      dialog.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [isOpen]);
  return dialogRef;
}

export function clickedDialogBackdrop(event: MouseEvent<HTMLDialogElement>) {
  if (event.target !== event.currentTarget) return false;
  const rect = event.currentTarget.getBoundingClientRect();
  return (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  );
}
