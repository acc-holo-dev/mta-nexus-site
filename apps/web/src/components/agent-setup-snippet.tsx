"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";

export function AgentSetupSnippet({ apiKey }: { apiKey: string }) {
  const [endpoint, setEndpoint] = useState("https://nexus-mta.com/api/server/installations/heartbeat");
  const [copied, setCopied] = useState<"key" | "config" | null>(null);

  useEffect(() => {
    setEndpoint(window.location.origin + "/api/server/installations/heartbeat");
  }, []);

  const config = useMemo(
    () => `NEXUS_ENDPOINT = "${endpoint}"\nNEXUS_API_KEY = "${apiKey}"\nNEXUS_HEARTBEAT_INTERVAL_MS = 60000`,
    [apiKey, endpoint]
  );

  async function copy(value: string, kind: "key" | "config") {
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1600);
  }

  return (
    <div className="nexus-inset p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-neutral-400">Paste into <code>resources/mta-nexus-agent/config.lua</code></div>
        <button
          type="button"
          onClick={() => copy(config, "config")}
          className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
        >
          {copied === "config" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied === "config" ? "Copied" : "Copy config"}
        </button>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap break-all text-xs leading-5 text-emerald-400">{config}</pre>
      <button
        type="button"
        onClick={() => copy(apiKey, "key")}
        className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-white"
      >
        {copied === "key" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        {copied === "key" ? "Key copied" : "Copy key only"}
      </button>
    </div>
  );
}
