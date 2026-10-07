"use client";

import * as React from "react";
import { cn } from "./utils";

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  fallback: string;
  size?: "sm" | "md" | "lg";
}

export function Avatar({
  src,
  alt,
  fallback,
  size = "md",
  className,
  ...props
}: AvatarProps) {
  const [imageFailed, setImageFailed] = React.useState(false);

  const sizes = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-14 w-14 text-base",
  };

  return (
    <div
      role={!src || imageFailed ? "img" : undefined}
      aria-label={!src || imageFailed ? alt || fallback : undefined}
      className={cn(
        "relative inline-flex select-none items-center justify-center overflow-hidden rounded-full border border-base bg-inset font-semibold text-secondary",
        sizes[size],
        className,
      )}
      {...props}
    >
      {src && !imageFailed ? (
        <img
          src={src}
          alt={alt || fallback}
          onError={() => setImageFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span aria-hidden="true">
          {fallback.slice(0, 2).toUpperCase()}
        </span>
      )}
    </div>
  );
}
