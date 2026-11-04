import { BadgeCheck, CheckCircle2, Megaphone, ShieldCheck, Star } from "lucide-react";
import type * as React from "react";
import { withOccurrenceKeys } from "./list-keys";
import { cn } from "./utils";

/* ============================================================
   PageHeader — page identity, context and primary actions
   ============================================================ */
export interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  titleId?: string;
}

export function PageHeader({
  title,
  description,
  icon,
  action,
  className,
  titleId,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col justify-between gap-4 border-b border-base pb-6 md:flex-row md:items-start",
        className,
      )}
    >
      <div className="min-w-0 max-w-3xl">
        <h1
          id={titleId}
          className="flex items-start gap-2.5 break-words text-2xl font-extrabold text-primary sm:text-3xl"
        >
          {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
          <span className="min-w-0">{title}</span>
        </h1>
        {description && (
          <p className="mt-1 break-words text-sm leading-relaxed text-muted">{description}</p>
        )}
      </div>
      {action && <div className="flex max-w-full flex-wrap gap-4 md:justify-end">{action}</div>}
    </header>
  );
}

/* ============================================================
   StatCard — unified dashboard metric card (TASK-018)
   ============================================================ */
export interface StatCardProps {
  label: string;
  value: string | number;
  context?: string;
  tone?: "default" | "success" | "warning" | "accent" | "purple";
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export function StatCard({ label, value, context, tone = "default", icon, action }: StatCardProps) {
  const tones = {
    default: "text-primary",
    success: "text-success",
    warning: "text-warning",
    accent: "text-accent",
    purple: "text-purple",
  };

  return (
    <div className="nexus-panel p-4 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="font-label text-muted uppercase">{label}</span>
        {icon && (
          <span className="text-muted" aria-hidden="true">
            {icon}
          </span>
        )}
      </div>
      <div className={cn("font-numeric text-2xl font-bold", tones[tone])}>{value}</div>
      <div className="flex items-center justify-between gap-2">
        {context && <span className="font-caption text-faint">{context}</span>}
        {action}
      </div>
    </div>
  );
}

/* ============================================================
   SectionHeader — consistent section title with optional action
   ============================================================ */
export interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  titleId?: string;
}

export function SectionHeader({
  title,
  description,
  action,
  className,
  titleId,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "mb-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-2 border-b border-base pb-2.5",
        className,
      )}
    >
      <div className="min-w-0 max-w-full flex-1">
        <h2 id={titleId} className="break-words font-heading text-primary">
          {title}
        </h2>
        {description && <p className="mt-0.5 break-words font-caption text-muted">{description}</p>}
      </div>
      {action && <div className="max-w-full shrink-0">{action}</div>}
    </div>
  );
}

/* ============================================================
   TrustBadge — unified trust language (TASK-022)
   One badge system for the whole platform.
   ============================================================ */
export type TrustBadgeVariant =
  | "verified"
  | "verifiedPurchase"
  | "verifiedDeveloper"
  | "verifiedServer"
  | "official"
  | "sponsored"
  | "featured";

export interface TrustBadgeProps {
  variant: TrustBadgeVariant;
  label?: string;
  className?: string;
}

const TRUST_CONFIG: Record<
  TrustBadgeVariant,
  { label: string; icon: React.ComponentType<{ className?: string }>; css: string }
> = {
  verified: {
    label: "Verified",
    icon: BadgeCheck,
    css: "bg-accent-soft text-accent border-[color:var(--nexus-accent)]/20",
  },
  verifiedPurchase: {
    label: "Verified Purchase",
    icon: CheckCircle2,
    css: "bg-success-soft text-success border-[color:var(--nexus-success)]/20",
  },
  verifiedDeveloper: {
    label: "Verified Developer",
    icon: BadgeCheck,
    css: "bg-purple-soft text-purple border-[color:var(--nexus-purple)]/20",
  },
  verifiedServer: {
    label: "Verified Server",
    icon: ShieldCheck,
    css: "bg-success-soft text-success border-[color:var(--nexus-success)]/20",
  },
  official: {
    label: "Official",
    icon: ShieldCheck,
    css: "bg-accent-soft text-accent border-[color:var(--nexus-accent)]/20",
  },
  sponsored: {
    label: "Sponsored",
    icon: Megaphone,
    css: "bg-warning-soft text-warning border-[color:var(--nexus-warning)]/20",
  },
  featured: {
    label: "Featured",
    icon: Star,
    css: "bg-warning-soft text-warning border-[color:var(--nexus-warning)]/20",
  },
};

