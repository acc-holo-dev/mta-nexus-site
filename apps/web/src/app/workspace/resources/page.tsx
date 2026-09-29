import { cookies } from "next/headers";
import Link from "next/link";
import { productRepository } from "@nexus/db";
import { StatusBadge } from "@nexus/ui";
import { authService } from "../../../lib/services/auth-service";

export const dynamic = "force-dynamic";

export default async function CreatorResourcesPage() {
  const cookieStore = await cookies();
  const user = await authService.getSession(cookieStore.get("nexus_session")?.value);

  if (!user) {
    return (
      <div className="max-w-md mx-auto py-20 text-center space-y-4">
        <h1 className="font-display text-primary">Sign in required</h1>
        <Link href="/auth/login" className="text-sm font-semibold text-accent">Sign in</Link>
      </div>
    );
  }

  const resources = await productRepository.listByAuthor(user.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-primary">Your resources</h1>
          <p className="font-caption text-muted mt-1">Drafts, review state and published releases.</p>
        </div>
        <Link href="/workspace/resources/new" className="rounded-md bg-accent px-4 py-2 text-xs font-semibold text-white">
          Create resource
        </Link>
      </div>

      {resources.length > 0 ? (
        <div className="space-y-3">
          {resources.map((resource) => (
            <div key={resource.id} className="nexus-panel p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-primary truncate">{resource.title}</div>
                <div className="font-caption text-faint">Current version: {resource.currentVersion}</div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge
                  status={resource.status}
                  tone={resource.status === "published" ? "success" : resource.status === "suspended" ? "danger" : "warning"}
                />
                <Link href={`/workspace/resources/${resource.id}`} className="text-xs font-semibold text-accent">
                  Manage
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="nexus-panel p-10 text-center text-sm text-muted">
          You have not created a resource yet.
        </div>
      )}
    </div>
  );
}
