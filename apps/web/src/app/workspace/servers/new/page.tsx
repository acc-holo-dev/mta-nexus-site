"use client";

import { normalizeMtaAddress } from "@nexus/domain";
import { Button, Input } from "@nexus/ui";
import { type FormEvent, useEffect, useState } from "react";
import { useNexusLocale } from "../../../../components/locale-context";
import { privateApiRequest } from "../../../../lib/private-api-request";
import { confirmedCreatedServer } from "../../../../lib/server-mutation-confirmation";
import { serverMutationErrorMessage } from "../../../../lib/server-mutation-errors";
import {
  parseServerOrganizations,
  type ServerOrganizationOption,
} from "../../../../lib/server-organization-options";

const controlClass =
  "h-10 w-full rounded-lg border border-base bg-inset px-3 py-2 text-sm text-primary transition-colors placeholder:text-[color:var(--nexus-text-faint)] hover:border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)]";
const textareaClass =
  "w-full rounded-lg border border-base bg-inset px-3 py-2 text-sm text-primary transition-colors placeholder:text-[color:var(--nexus-text-faint)] hover:border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)]";
const nativeLabelClass = "block font-label uppercase text-secondary";

export default function RegisterServerPage() {
  const { locale, dictionary } = useNexusLocale();
  const copy = dictionary.serverRegistration;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<ServerOrganizationOption[]>([]);
  const [organizationsLoading, setOrganizationsLoading] = useState(true);
  const [organizationsFailed, setOrganizationsFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function loadOrganizations() {
      try {
        const response = await fetch(
          "/api/workspace/server-organizations",
          privateApiRequest({ signal: controller.signal, timeoutMs: 10_000 }),
        );
        if (!response.ok) throw new Error("Organization lookup unavailable");
        const options = parseServerOrganizations(await response.json());
        if (!options) throw new Error("Invalid organization lookup response");
        if (!controller.signal.aborted) setOrganizations(options);
      } catch {
        // A lookup outage must not grant access to an unlisted organization.
        if (!controller.signal.aborted) setOrganizationsFailed(true);
      } finally {
        if (!controller.signal.aborted) setOrganizationsLoading(false);
      }
    }
    void loadOrganizations();
    return () => controller.abort();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);
    const form = new FormData(event.currentTarget);

    try {
      const organizationId = String(form.get("organizationId") || "");
      if (organizationId && !organizations.some((item) => item.id === organizationId)) {
        throw new Error(copy.organizationSelectionUnavailable);
      }
      const command = {
        name: String(form.get("name") || "").trim(),
        slug: String(form.get("slug") || "")
          .trim()
          .toLowerCase(),
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
        port: Number(form.get("port") || 22003),
        httpPort: Number(form.get("httpPort") || 22005),
        maxPlayers: Number(form.get("maxPlayers") || 128),
        gameMode: String(form.get("gameMode") || "").trim(),
        mapName: String(form.get("mapName") || "").trim(),
        visibility: String(form.get("visibility") || "public"),
        ...(organizationId ? { organizationId } : {}),
      };
      const response = await fetch(
        "/api/servers",
        privateApiRequest({
          method: "POST",
          json: command,
          timeoutMs: 15_000,
        }),
      );
      const data = await response.json().catch(() => null);
      const serverId = confirmedCreatedServer(
        response.status,
        data,
        command.slug,
        organizationId || null,
      );
      if (!serverId) {
        throw new Error(
          serverMutationErrorMessage(
            data,
            {
              SERVER_SLUG_TAKEN: copy.slugTaken,
              SERVER_ENDPOINT_TAKEN: copy.endpointTaken,
              FORBIDDEN: copy.organizationForbidden,
              REQUEST_BODY_TOO_LARGE: copy.bodyTooLarge,
              REQUEST_BODY_TIMEOUT: copy.bodyTimedOut,
            },
            copy.createError,
          ),
        );
      }
      window.location.assign(`/workspace/servers/${encodeURIComponent(serverId)}`);
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : copy.unexpectedError);
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-0">
      <div className="space-y-1.5">
        <h1 className="font-display text-primary">{copy.title}</h1>
        <p className="max-w-xl text-sm leading-relaxed text-muted">{copy.description}</p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-[color:var(--nexus-danger)]/25 bg-danger-soft p-4 text-sm text-danger"
        >
          {error}
        </div>
      )}

      <form
        onSubmit={submit}
        aria-busy={loading}
        className="nexus-panel grid grid-cols-1 gap-4 p-5 shadow-nexus-sm sm:grid-cols-2 sm:p-6"
      >
        <div className="space-y-1.5 sm:col-span-2">
          <label htmlFor="server-organization" className={nativeLabelClass}>
            {copy.ownerScope}
          </label>
          <select
            id="server-organization"
            name="organizationId"
            defaultValue=""
            disabled={loading || organizationsLoading || organizationsFailed}
            className={controlClass}
          >
            <option value="">{copy.personalScope}</option>
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
          {organizationsLoading && (
            <span className="block text-xs text-muted">{copy.organizationsLoading}</span>
          )}
          {organizationsFailed && (
            <span role="status" className="block text-xs text-muted">
              {copy.organizationsUnavailable}
            </span>
          )}
        </div>

        <Input
          id="server-name"
          name="name"
          label={copy.name}
          required
          minLength={3}
          maxLength={100}
          disabled={loading}
        />

        <Input
          id="server-slug"
          name="slug"
          label={copy.slug}
          required
          minLength={3}
          maxLength={100}
          pattern="[a-z0-9-]+"
          autoCapitalize="none"
          spellCheck={false}
          disabled={loading}
        />

        <div className="space-y-1.5 sm:col-span-2">
          <label htmlFor="server-description" className={nativeLabelClass}>
            {copy.descriptionLabel}
          </label>
          <textarea
            id="server-description"
            name="description"
            rows={4}
            maxLength={5000}
            disabled={loading}
            className={textareaClass}
          />
        </div>

        <Input
          id="server-website-url"
          name="websiteUrl"
          type="url"
          label={copy.websiteUrl}
          placeholder="https://..."
          disabled={loading}
        />

        <Input
          id="server-discord-url"
          name="discordUrl"
          type="url"
          label={copy.discordUrl}
          placeholder="https://discord.gg/..."
          disabled={loading}
        />

        <Input
          id="server-rules-url"
          name="rulesUrl"
          type="url"
          label={copy.rulesUrl}
          placeholder="https://..."
          disabled={loading}
        />

        <Input
          id="server-language"
          name="language"
          label={copy.language}
          maxLength={64}
          defaultValue={locale === "ru" ? "Русский" : "English"}
          disabled={loading}
        />

        <Input
          id="server-region"
          name="region"
          label={copy.region}
          maxLength={64}
          placeholder={locale === "ru" ? "Европа" : "Europe"}
          disabled={loading}
        />

        <div className="sm:col-span-2">
          <Input
            id="server-gameplay-tags"
            name="gameplayTags"
            label={copy.gameplayTags}
            maxLength={500}
            placeholder="roleplay, economy, freeroam"
            disabled={loading}
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <label htmlFor="server-media-urls" className={nativeLabelClass}>
            {copy.mediaUrls}
          </label>
          <textarea
            id="server-media-urls"
            name="mediaUrls"
            rows={3}
            maxLength={3000}
            placeholder="https://..."
            disabled={loading}
            className={textareaClass}
          />
        </div>

        <Input
          id="server-ip-address"
          name="ipAddress"
          label={copy.ipAddress}
          required
          maxLength={255}
          autoCapitalize="none"
          spellCheck={false}
          disabled={loading}
        />

        <Input
          id="server-game-mode"
          name="gameMode"
          label={copy.gameMode}
          maxLength={64}
          disabled={loading}
        />

        <Input
          id="server-map-name"
          name="mapName"
          label={copy.mapName}
          maxLength={64}
          disabled={loading}
        />

        <Input
          id="server-port"
          name="port"
          type="number"
          label={copy.gamePort}
          min={1}
          max={65535}
          defaultValue={22003}
          disabled={loading}
        />

        <Input
          id="server-http-port"
          name="httpPort"
          type="number"
          label={copy.httpPort}
          min={1}
          max={65535}
          defaultValue={22005}
          disabled={loading}
        />

        <Input
          id="server-max-players"
          name="maxPlayers"
          type="number"
          label={copy.maxPlayers}
          min={1}
          max={4096}
          defaultValue={128}
          disabled={loading}
        />

        <div className="space-y-1.5">
          <label htmlFor="server-visibility" className={nativeLabelClass}>
            {copy.visibility}
          </label>
          <select
            id="server-visibility"
            name="visibility"
            defaultValue="public"
            disabled={loading}
            className={controlClass}
          >
            <option value="public">{copy.public}</option>
            <option value="unlisted">{copy.unlisted}</option>
            <option value="private">{copy.private}</option>
          </select>
        </div>

        <Button type="submit" isLoading={loading} className="min-h-11 sm:col-span-2">
          {loading ? copy.creating : copy.create}
        </Button>
      </form>
    </div>
  );
}
