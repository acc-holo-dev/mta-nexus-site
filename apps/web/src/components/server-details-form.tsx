"use client";

import { normalizeMtaAddress } from "@nexus/domain";
import { Button, Input } from "@nexus/ui";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { privateApiRequest } from "../lib/private-api-request";
import { confirmedUpdatedServer } from "../lib/server-mutation-confirmation";
import { serverMutationErrorMessage } from "../lib/server-mutation-errors";
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

const controlClass =
  "h-10 w-full rounded-lg border border-base bg-inset px-3 py-2 text-sm text-primary transition-colors placeholder:text-[color:var(--nexus-text-faint)] hover:border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)]";
const textareaClass =
  "w-full rounded-lg border border-base bg-inset px-3 py-2 text-sm text-primary transition-colors placeholder:text-[color:var(--nexus-text-faint)] hover:border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)]";
const nativeLabelClass = "block font-label uppercase text-secondary";

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
        ipAddress: normalizeMtaAddress(String(form.get("ipAddress") || "")),
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
      if (
        !confirmedUpdatedServer(response.status, data, {
          id: server.id,
          name: command.name,
          ipAddress: command.ipAddress,
          port: command.port,
          httpPort: command.httpPort,
          mapName: command.mapName,
          visibility: command.visibility,
          description: command.description,
          websiteUrl: command.websiteUrl,
          discordUrl: command.discordUrl,
          rulesUrl: command.rulesUrl,
          mediaUrls: command.mediaUrls,
          language: command.language,
          region: command.region,
          gameplayTags: command.gameplayTags,
          gameMode: command.gameMode,
          maxPlayers: command.maxPlayers,
          ...(lastSavedAt ? { expectedUpdatedAt: lastSavedAt } : {}),
        })
      ) {
        throw new Error(
          serverMutationErrorMessage(
            data,
            {
              SERVER_METADATA_CONFLICT: copy.concurrentEdit,
              SERVER_ENDPOINT_TAKEN: copy.endpointTaken,
              FORBIDDEN: copy.forbiddenEdit,
              REQUEST_BODY_TOO_LARGE: copy.bodyTooLarge,
              REQUEST_BODY_TIMEOUT: copy.bodyTimedOut,
            },
            copy.saveError,
          ),
        );
      }

      setLastSavedAt(revisionToken(data?.server?.updatedAt));
      setNotice({ text: copy.saved, error: false });
      router.refresh();
    } catch (caught) {
      setNotice({
        error: true,
        text: caught instanceof Error && caught.message ? caught.message : copy.unexpectedSaveError,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} aria-busy={loading} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Input
        id="manage-server-name"
        name="name"
        label={copy.name}
        defaultValue={server.name}
        required
        minLength={3}
        maxLength={100}
        disabled={loading}
      />

      <div className="space-y-1.5">
        <label htmlFor="manage-server-visibility" className={nativeLabelClass}>
          {copy.visibility}
        </label>
        <select
          id="manage-server-visibility"
          name="visibility"
          defaultValue={server.visibility}
          disabled={loading}
          className={controlClass}
        >
          <option value="public">{copy.public}</option>
          <option value="unlisted">{copy.unlisted}</option>
          <option value="private">{copy.private}</option>
        </select>
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <label htmlFor="manage-server-description" className={nativeLabelClass}>
          {copy.description}
        </label>
        <textarea
          id="manage-server-description"
          name="description"
          defaultValue={server.description || ""}
          rows={4}
          maxLength={5000}
          disabled={loading}
          className={textareaClass}
        />
      </div>

      <Input
        id="manage-server-website-url"
        name="websiteUrl"
        type="url"
        label={copy.websiteUrl}
        defaultValue={server.websiteUrl || ""}
        placeholder="https://..."
        disabled={loading}
      />
      <Input
        id="manage-server-discord-url"
        name="discordUrl"
        type="url"
        label={copy.discordUrl}
        defaultValue={server.discordUrl || ""}
        placeholder="https://discord.gg/..."
        disabled={loading}
      />
      <Input
        id="manage-server-rules-url"
        name="rulesUrl"
        type="url"
        label={copy.rulesUrl}
        defaultValue={server.rulesUrl || ""}
        placeholder="https://..."
        disabled={loading}
      />
      <Input
        id="manage-server-language"
        name="language"
        label={copy.language}
        defaultValue={server.language || ""}
        maxLength={64}
        disabled={loading}
      />
      <Input
        id="manage-server-region"
        name="region"
        label={copy.region}
        defaultValue={server.region || ""}
        maxLength={64}
        disabled={loading}
      />

      <div className="sm:col-span-2">
        <Input
          id="manage-server-gameplay-tags"
          name="gameplayTags"
          label={copy.gameplayTags}
          maxLength={500}
          defaultValue={(server.gameplayTags || []).join(", ")}
          placeholder="roleplay, economy, freeroam"
          disabled={loading}
        />
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <label htmlFor="manage-server-media-urls" className={nativeLabelClass}>
          {copy.mediaUrls}
        </label>
        <textarea
          id="manage-server-media-urls"
          name="mediaUrls"
          maxLength={4007}
          defaultValue={(server.mediaUrls || []).join("\n")}
          rows={3}
          placeholder="https://..."
          disabled={loading}
          className={textareaClass}
        />
      </div>

      <Input
        id="manage-server-ip-address"
        name="ipAddress"
        label={copy.ipAddress}
        defaultValue={server.ipAddress}
        required
        disabled={loading}
      />
      <Input
        id="manage-server-port"
        name="port"
        type="number"
        label={copy.gamePort}
        defaultValue={server.port}
        required
        min={1}
        max={65535}
        disabled={loading}
      />
      <Input
        id="manage-server-http-port"
        name="httpPort"
        type="number"
        label={copy.httpPort}
        defaultValue={server.httpPort ?? 22005}
        required
        min={1}
        max={65535}
        disabled={loading}
      />
      <Input
        id="manage-server-game-mode"
        name="gameMode"
        label={copy.gameMode}
        defaultValue={server.gameMode || ""}
        maxLength={64}
        disabled={loading}
      />
      <Input
        id="manage-server-map-name"
        name="mapName"
        label={copy.mapName}
        defaultValue={server.mapName || ""}
        maxLength={64}
        disabled={loading}
      />
      <Input
        id="manage-server-max-players"
        name="maxPlayers"
        type="number"
        label={copy.maxPlayers}
        defaultValue={server.maxPlayers ?? 128}
        required
        min={1}
        max={4096}
        disabled={loading}
      />

      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" isLoading={loading} className="min-h-11">
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
