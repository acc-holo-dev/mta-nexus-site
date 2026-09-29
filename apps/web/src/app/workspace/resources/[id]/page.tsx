import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buildRepository, organizationRepository, productRepository } from "@nexus/db";
import { can } from "@nexus/security";
import { StatusBadge } from "@nexus/ui";
import { authService } from "../../../../lib/services/auth-service";
import { ResourceBuildUploadForm } from "../../../../components/resource-build-upload-form";
import { ResourceDetailsForm } from "../../../../components/resource-details-form";

export const dynamic = "force-dynamic";

export default async function ManageResourcePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cookieStore = await cookies();
  const user = await authService.getSession(cookieStore.get("nexus_session")?.value);
  if (!user) notFound();

  const product = await productRepository.findById(id);
  if (!product) notFound();
  const organizationMemberships = product.organizationId
    ? await organizationRepository.listUserMemberships(user.id)
    : [];
  if (!can(user, "product.update", product, { organizationMemberships })) notFound();

  const builds = await buildRepository.listByProduct(product.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-primary">{product.title}</h1>
            <StatusBadge
              status={product.status}
              tone={product.status === "published" ? "success" : product.status === "suspended" ? "danger" : "warning"}
            />
          </div>
          <p className="font-caption text-muted mt-1">Resource publication and immutable build history.</p>
        </div>
        <Link href={`/market/${product.slug}`} className="text-xs font-semibold text-accent">
          Open preview
        </Link>
      </div>

      <ResourceDetailsForm product={product} />
      <ResourceBuildUploadForm productId={product.id} />

      <section className="space-y-3">
        <h2 className="font-heading text-primary">Build history</h2>
        {builds.length > 0 ? builds.map((build) => (
          <div key={build.id} className="nexus-panel p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-primary">Version {build.version}</div>
              <div className="font-caption text-faint">
                {build.fileName} · {(build.fileSizeBytes / 1024 / 1024).toFixed(1)} MB · scan {build.scanStatus.replace(/_/g, " ")}
              </div>
            </div>
            <StatusBadge
              status={build.status}
              tone={build.status === "published" ? "success" : build.status === "rejected" || build.status === "retired" ? "danger" : "warning"}
            />
          </div>
        )) : (
          <div className="nexus-panel p-8 text-center text-sm text-muted">No builds submitted yet.</div>
        )}
      </section>
    </div>
  );
}
