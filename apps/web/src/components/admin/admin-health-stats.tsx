import { StatCard } from "@nexus/ui";
import { AlertTriangle, BookOpen, Box, Server, Users } from "lucide-react";
import type { getDictionary } from "../../lib/i18n";

type AdminCopy = ReturnType<typeof getDictionary>["admin"];

type HealthCounts = {
  users: number;
  servers: number;
  products: number;
  publishedContent: number;
  reportsOpen: number;
};

export function AdminHealthStats({ copy, counts }: { copy: AdminCopy; counts: HealthCounts }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
      <StatCard label={copy.users} value={counts.users} icon={<Users className="h-4 w-4" />} />
      <StatCard
        label={copy.servers}
        value={counts.servers}
        tone="success"
        icon={<Server className="h-4 w-4" />}
      />
      <StatCard
        label={copy.products}
        value={counts.products}
        tone="accent"
        icon={<Box className="h-4 w-4" />}
      />
      <StatCard
        label={copy.publishedContent}
        value={counts.publishedContent}
        tone="purple"
        icon={<BookOpen className="h-4 w-4" />}
      />
      <StatCard
        label={copy.openReports}
        value={counts.reportsOpen}
        tone="warning"
        icon={<AlertTriangle className="h-4 w-4" />}
      />
    </div>
  );
}
