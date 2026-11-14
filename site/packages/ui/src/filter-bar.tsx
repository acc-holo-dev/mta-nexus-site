import type * as React from "react";
import { cn } from "./utils";

export interface FilterBarProps extends Omit<React.FormHTMLAttributes<HTMLFormElement>, "method"> {
  label: string;
  layout?: "row" | "stacked";
  method?: "get";
}

/** Search landmark and GET form chrome for URL-backed catalog filters. */
export function FilterBar({
  label,
  layout = "row",
  className,
  children,
  method = "get",
  ...props
}: FilterBarProps) {
  return (
    <search aria-label={label}>
      <form
        {...props}
        method={method}
        className={cn(
          "nexus-panel p-4",
          layout === "row" ? "flex flex-wrap items-end gap-3" : "space-y-4",
          className,
        )}
      >
        {children}
      </form>
    </search>
  );
}
