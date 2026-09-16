"use client";

import { useState } from "react";

type InstallationResponse = {
  apiKey: string;
  warning: string;
};

export function InstallationKeyRotation({ serverId }: { serverId: string }) {
  const [loading, setLoading] = useState(false);
  const [installation, setInstallation] = useState<InstallationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function rotateKey() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/servers/" + serverId + "/installations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleVersion: "0.1.0" }),
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Could not create installation key");
      setInstallation(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unexpected installation error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {installation ? (
        <div className="nexus-inset p-4 space-y-2">
          <div className="text-xs text-amber-300">{installation.warning}</div>
          <code className="block text-sm text-emerald-400 break-all select-all">{installation.apiKey}</code>
          <div className="text-xs text-neutral-500">Copy it into resources/mta-nexus-agent/config.lua on the MTA server.</div>
        </div>
      ) : (
        <button
          type="button"
          onClick={rotateKey}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-bold"
        >
          {loading ? "Creating key..." : "Create or rotate installation key"}
        </button>
      )}
      {error && <div className="text-sm text-red-300">{error}</div>}
    </div>
  );
}
