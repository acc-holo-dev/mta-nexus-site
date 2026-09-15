import * as React from "react";
import { cn } from "./utils";

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  fallback: string;
  size?: "sm" | "md" | "lg";
}

export function Avatar({ src, alt, fallback, size = "md", className, ...props }: AvatarProps) {
  const [imageFailed, setImageFailed] = React.useState(false);

  const sizes = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-14 h-14 text-base",
  };

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center rounded-full bg-neutral-800 border border-neutral-700 overflow-hidden font-semibold text-neutral-200 select-none",
        sizes[size],
        className
      )}
      {...props}
    >
      {src && !imageFailed ? (
        <img
          src={src}
          alt={alt || fallback}
          onError={() => setImageFailed(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <span>{fallback.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
}
