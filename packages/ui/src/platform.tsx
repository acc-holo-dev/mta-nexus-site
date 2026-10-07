import type * as React from "react";
import { cn } from "./utils";
import { withOccurrenceKeys } from "./list-keys";
import { ShieldCheck, BadgeCheck, CheckCircle2, Megaphone, Star } from "lucide-react";

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
}

export function SectionHeader({ title, description, action, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between border-b border-base pb-2.5 mb-4", className)}>
      <div>
        <h2 className="font-heading text-primary">{title}</h2>
        {description && <p className="font-caption text-muted mt-0.5">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
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
        className
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
        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-numeric font-bold uppercase border",
        STATUS_TONES[tone],
        className
      )}
    >
      {status}
    </span>
  );
}

/* ============================================================
   DataTable primitives — consistent table system (TASK-019)
   ============================================================ */
export function DataTable({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-left text-xs">{children}</table>
    </div>
  );
}

export function DataTableHeader({ columns }: { columns: string[] }) {
  return (
    <thead className="font-label text-faint uppercase border-b border-base">
      <tr>
        {withOccurrenceKeys(columns, (column) => column).map(({ key, item: col }, i) => (
          <th key={key} className={cn("py-2.5 pr-4", i === columns.length - 1 && "text-right pr-0")}>
            {col}
          </th>
        ))}
      </tr>
    </thead>
  );
}

export function DataTableBody({ children }: { children: React.ReactNode }) {
  return (
    <tbody className="divide-y divide-[color:var(--nexus-border)] font-numeric text-secondary">
      {children}
    </tbody>
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

