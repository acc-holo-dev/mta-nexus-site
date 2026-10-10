"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@nexus/ui";
import { confirmedUpdatedServer } from "../lib/server-mutation-confirmation";
import { privateApiRequest } from "../lib/private-api-request";
import { useNexusLocale } from "./locale-context";

type EditableServer = {
  id: string;
  name: string;
  updatedAt?: Date | string;
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
  httpPort?: number | null;
  gameMode?: string;
  mapName?: string | null;
  maxPlayers?: number;
  visibility: "public" | "unlisted" | "private";
};

type Notice = {
  text: string;
  error: boolean;
};

function revisionToken(value: Date | string | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

const fieldClass =
  "w-full rounded-lg border border-base bg-inset px-3 py-2 text-sm text-primary outline-none transition-colors placeholder:text-[color:var(--nexus-text-faint)] hover:border-strong focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)]";

export function ServerDetailsForm({ server }: { server: EditableServer }) {
  const router = useRouter();
  const { dictionary } = useNexusLocale();
  const copy = dictionary.serverManagement;
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState(() => revisionToken(server.updatedAt));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setNotice(null);
    const form = new FormData(event.currentTarget);

    try {
      const command = {
        name: String(form.get("name") || "").trim(),
        description: String(form.get("description") || "").trim(),
        websiteUrl: String(form.get("websiteUrl") || "").trim(),
        discordUrl: String(form.get("discordUrl") || "").trim(),
        rulesUrl: String(form.get("rulesUrl") || "").trim(),
        mediaUrls: String(form.get("mediaUrls") || "")
          .split("\n")
          .map((value) => value.trim())
          .filter(Boolean),
        language: String(form.get("language") || "").trim(),
        region: String(form.get("region") || "").trim(),
        gameplayTags: String(form.get("gameplayTags") || "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        ipAddress: String(form.get("ipAddress") || "").trim(),
        port: Number(form.get("port")),
        httpPort: Number(form.get("httpPort")),
        gameMode: String(form.get("gameMode") || "").trim(),
        mapName: String(form.get("mapName") || "").trim(),
        maxPlayers: Number(form.get("maxPlayers")),
        visibility: String(form.get("visibility") || "private"),
        ...(lastSavedAt ? { expectedUpdatedAt: lastSavedAt } : {}),
      };
      const response = await fetch(
        `/api/servers/${encodeURIComponent(server.id)}`,
        privateApiRequest({
          method: "PATCH",
          json: command,
          timeoutMs: 15_000,
        }),
      );
      const data = await response.json().catch(() => null);
      if (data?.code === "SERVER_METADATA_CONFLICT") {
        throw new Error(copy.concurrentEdit);
      }
      if (
        !confirmedUpdatedServer(response.status, data, {
          id: server.id,
          name: command.name,
          ipAddress: command.ipAddress,
          port: command.port,
          httpPort: command.httpPort,
          mapName: command.mapName,
          visibility: command.visibility,
        })
      ) {
        throw new Error(data?.error || copy.saveError);
      }

      setLastSavedAt(revisionToken(data?.server?.updatedAt));
      setNotice({ text: copy.saved, error: false });
      router.refresh();
    } catch (caught) {
      setNotice({
        error: true,
        text:
          caught instanceof Error && caught.message
            ? caught.message
            : copy.unexpectedSaveError,
      });
    } finally {
      setLoading(false);
    }
  }

  const field = (
    name: string,
    label: string,
    defaultValue: string | number,
    options?: {
      type?: string;
      required?: boolean;
      min?: number;
      max?: number;
      minLength?: number;
      maxLength?: number;
      placeholder?: string;
    },
  ) => (
    <label className="space-y-1.5">
      <span className="font-label text-secondary">{label}</span>
      <input
        name={name}
        type={options?.type}
        defaultValue={defaultValue}
        required={options?.required}
        min={options?.min}
        max={options?.max}
        minLength={options?.minLength}
        maxLength={options?.maxLength}
        placeholder={options?.placeholder}
        className={fieldClass}
      />
    </label>
  );

  return (
    <form
      onSubmit={submit}
      aria-busy={loading}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2"
    >
      {field("name", copy.name, server.name, { required: true, minLength: 3, maxLength: 100 })}

      <label className="space-y-1.5">
        <span className="font-label text-secondary">{copy.visibility}</span>
        <select
          name="visibility"
          defaultValue={server.visibility}
          className={fieldClass}
        >
          <option value="public">{copy.public}</option>
          <option value="unlisted">{copy.unlisted}</option>
          <option value="private">{copy.private}</option>
        </select>
      </label>

      <label className="space-y-1.5 sm:col-span-2">
        <span className="font-label text-secondary">{copy.description}</span>
        <textarea
          name="description"
          defaultValue={server.description || ""}
          rows={4}
          maxLength={5000}
          className={fieldClass}
        />
      </label>

      {field("websiteUrl", copy.websiteUrl, server.websiteUrl || "", {
        type: "url",
        placeholder: "https://...",
      })}
      {field("discordUrl", copy.discordUrl, server.discordUrl || "", {
        type: "url",
        placeholder: "https://discord.gg/...",
      })}
      {field("rulesUrl", copy.rulesUrl, server.rulesUrl || "", {
        type: "url",
        placeholder: "https://...",
      })}
      {field("language", copy.language, server.language || "", { maxLength: 64 })}
      {field("region", copy.region, server.region || "", { maxLength: 64 })}

      <label className="space-y-1.5 sm:col-span-2">
        <span className="font-label text-secondary">{copy.gameplayTags}</span>
        <input
          name="gameplayTags"
          maxLength={500}
          defaultValue={(server.gameplayTags || []).join(", ")}
          placeholder="roleplay, economy, freeroam"
          className={fieldClass}
        />
      </label>

      <label className="space-y-1.5 sm:col-span-2">
        <span className="font-label text-secondary">{copy.mediaUrls}</span>
        <textarea
          name="mediaUrls"
          maxLength={4007}
          defaultValue={(server.mediaUrls || []).join("\n")}
          rows={3}
          placeholder="https://..."
          className={fieldClass}
        />
      </label>

      {field("ipAddress", copy.ipAddress, server.ipAddress, {
        required: true,
      })}
      {field("port", copy.gamePort, server.port, {
        type: "number",
        required: true,
        min: 1,
        max: 65535,
      })}
      {field("httpPort", copy.httpPort, server.httpPort ?? 22005, {
        type: "number",
        required: true,
        min: 1,
        max: 65535,
      })}
      {field("gameMode", copy.gameMode, server.gameMode || "", { maxLength: 64 })}
      {field("mapName", copy.mapName, server.mapName || "", { maxLength: 64 })}
      {field("maxPlayers", copy.maxPlayers, server.maxPlayers ?? 128, {
        type: "number",
        required: true,
        min: 1,
        max: 4096,
      })}

      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" isLoading={loading}>
          {loading ? copy.saving : copy.save}
        </Button>
        {notice && (
          <span
            role={notice.error ? "alert" : "status"}
            className={`text-xs ${notice.error ? "text-danger" : "text-success"}`}
          >
            {notice.text}
          </span>
        )}
      </div>
    </form>
  );
}
