/** Left-click without modifiers opens the in-page lightbox; real link behavior stays for the rest. */
export function shouldOpenGalleryLightbox(event: {
  button: number;
  defaultPrevented: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}): boolean {
  if (event.defaultPrevented || event.button !== 0) return false;
  return !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);
}

export function stepGalleryIndex(current: number, delta: -1 | 1, length: number): number | null {
  if (length <= 0) return null;
  const next = current + delta;
  if (next < 0 || next >= length) return null;
  return next;
}
