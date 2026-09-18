import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { Server } from "lucide-react";
import { authService } from "../../../../lib/services/auth-service";
import { serverService } from "../../../../lib/services/server-service";
import { ServerDetailsForm } from "../../../../components/server-details-form";

export const dynamic = "force-dynamic";

export default async function ServerManagementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = (await cookies()).get("nexus_session")?.value;
  const user = await authService.getSession(token);

  if (!user) {
    return (
      <div className="max-w-md mx-auto py-20 text-center space-y-4">
        <h1 className="font-display text-primary">Sign in required</h1>
        <p className="font-caption text-muted">Sign in to manage this server.</p>
        <Link href="/auth/login" className="inline-block px-4 py-2 rounded-md bg-accent text-white text-xs font-semibold">Sign in</Link>
      </div>
    );
  }

  const server = await serverService.getServerById(id);
  if (!server || (server.ownerId !== user.id && user.role !== "admin")) notFound();

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/workspace" className="text-xs font-semibold text-accent">← Workspace</Link>
          <h1 className="mt-2 text-2xl font-black text-white">{server.name}</h1>
          <p className="mt-1 text-sm text-neutral-400 font-mono">{server.ipAddress}:{server.port}</p>
        </div>
      </div>

      <div className="nexus-panel p-4 flex items-center gap-3">
        <Server className="w-5 h-5 text-emerald-400" />
        <p className="text-sm text-neutral-300">This is an owner-managed listing. Public MTA availability is sourced independently from the official MTA master-list.</p>
      </div>

      <section className="nexus-panel p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-white">Listing details</h2>
          <p className="mt-1 text-sm text-neutral-400">Keep the name, address, mode and description accurate for your community.</p>
        </div>
        <ServerDetailsForm server={server} />
      </section>
    </div>
  );
}
