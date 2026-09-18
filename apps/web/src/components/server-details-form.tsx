"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type EditableServer = {
  id: string;
  name: string;
  description?: string;
  websiteUrl?: string;
  discordUrl?: string;
  rulesUrl?: string;
  mediaUrls?: string[];
  language?: string;
  region?: string;
  gameplayTags?: string[];
  ipAddress: string;
  port: number;
  gameMode?: string;
  maxPlayers?: number;
  visibility: "public" | "unlisted" | "private";
};

export function ServerDetailsForm({ server }: { server: EditableServer }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/servers/" + server.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(form.get("name") || ""),
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
          port: Number(form.get("port")),
          gameMode: String(form.get("gameMode") || ""),
          maxPlayers: Number(form.get("maxPlayers")),
          visibility: String(form.get("visibility") || "private"),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save server details");

      setMessage("Saved.");
      router.refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unexpected save error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <label className="space-y-1"><span className="text-xs text-neutral-300">Name</span><input name="name" defaultValue={server.name} required className="w-full nexus-inset px-3 py-2 text-sm" /></label>
      <label className="space-y-1"><span className="text-xs text-neutral-300">Visibility</span><select name="visibility" defaultValue={server.visibility} className="w-full nexus-inset px-3 py-2 text-sm"><option value="public">Public</option><option value="unlisted">Unlisted</option><option value="private">Private</option></select></label>
      <label className="space-y-1 sm:col-span-2"><span className="text-xs text-neutral-300">Description</span><textarea name="description" defaultValue={server.description || ""} rows={4} className="w-full nexus-inset px-3 py-2 text-sm" /></label>
      <label className="space-y-1"><span className="text-xs text-neutral-300">Website URL</span><input name="websiteUrl" type="url" defaultValue={server.websiteUrl || ""} placeholder="https://..." className="w-full nexus-inset px-3 py-2 text-sm" /></label>
      <label className="space-y-1"><span className="text-xs text-neutral-300">Discord URL</span><input name="discordUrl" type="url" defaultValue={server.discordUrl || ""} placeholder="https://discord.gg/..." className="w-full nexus-inset px-3 py-2 text-sm" /></label>
      <label className="space-y-1"><span className="text-xs text-neutral-300">Rules URL</span><input name="rulesUrl" type="url" defaultValue={server.rulesUrl || ""} placeholder="https://..." className="w-full nexus-inset px-3 py-2 text-sm" /></label>
      <label className="space-y-1"><span className="text-xs text-neutral-300">Language</span><input name="language" maxLength={64} defaultValue={server.language || ""} placeholder="English" className="w-full nexus-inset px-3 py-2 text-sm" /></label>
      <label className="space-y-1"><span className="text-xs text-neutral-300">Region</span><input name="region" maxLength={64} defaultValue={server.region || ""} placeholder="Europe" className="w-full nexus-inset px-3 py-2 text-sm" /></label>
      <label className="space-y-1 sm:col-span-2"><span className="text-xs text-neutral-300">Gameplay tags</span><input name="gameplayTags" defaultValue={(server.gameplayTags || []).join(", ")} placeholder="roleplay, economy, freeroam" className="w-full nexus-inset px-3 py-2 text-sm" /></label>
      <label className="space-y-1 sm:col-span-2"><span className="text-xs text-neutral-300">Media URLs (one per line)</span><textarea name="mediaUrls" defaultValue={(server.mediaUrls || []).join(String.fromCharCode(10))} rows={3} placeholder="https://..." className="w-full nexus-inset px-3 py-2 text-sm" /></label>
      <label className="space-y-1"><span className="text-xs text-neutral-300">IP address or hostname</span><input name="ipAddress" defaultValue={server.ipAddress} required className="w-full nexus-inset px-3 py-2 text-sm" /></label>
      <label className="space-y-1"><span className="text-xs text-neutral-300">Game port</span><input name="port" type="number" min={1} max={65535} defaultValue={server.port} required className="w-full nexus-inset px-3 py-2 text-sm" /></label>
      <label className="space-y-1"><span className="text-xs text-neutral-300">Game mode</span><input name="gameMode" defaultValue={server.gameMode || ""} className="w-full nexus-inset px-3 py-2 text-sm" /></label>
      <label className="space-y-1"><span className="text-xs text-neutral-300">Maximum players</span><input name="maxPlayers" type="number" min={1} max={4096} defaultValue={server.maxPlayers} required className="w-full nexus-inset px-3 py-2 text-sm" /></label>
      <div className="sm:col-span-2 flex items-center gap-3">
        <button disabled={loading} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold">{loading ? "Saving..." : "Save details"}</button>
        {message && <span className="text-xs text-neutral-400">{message}</span>}
      </div>
    </form>
  );
}
