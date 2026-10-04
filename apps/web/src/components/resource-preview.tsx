"use client";

import { useState } from "react";
import { safeExternalWebUrl } from "@nexus/validation";

export function ResourcePreview({ src, title, fallback, priority = false }: {
  src?: string | null;
  title: string;
  fallback: string;
  priority?: boolean;
}) {
  const url = safeExternalWebUrl(src);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (!url || failedUrl === url) {
    return <div className="flex h-full w-full items-center justify-center text-sm text-faint">{fallback}</div>;
  }
  return (
    // biome-ignore lint/performance/noImgElement: external community previews use arbitrary hosts; browser decoding failures must display the fallback.
    <img
      src={url}
      alt={title}
      width={1280}
      height={720}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      onError={() => setFailedUrl(url)}
      ref={(image) => {
        // A cached failure can finish before React attaches the error handler.
        if (image?.complete && image.naturalWidth === 0) setFailedUrl(url);
      }}
      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
    />
  );
}
