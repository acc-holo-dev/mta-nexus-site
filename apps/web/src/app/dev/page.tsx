import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { notFound } from "next/navigation";
import {
  Database,
  Globe2,
  HardDrive,
  Mail,
  ScanLine,
  TerminalSquare,
} from "lucide-react";
import { config } from "@nexus/config";
import { checkDatabaseConnection } from "@nexus/db";
import { SectionHeader, StatCard, StatusBadge } from "@nexus/ui";
import packageMetadata from "../../../../../package.json";
import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function DevelopmentStatusPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const locale = await getRequestLocale();
  const copy = getDictionary(locale).dev;

  let databaseReachable = false;
  try {
    await checkDatabaseConnection();
    databaseReachable = true;
  } catch {
    databaseReachable = false;
  }

  let storageStatus = copy.configured;
  let storageHealthy = true;
  if (config.STORAGE_PROVIDER === "local") {
    try {
      await access(
        config.STORAGE_LOCAL_PATH,
        constants.R_OK | constants.W_OK,
      );
      storageStatus = copy.writable;
    } catch {
      storageStatus = copy.unavailable;
      storageHealthy = false;
    }
  }

  const scannerStatus =
    config.BUILD_SCANNER === "disabled" ? copy.disabled : copy.configured;
  const emailStatus =
    config.EMAIL_PROVIDER === "disabled" ? copy.disabled : copy.configured;

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-2.5 font-display text-primary">
            <TerminalSquare className="h-6 w-6 text-accent" aria-hidden="true" />
            <span>{copy.title}</span>
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            {copy.description}
          </p>
        </div>
        <StatusBadge status={copy.localOnly} tone="warning" />
      </div>

      <section>
        <SectionHeader title={copy.environment} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label={copy.environment}
            value={config.NODE_ENV}
            tone="accent"
            icon={<TerminalSquare className="h-4 w-4" />}
          />
          <StatCard
            label={copy.version}
            value={packageMetadata.version}
            icon={<TerminalSquare className="h-4 w-4" />}
          />
          <StatCard
            label={copy.database}
            value={databaseReachable ? copy.reachable : copy.unavailable}
            tone={databaseReachable ? "success" : "warning"}
            icon={<Database className="h-4 w-4" />}
          />
          <StatCard
            label={copy.storage}
            value={storageStatus}
            tone={storageHealthy ? "success" : "warning"}
            icon={<HardDrive className="h-4 w-4" />}
          />
          <StatCard
            label={copy.scanner}
            value={scannerStatus}
            tone={config.BUILD_SCANNER === "disabled" ? "warning" : "success"}
            icon={<ScanLine className="h-4 w-4" />}
          />
          <StatCard
            label={copy.email}
            value={emailStatus}
            tone={config.EMAIL_PROVIDER === "disabled" ? "warning" : "success"}
            icon={<Mail className="h-4 w-4" />}
          />
        </div>
      </section>

      <section className="nexus-panel p-5">
        <div className="flex items-center gap-2 text-sm text-secondary">
          <Globe2 className="h-4 w-4 text-accent" aria-hidden="true" />
          <span className="font-semibold text-primary">{copy.appUrl}:</span>
          <a
            href={config.NEXT_PUBLIC_APP_URL}
            className="truncate text-accent hover:underline"
          >
            {config.NEXT_PUBLIC_APP_URL}
          </a>
        </div>
      </section>
    </div>
  );
}
