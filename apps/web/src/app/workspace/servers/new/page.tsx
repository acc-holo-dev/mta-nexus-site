"use client";

import { FormEvent, useState } from "react";

export default function RegisterServerPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(form.get("name") || ""),
          slug: String(form.get("slug") || ""),
          description: String(form.get("description") || ""),
          websiteUrl: String(form.get("websiteUrl") || ""),
          discordUrl: String(form.get("discordUrl") || ""),
          rulesUrl: String(form.get("rulesUrl") || ""),
          mediaUrls: String(form.get("mediaUrls") || "")
            .split(String.fromCharCode(10))
            .map((value) => value.trim())
            .filter(Boolean),
          language: String(form.get("language") || ""),
          region: String(form.get("region") || ""),
          gameplayTags: String(form.get("gameplayTags") || "")
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          ipAddress: String(form.get("ipAddress") || ""),
          port: Number(form.get("port") || 22003),
          httpPort: Number(form.get("httpPort") || 22005),
          maxPlayers: Number(form.get("maxPlayers") || 128),
          gameMode: String(form.get("gameMode") || ""),
          visibility: String(form.get("visibility") || "public"),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not register server");
      window.location.assign("/workspace/servers/" + data.server.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unexpected registration error");
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">Add a server listing</h1>
        <p className="text-sm text-neutral-400 mt-1">This creates a listing you can manage. Live MTA network data comes from the official master-list.</p>
      </div>
      {error && <div className="p-4 rounded-lg border border-red-900 bg-red-950/30 text-sm text-red-300">{error}</div>}
      <form onSubmit={submit} className="nexus-panel p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="space-y-1"><span className="text-xs text-neutral-300">Name</span><input name="name" required minLength={3} className="w-full nexus-inset px-3 py-2 text-sm" /></label>
        <label className="space-y-1"><span className="text-xs text-neutral-300">Slug</span><input name="slug" required pattern="[a-z0-9-]+" className="w-full nexus-inset px-3 py-2 text-sm" /></label>
        <label className="space-y-1 sm:col-span-2"><span className="text-xs text-neutral-300">Description</span><textarea name="description" rows={4} className="w-full nexus-inset px-3 py-2 text-sm" /></label>
        <label className="space-y-1"><span className="text-xs text-neutral-300">Website URL</span><input name="websiteUrl" type="url" placeholder="https://..." className="w-full nexus-inset px-3 py-2 text-sm" /></label>
        <label className="space-y-1"><span className="text-xs text-neutral-300">Discord URL</span><input name="discordUrl" type="url" placeholder="https://discord.gg/..." className="w-full nexus-inset px-3 py-2 text-sm" /></label>
        <label className="space-y-1"><span className="text-xs text-neutral-300">Rules URL</span><input name="rulesUrl" type="url" placeholder="https://..." className="w-full nexus-inset px-3 py-2 text-sm" /></label>
        <label className="space-y-1"><span className="text-xs text-neutral-300">Language</span><input name="language" maxLength={64} placeholder="English" className="w-full nexus-inset px-3 py-2 text-sm" /></label>
        <label className="space-y-1"><span className="text-xs text-neutral-300">Region</span><input name="region" maxLength={64} placeholder="Europe" className="w-full nexus-inset px-3 py-2 text-sm" /></label>
        <label className="space-y-1 sm:col-span-2"><span className="text-xs text-neutral-300">Gameplay tags</span><input name="gameplayTags" placeholder="roleplay, economy, freeroam" className="w-full nexus-inset px-3 py-2 text-sm" /></label>
        <label className="space-y-1 sm:col-span-2"><span className="text-xs text-neutral-300">Media URLs (one per line)</span><textarea name="mediaUrls" rows={3} placeholder="https://..." className="w-full nexus-inset px-3 py-2 text-sm" /></label>
        <label className="space-y-1"><span className="text-xs text-neutral-300">IP address or hostname</span><input name="ipAddress" required className="w-full nexus-inset px-3 py-2 text-sm" /></label>
        <label className="space-y-1"><span className="text-xs text-neutral-300">Game mode</span><input name="gameMode" className="w-full nexus-inset px-3 py-2 text-sm" /></label>
        <label className="space-y-1"><span className="text-xs text-neutral-300">Game port</span><input name="port" type="number" min={1} max={65535} defaultValue={22003} className="w-full nexus-inset px-3 py-2 text-sm" /></label>
        <label className="space-y-1"><span className="text-xs text-neutral-300">HTTP port</span><input name="httpPort" type="number" min={1} max={65535} defaultValue={22005} className="w-full nexus-inset px-3 py-2 text-sm" /></label>
        <label className="space-y-1"><span className="text-xs text-neutral-300">Maximum players</span><input name="maxPlayers" type="number" min={1} max={4096} defaultValue={128} className="w-full nexus-inset px-3 py-2 text-sm" /></label>
        <label className="space-y-1"><span className="text-xs text-neutral-300">Visibility</span><select name="visibility" defaultValue="public" className="w-full nexus-inset px-3 py-2 text-sm"><option value="public">Public</option><option value="unlisted">Unlisted</option><option value="private">Private</option></select></label>
        <button type="submit" disabled={loading} className="sm:col-span-2 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold">{loading ? "Creating listing..." : "Create listing"}</button>
      </form>
    </div>
  );
}