export function TrustBadge({ variant, label, className }: TrustBadgeProps) {
  const config = TRUST_CONFIG[variant];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border",
        config.css,
        className,
      )}
    >
      <Icon className="w-3 h-3" aria-hidden="true" />
      <span>{label ?? config.label}</span>
    </span>
  );
}

/* ============================================================
   StatusBadge — unified status label (orders, licenses, builds)
   ============================================================ */
export type StatusTone = "active" | "success" | "warning" | "danger" | "neutral";

export interface StatusBadgeProps {
  status: string;
  tone?: StatusTone;
  className?: string;
}

const STATUS_TONES: Record<StatusTone, string> = {
  active: "bg-success-soft text-success border-[color:var(--nexus-success)]/20",
  success: "bg-success-soft text-success border-[color:var(--nexus-success)]/20",
  warning: "bg-warning-soft text-warning border-[color:var(--nexus-warning)]/20",
  danger: "bg-danger-soft text-danger border-[color:var(--nexus-danger)]/20",
  neutral: "bg-inset text-secondary border-base",
};

export function StatusBadge({ status, tone = "neutral", className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
        STATUS_TONES[tone],
        className,
      )}
    >
      {status}
    </span>
  );
}

/* ============================================================
   DataTable primitives — consistent table system (TASK-019)
   ============================================================ */
export type DataTableColumnAlign = "start" | "end" | "center";
export type DataTableColumnType = "text" | "numeric" | "code" | "datetime";

export type DataTableColumn = {
  label: string;
  align?: DataTableColumnAlign;
  type?: DataTableColumnType;
};

const COLUMN_ALIGN: Record<DataTableColumnAlign, string> = {
  start: "text-left",
  end: "text-right",
  center: "text-center",
};

const COLUMN_TYPE: Record<DataTableColumnType, string> = {
  text: "font-caption break-words",
  numeric: "font-numeric tabular-nums whitespace-nowrap",
  code: "font-code break-all",
  datetime: "font-caption whitespace-nowrap",
};

function normalizeColumns(columns: Array<string | DataTableColumn>): DataTableColumn[] {
  return columns.map((column, index) => {
    if (typeof column === "string") {
      return {
        label: column,
        align: index === columns.length - 1 ? "end" : "start",
        type: "text",
      };
    }
    return {
      label: column.label,
      align: column.align ?? (column.type === "numeric" ? "end" : "start"),
      type: column.type ?? "text",
    };
  });
}

export function DataTable({
  children,
  className,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  /** Accessible name for the keyboard-focusable overflow region. */
  label?: string;
}) {
  return (
    <section
      aria-label={label}
      tabIndex={label ? 0 : undefined}
      className={cn(
        "max-w-full overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--nexus-accent)]",
        className,
      )}
    >
      <table className="w-full min-w-0 text-left text-xs">{children}</table>
    </section>
  );
}

export function DataTableHeader({ columns }: { columns: Array<string | DataTableColumn> }) {
  const normalized = normalizeColumns(columns);
  return (
    <thead className="border-b border-base font-label uppercase text-faint">
      <tr>
        {withOccurrenceKeys(normalized, (column) => column.label).map(
          ({ key, item: column }, index) => (
            <th
              key={key}
              scope="col"
              className={cn(
                "py-2.5 pr-4 align-bottom",
                COLUMN_ALIGN[column.align ?? "start"],
                index === normalized.length - 1 && "pr-0",
              )}
            >
              {column.label}
            </th>
          ),
        )}
      </tr>
    </thead>
  );
}

export function DataTableBody({ children }: { children: React.ReactNode }) {
  return (
    <tbody className="divide-y divide-[color:var(--nexus-border)] text-secondary">{children}</tbody>
  );
}

export function DataTableCell({
  children,
  type = "text",
  align,
  className,
  scope,
}: {
  children: React.ReactNode;
  type?: DataTableColumnType;
  align?: DataTableColumnAlign;
  className?: string;
  scope?: "row";
}) {
  const resolvedAlign = align ?? (type === "numeric" ? "end" : "start");
  const Tag = scope === "row" ? "th" : "td";
  return (
    <Tag
      scope={scope}
      className={cn(
        "max-w-[18rem] py-2.5 pr-4 align-top",
        COLUMN_ALIGN[resolvedAlign],
        COLUMN_TYPE[type],
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function DataTableEmpty({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-6 text-center font-caption text-muted">
        {message}
      </td>
    </tr>
  );
}
