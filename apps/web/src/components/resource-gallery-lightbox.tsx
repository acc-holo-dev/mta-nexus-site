"use client";

import type { ResourceMediaItem } from "@nexus/domain";
import { Button, buttonClassName } from "@nexus/ui";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { safeResourceImageUrl } from "../lib/resource-image-url";
import { resourceMediaCopy } from "../lib/resource-media-i18n";
import { stepGalleryIndex } from "./resource-gallery-interaction";
import { clickedDialogBackdrop, useModalDialog } from "./use-modal-dialog";

function LightboxImage({
  src,
  alt,
  fallback,
}: {
  src: string | undefined;
  alt: string;
  fallback: string;
}) {
  const safeSrc = safeResourceImageUrl(src);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (!safeSrc || failedUrl === safeSrc) {
    return (
      <div
        role="img"
        aria-label={fallback}
        className="flex min-h-[12rem] w-full items-center justify-center rounded-lg border border-base bg-inset px-4 py-10 text-center text-sm text-faint"
      >
        {fallback}
      </div>
    );
  }
  return (
    // biome-ignore lint/performance/noImgElement: gallery lightbox shows normalized platform URLs only; decode failures must stay inside the overlay.
    <img
      key={safeSrc}
      src={safeSrc}
      alt={alt}
      width={1280}
      height={720}
      decoding="async"
      onError={() => setFailedUrl(safeSrc)}
      ref={(image) => {
        if (image?.complete && image.naturalWidth === 0) setFailedUrl(safeSrc);
      }}
      className="mx-auto max-h-[min(70dvh,48rem)] w-full object-contain"
    />
  );
}

export function ResourceGalleryLightbox({
  items,
  activeIndex,
  title,
  locale,
  onClose,
  onActiveIndexChange,
}: {
  items: ResourceMediaItem[];
  activeIndex: number;
  title: string;
  locale: "ru" | "en";
  onClose: () => void;
  onActiveIndexChange: (index: number) => void;
}) {
  const copy = resourceMediaCopy(locale);
  const dialogRef = useModalDialog(true);
  const item = items[activeIndex];
  const caption = item?.caption?.trim();
  const imageTitle = caption || title;
  const canPrevious = activeIndex > 0;
  const canNext = activeIndex < items.length - 1;

  const goPrevious = useCallback(() => {
    const next = stepGalleryIndex(activeIndex, -1, items.length);
    if (next !== null) onActiveIndexChange(next);
  }, [activeIndex, items.length, onActiveIndexChange]);

  const goNext = useCallback(() => {
    const next = stepGalleryIndex(activeIndex, 1, items.length);
    if (next !== null) onActiveIndexChange(next);
  }, [activeIndex, items.length, onActiveIndexChange]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrevious();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      }
    };
    dialog.addEventListener("keydown", onKeyDown);
    return () => dialog.removeEventListener("keydown", onKeyDown);
  }, [dialogRef, goNext, goPrevious]);

  if (!item) return null;

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop dismiss is pointer-only; Escape and explicit close controls handle keyboard exit.
    <dialog
      ref={dialogRef}
      aria-modal="true"
      aria-label={copy.lightboxTitle}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (clickedDialogBackdrop(event)) onClose();
      }}
      className="fixed inset-0 z-50 m-auto flex max-h-[min(100%,calc(100dvh-2rem))] w-[calc(100%-2rem)] max-w-4xl flex-col overflow-hidden rounded-xl border border-base bg-elevated p-0 text-primary shadow-nexus-lg backdrop:bg-black/60 open:flex"
    >
      <div className="flex items-center justify-between gap-3 border-b border-base px-4 py-3">
        <p className="min-w-0 truncate text-sm font-semibold text-primary">
          {caption || copy.lightboxTitle}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={copy.lightboxClose}
          onClick={onClose}
          className="h-8 w-8 shrink-0 rounded-md"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain p-4">
        <div className="relative flex min-h-[12rem] flex-1 items-center justify-center">
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={!canPrevious}
            aria-label={copy.lightboxPrevious}
            onClick={goPrevious}
            className="absolute left-0 top-1/2 z-10 h-10 w-10 -translate-y-1/2 rounded-full sm:left-2"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </Button>
          <LightboxImage src={item.url} alt={imageTitle} fallback={copy.previewUnavailable} />
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={!canNext}
            aria-label={copy.lightboxNext}
            onClick={goNext}
            className="absolute right-0 top-1/2 z-10 h-10 w-10 -translate-y-1/2 rounded-full sm:right-2"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
        {caption ? (
          <p className="break-words text-center text-sm text-secondary">{caption}</p>
        ) : null}
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {copy.lightboxClose}
          </Button>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClassName({ variant: "primary", size: "md" })}
          >
            {copy.lightboxOpenOriginal}
          </a>
        </div>
      </div>
    </dialog>
  );
}
