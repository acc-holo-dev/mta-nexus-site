"use client";

import { normalizeMtaAddress } from "@nexus/domain";
import { Button, ErrorState, fieldControlClass, Input } from "@nexus/ui";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { privateApiRequest } from "../lib/private-api-request";
import { confirmedCreatedServer } from "../lib/server-mutation-confirmation";
import { serverMutationErrorMessage } from "../lib/server-mutation-errors";
import {
  parseServerOrganizations,
  type ServerOrganizationOption,
} from "../lib/server-organization-options";
import { useNexusLocale } from "./locale-context";

const nativeLabelClass = "block font-label uppercase text-secondary";

export function RegisterServerForm({ actorId }: { actorId: string }) {
  const { locale, dictionary } = useNexusLocale();
  const copy = dictionary.serverRegistration;
  const [organizationsLoading, setOrganizationsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const [pending, setPending] = useState<{ nonce: string; fields: Record<string, string> } | null>(
    null,
  );
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const busyRef = useRef(false);
  const slot = `nexus:server-registration:v1:${actorId}`;
  const message = (ru: string, en: string) => (locale === "ru" ? ru : en);
  useEffect(() => {
    let alive = true;
    async function verify() {
      try {
        const response = await fetch("/api/auth/session", privateApiRequest());
        const data = await response.json();
        if (!response.ok || data?.authenticated !== true || data?.user?.id !== actorId)
          throw new Error("identity");
        const raw = sessionStorage.getItem(slot);
        if (raw) {
          const item = JSON.parse(raw);
          if (
            raw.length > 30000 ||
            item.actorId !== actorId ||
            !/^[a-f0-9]{32}$/u.test(item.nonce) ||
            !item.fields ||
            typeof item.fields !== "object" ||
            Array.isArray(item.fields) ||
            Object.values(item.fields).some((v) => typeof v !== "string")
          )
            throw new Error("storage");
          if (alive) setPending({ nonce: item.nonce, fields: item.fields });
        }
        if (alive) setVerified(true);
      } catch {
        if (alive)
          setRecoveryMessage(
            locale === "ru"
              ? "Не удалось проверить сессию или восстановить черновик. Обновите страницу и войдите в исходный аккаунт."
              : "Could not verify your session or restore the draft. Refresh and sign in to the original account.",
          );
      }
    }
    void verify();
    return () => {
      alive = false;
    };
  }, [actorId, slot, locale]);
  useEffect(() => {
    if (!pending || !verified || !formRef.current || organizationsLoading) return;
    for (const [name, value] of Object.entries(pending.fields)) {
      const field = formRef.current.elements.namedItem(name);
      if (
        field instanceof HTMLInputElement ||
        field instanceof HTMLTextAreaElement ||
        field instanceof HTMLSelectElement
      )
        field.value = value;
    }
  }, [pending, verified, organizationsLoading]);

  async function recover() {
    if (!pending || busyRef.current) return;
    busyRef.current = true;
    setLoading(true);
    try {
      const response = await fetch(
        `/api/servers/recovery?nonce=${encodeURIComponent(pending.nonce)}`,
        { ...privateApiRequest(), headers: { "x-nexus-actor-id": actorId } },
      );
      const result = await response.json();
      if (response.status === 401 || result?.code === "ACTOR_CHANGED") {
        setVerified(false);
        throw new Error(
          message(
            "Сессия изменилась. Войдите в исходный аккаунт.",
            "The session changed. Sign in to the original account.",
          ),
        );
      }
      if (!response.ok)
        throw new Error(
          message(
            "Не удалось проверить результат. Попробуйте ещё раз.",
            "Could not check the result. Try again.",
          ),
        );
      if (
        typeof result?.server?.id === "string" &&
        /^[A-Za-z0-9_-]{1,128}$/u.test(result.server.id)
      ) {
        window.addEventListener("pagehide", () => sessionStorage.removeItem(slot), { once: true });
        window.location.assign(`/workspace/servers/${encodeURIComponent(result.server.id)}`);
        return;
      }
      setRecoveryMessage(
        message(
          "Запись пока не подтверждена. Запрос ещё может завершиться; повторное создание заблокировано. Проверьте список серверов позже.",
          "The listing is not confirmed yet. The request may still complete; creating another is blocked. Check your server list later.",
        ),
      );
    } catch (error) {
      setRecoveryMessage(
        error instanceof Error
          ? error.message
          : message("Не удалось проверить результат.", "Could not check the result."),
      );
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  }
  const [error, setError] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<ServerOrganizationOption[]>([]);
  const [organizationsFailed, setOrganizationsFailed] = useState(false);
  const [organizationsLoadAttempt, setOrganizationsLoadAttempt] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies(organizationsLoadAttempt): Retry restarts organization lookup.
  useEffect(() => {
    const controller = new AbortController();
    setOrganizationsLoading(true);
    setOrganizationsFailed(false);
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
  }, [organizationsLoadAttempt]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || busyRef.current || pending || !verified) return;
    busyRef.current = true;

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
      const nonce = crypto.randomUUID().replaceAll("-", "");
      const fields = Object.fromEntries(
        [...form.entries()].filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      );
      sessionStorage.setItem(slot, JSON.stringify({ actorId, nonce, fields }));
      setPending({ nonce, fields });
      const response = await fetch("/api/servers", {
        ...privateApiRequest({ method: "POST", json: command, timeoutMs: 15_000 }),
        headers: {
          "Content-Type": "application/json",
          "x-nexus-actor-id": actorId,
          "x-nexus-creation-nonce": nonce,
        },
      });
      const data = await response.json().catch(() => null);
      const serverId = confirmedCreatedServer(
        response.status,
        data,
        command.slug,
        organizationId || null,
      );
      if (!serverId) {
        if (response.status === 401 || data?.code === "ACTOR_CHANGED") setVerified(false);
        if (
          [400, 403, 409, 413, 415, 428, 429].includes(response.status) &&
          data?.code !== "ACTOR_CHANGED"
        ) {
          sessionStorage.removeItem(slot);
          setPending(null);
        }
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
      window.addEventListener("pagehide", () => sessionStorage.removeItem(slot), { once: true });
      window.location.assign(`/workspace/servers/${encodeURIComponent(serverId)}`);
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : copy.unexpectedError);
      setLoading(false);
      busyRef.current = false;
    }
  }

  return (
    <div className="mx-auto min-w-0 max-w-2xl space-y-6 overflow-x-clip px-4 py-8 sm:px-0">
      <div className="space-y-1.5">
        <h1 className="font-display text-primary">{copy.title}</h1>
        <p className="max-w-xl text-sm leading-relaxed text-muted">{copy.description}</p>
      </div>

      {error ? (
        <ErrorState
          title={error}
          description={message(
            "Результат создания мог остаться неподтверждённым. Проверьте его перед дальнейшими действиями.",
            "The result may be unconfirmed. Check it before taking further action.",
          )}
        />
      ) : null}
      {recoveryMessage ? (
        <ErrorState id="register-server-session-recovery" title={recoveryMessage} />
      ) : null}
      {verified && pending ? (
        <ErrorState
          id="register-server-create-inconclusive"
          title={message(
            "Результат создания неизвестен. Черновик сохранён, повторное создание заблокировано.",
            "The creation result is unknown. Your draft is saved and creating another is blocked.",
          )}
          action={
            <Button type="button" disabled={loading} onClick={recover}>
              {message("Проверить результат", "Check result")}
            </Button>
          }
        />
      ) : null}

      <form
        ref={formRef}
        hidden={!verified}
        style={!verified ? { display: "none" } : undefined}
        onSubmit={submit}
        aria-busy={loading}
        className="nexus-panel grid min-w-0 grid-cols-1 gap-4 overflow-x-clip p-5 shadow-nexus-sm sm:grid-cols-2 sm:p-6"
      >
        <div className="space-y-1.5 sm:col-span-2">
          <label htmlFor="server-organization" className={nativeLabelClass}>
            {copy.ownerScope}
          </label>
          <select
            id="server-organization"
            name="organizationId"
            defaultValue=""
            disabled={loading || !!pending || organizationsLoading || organizationsFailed}
            className={fieldControlClass({
              disabled: loading || !!pending || organizationsLoading || organizationsFailed,
              className: "min-h-11",
            })}
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
          {organizationsFailed ? (
            <ErrorState
              title={copy.organizationsUnavailable}
              className="items-stretch py-4"
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="touch"
                  disabled={organizationsLoading}
                  onClick={() => setOrganizationsLoadAttempt((value) => value + 1)}
                >
                  {dictionary.errors.retry}
                </Button>
              }
            />
          ) : null}
        </div>

        <Input
          id="server-name"
          name="name"
          label={copy.name}
          required
          minLength={3}
          maxLength={100}
          disabled={loading}
          readOnly={!!pending}
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
          readOnly={!!pending}
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
            readOnly={!!pending}
            className={fieldControlClass({
              disabled: loading || !!pending,
              className: "h-auto min-h-28",
            })}
          />
        </div>

        <Input
          id="server-website-url"
          name="websiteUrl"
          type="url"
          label={copy.websiteUrl}
          placeholder="https://..."
          disabled={loading}
          readOnly={!!pending}
        />

        <Input
          id="server-discord-url"
          name="discordUrl"
          type="url"
          label={copy.discordUrl}
          placeholder="https://discord.gg/..."
          disabled={loading}
          readOnly={!!pending}
        />

        <Input
          id="server-rules-url"
          name="rulesUrl"
          type="url"
          label={copy.rulesUrl}
          placeholder="https://..."
          disabled={loading}
          readOnly={!!pending}
        />

        <Input
          id="server-language"
          name="language"
          label={copy.language}
          maxLength={64}
          defaultValue={locale === "ru" ? "Русский" : "English"}
          disabled={loading}
          readOnly={!!pending}
        />

        <Input
          id="server-region"
          name="region"
          label={copy.region}
          maxLength={64}
          placeholder={locale === "ru" ? "Европа" : "Europe"}
          disabled={loading}
          readOnly={!!pending}
        />

        <div className="sm:col-span-2">
          <Input
            id="server-gameplay-tags"
            name="gameplayTags"
            label={copy.gameplayTags}
            maxLength={500}
            placeholder="roleplay, economy, freeroam"
            disabled={loading}
            readOnly={!!pending}
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
            readOnly={!!pending}
            className={fieldControlClass({
              disabled: loading || !!pending,
              className: "h-auto min-h-24",
            })}
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
          readOnly={!!pending}
        />

        <Input
          id="server-game-mode"
          name="gameMode"
          label={copy.gameMode}
          maxLength={64}
          disabled={loading}
          readOnly={!!pending}
        />

        <Input
          id="server-map-name"
          name="mapName"
          label={copy.mapName}
          maxLength={64}
          disabled={loading}
          readOnly={!!pending}
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
          readOnly={!!pending}
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
          readOnly={!!pending}
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
          readOnly={!!pending}
        />

        <div className="space-y-1.5">
          <label htmlFor="server-visibility" className={nativeLabelClass}>
            {copy.visibility}
          </label>
          <select
            id="server-visibility"
            name="visibility"
            defaultValue="public"
            disabled={loading || !!pending}
            className={fieldControlClass({
              disabled: loading || !!pending,
              className: "min-h-11",
            })}
          >
            <option value="public">{copy.public}</option>
            <option value="unlisted">{copy.unlisted}</option>
            <option value="private">{copy.private}</option>
          </select>
        </div>

        <Button
          type="submit"
          disabled={!!pending}
          isLoading={loading}
          className="min-h-11 sm:col-span-2"
        >
          {loading ? copy.creating : copy.create}
        </Button>
      </form>
    </div>
  );
}
