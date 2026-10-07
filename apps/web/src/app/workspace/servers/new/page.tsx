"use client";

import { type FormEvent, useState } from "react";
import { Button } from "@nexus/ui";
import { useNexusLocale } from "../../../../components/locale-context";
import { confirmedCreatedServer } from "../../../../lib/server-mutation-confirmation";

const fieldClass =
  "w-full rounded-lg border border-base bg-inset px-3 py-2 text-sm text-primary outline-none transition-colors placeholder:text-[color:var(--nexus-text-faint)] hover:border-strong focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)]";
const labelClass = "space-y-1.5";
const labelTextClass = "font-label text-secondary";

export default function RegisterServerPage() {
  const { locale, dictionary } = useNexusLocale();
  const copy = dictionary.serverRegistration;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);
    const form = new FormData(event.currentTarget);

    try {
      const command = {
        name: String(form.get("name") || "").trim(),
        slug: String(form.get("slug") || "").trim().toLowerCase(),
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
        port: Number(form.get("port") || 22003),
        httpPort: Number(form.get("httpPort") || 22005),
        maxPlayers: Number(form.get("maxPlayers") || 128),
        gameMode: String(form.get("gameMode") || "").trim(),
        visibility: String(form.get("visibility") || "public"),
      };
      const response = await fetch("/api/servers", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(command),
        signal: AbortSignal.timeout(15_000),
      });
      const data = await response.json().catch(() => null);
      const serverId = confirmedCreatedServer(
        response.status,
        data,
        command.slug,
      );
      if (!serverId) {
        throw new Error(data?.error || copy.createError);
      }
      window.location.assign(
        `/workspace/servers/${encodeURIComponent(serverId)}`,
      );
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : copy.unexpectedError,
      );
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8">
      <div className="space-y-1.5">
        <h1 className="font-display text-primary">{copy.title}</h1>
        <p className="max-w-xl text-sm leading-relaxed text-muted">
          {copy.description}
        </p>
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
        <label className={labelClass}>
          <span className={labelTextClass}>{copy.name}</span>
          <input
            name="name"
            required
            minLength={3}
            maxLength={120}
            className={fieldClass}
          />
        </label>

        <label className={labelClass}>
          <span className={labelTextClass}>{copy.slug}</span>
          <input
            name="slug"
            required
            minLength={3}
            maxLength={120}
            pattern="[a-z0-9-]+"
            autoCapitalize="none"
            spellCheck={false}
            className={fieldClass}
          />
        </label>

        <label className={`${labelClass} sm:col-span-2`}>
          <span className={labelTextClass}>{copy.descriptionLabel}</span>
          <textarea
            name="description"
            rows={4}
            maxLength={5000}
            className={fieldClass}
          />
        </label>

        <label className={labelClass}>
          <span className={labelTextClass}>{copy.websiteUrl}</span>
          <input
            name="websiteUrl"
            type="url"
            placeholder="https://..."
            className={fieldClass}
          />
        </label>

        <label className={labelClass}>
          <span className={labelTextClass}>{copy.discordUrl}</span>
          <input
            name="discordUrl"
            type="url"
            placeholder="https://discord.gg/..."
            className={fieldClass}
          />
        </label>

        <label className={labelClass}>
          <span className={labelTextClass}>{copy.rulesUrl}</span>
          <input
            name="rulesUrl"
            type="url"
            placeholder="https://..."
            className={fieldClass}
          />
        </label>

        <label className={labelClass}>
          <span className={labelTextClass}>{copy.language}</span>
          <input
            name="language"
            maxLength={64}
            defaultValue={locale === "ru" ? "Русский" : "English"}
            className={fieldClass}
          />
        </label>

        <label className={labelClass}>
          <span className={labelTextClass}>{copy.region}</span>
          <input
            name="region"
            maxLength={64}
            placeholder={locale === "ru" ? "Европа" : "Europe"}
            className={fieldClass}
          />
        </label>

        <label className={`${labelClass} sm:col-span-2`}>
          <span className={labelTextClass}>{copy.gameplayTags}</span>
          <input
            name="gameplayTags"
            maxLength={500}
            placeholder="roleplay, economy, freeroam"
            className={fieldClass}
          />
        </label>

        <label className={`${labelClass} sm:col-span-2`}>
          <span className={labelTextClass}>{copy.mediaUrls}</span>
          <textarea
            name="mediaUrls"
            rows={3}
            maxLength={3000}
            placeholder="https://..."
            className={fieldClass}
          />
        </label>

        <label className={labelClass}>
          <span className={labelTextClass}>{copy.ipAddress}</span>
          <input
            name="ipAddress"
            required
            maxLength={255}
            autoCapitalize="none"
            spellCheck={false}
            className={fieldClass}
          />
        </label>

        <label className={labelClass}>
          <span className={labelTextClass}>{copy.gameMode}</span>
          <input name="gameMode" maxLength={120} className={fieldClass} />
        </label>

        <label className={labelClass}>
          <span className={labelTextClass}>{copy.gamePort}</span>
          <input
            name="port"
            type="number"
            min={1}
            max={65535}
            defaultValue={22003}
            className={fieldClass}
          />
        </label>

        <label className={labelClass}>
          <span className={labelTextClass}>{copy.httpPort}</span>
          <input
            name="httpPort"
            type="number"
            min={1}
            max={65535}
            defaultValue={22005}
            className={fieldClass}
          />
        </label>

        <label className={labelClass}>
          <span className={labelTextClass}>{copy.maxPlayers}</span>
          <input
            name="maxPlayers"
            type="number"
            min={1}
            max={4096}
            defaultValue={128}
            className={fieldClass}
          />
        </label>

        <label className={labelClass}>
          <span className={labelTextClass}>{copy.visibility}</span>
          <select
            name="visibility"
            defaultValue="public"
            className={fieldClass}
          >
            <option value="public">{copy.public}</option>
            <option value="unlisted">{copy.unlisted}</option>
            <option value="private">{copy.private}</option>
          </select>
        </label>

        <Button
          type="submit"
          isLoading={loading}
          className="sm:col-span-2"
        >
          {loading ? copy.creating : copy.create}
        </Button>
      </form>
    </div>
  );
}
