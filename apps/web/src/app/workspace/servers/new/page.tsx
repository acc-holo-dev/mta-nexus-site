"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

type CreatedInstallation = {
  serverId: string;
  apiKey: string;
  moduleVersion: string;
  warning: string;
};

export default function RegisterServerPage() {
  const [loading, setLoading] = useState(false);
  const [installation, setInstallation] = useState<CreatedInstallation | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") || ""),
      slug: String(form.get("slug") || ""),
      description: String(form.get("description") || ""),
      ipAddress: String(form.get("ipAddress") || ""),
      port: Number(form.get("port") || 22003),
      httpPort: Number(form.get("httpPort") || 22005),
      maxPlayers: Number(form.get("maxPlayers") || 128),
      gameMode: String(form.get("gameMode") || ""),
      visibility: String(form.get("visibility") || "public"),
    };

    try {
      const serverResponse = await fetch("/api/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const serverData = await serverResponse.json();
      if (!serverResponse.ok) {
        throw new Error(serverData.error || "Could not register server");
      }

      const installationResponse = await fetch(
        `/api/servers/${serverData.server.id}/installations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ moduleVersion: "1.0.0" }),
        }
      );
      const installationData = await installationResponse.json();
      if (!installationResponse.ok) {
        throw new Error(
          installationData.error ||
            "Server was created, but the installation key could not be generated"
        );
      }

      setInstallation(installationData);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unexpected registration error");
    } finally {
      setLoading(false);
    }
  }

  if (installation) {
    return (
      <div className="max-w-2xl mx-auto py-10 space-y-6">
        <div className="nexus-panel p-6 space-y-4">
          <h1 className="text-2xl font-black text-white">Server registered</h1>
          <p className="text-sm text-amber-300">{installation.warning}</p>
          <div className="nexus-inset p-4 space-y-2">
            <div className="text-xs text-neutral-400">Heartbeat API key</div>
            <code className="block text-sm text-emerald-400 break-all select-all">
              {installation.apiKey}
            </code>
          </div>
          <p className="text-xs text-neutral-400">
            Configure your MTA resource to send heartbeats to
            <code className="ml-1 text-neutral-200">
              /api/server/installations/heartbeat
            </code>
            . The server appears publicly only after a fresh authenticated heartbeat.
          </p>
          <Link href="/workspace" className="inline-block text-sm font-semibold text-accent">
            Return to workspace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">Register an MTA server</h1>
        <p className="text-sm text-neutral-400 mt-1">
          The server stays offline until its first authenticated heartbeat.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-lg border border-red-900 bg-red-950/30 text-sm text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={submit} className="nexus-panel p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="space-y-1">
          <span className="text-xs text-neutral-300">Name</span>
          <input name="name" required minLength={3} className="w-full nexus-inset px-3 py-2 text-sm" />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-neutral-300">Slug</span>
          <input name="slug" required pattern="[a-z0-9-]+" className="w-full nexus-inset px-3 py-2 text-sm" />
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className="text-xs text-neutral-300">Description</span>
          <textarea name="description" rows={4} className="w-full nexus-inset px-3 py-2 text-sm" />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-neutral-300">IP address or hostname</span>
          <input name="ipAddress" required className="w-full nexus-inset px-3 py-2 text-sm" />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-neutral-300">Game mode</span>
          <input name="gameMode" className="w-full nexus-inset px-3 py-2 text-sm" />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-neutral-300">Game port</span>
          <input name="port" type="number" min={1} max={65535} defaultValue={22003} className="w-full nexus-inset px-3 py-2 text-sm" />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-neutral-300">HTTP port</span>
          <input name="httpPort" type="number" min={1} max={65535} defaultValue={22005} className="w-full nexus-inset px-3 py-2 text-sm" />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-neutral-300">Maximum players</span>
          <input name="maxPlayers" type="number" min={1} max={4096} defaultValue={128} className="w-full nexus-inset px-3 py-2 text-sm" />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-neutral-300">Visibility</span>
          <select name="visibility" defaultValue="public" className="w-full nexus-inset px-3 py-2 text-sm">
            <option value="public">Public</option>
            <option value="unlisted">Unlisted</option>
            <option value="private">Private</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={loading}
          className="sm:col-span-2 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold"
        >
          {loading ? "Registering..." : "Register server and create key"}
        </button>
      </form>
    </div>
  );
}
