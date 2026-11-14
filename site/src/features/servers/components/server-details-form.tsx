"use client";

import { normalizeMtaAddress } from "@nexus/domain";
import { Button, ErrorState, Field, fieldControlClass, Input } from "@nexus/ui";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { privateApiRequest } from "../../../lib/private-api-request";
import { confirmedUpdatedServer } from "../../../lib/server-mutation-confirmation";
import { serverMutationErrorMessage } from "../../../lib/server-mutation-errors";
import { useNexusLocale } from "../../../components/locale-context";

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

const snapshotSchema = z.object({
  id: z.string(),
  updatedAt: z.string().datetime({ offset: true }),
  name: z.string(),
  description: z.string(),
  websiteUrl: z.string(),
  discordUrl: z.string(),
  rulesUrl: z.string(),
  mediaUrls: z.array(z.string()),
  language: z.string(),
  region: z.string(),
  gameplayTags: z.array(z.string()),
  ipAddress: z.string(),
  port: z.number().int(),
  httpPort: z.number().int(),
  gameMode: z.string(),
  mapName: z.string(),
  maxPlayers: z.number().int(),
  visibility: z.enum(["public", "unlisted", "private"]),
});
type ServerSnapshot = z.infer<typeof snapshotSchema>;
const identitySchema = z.object({ id: z.string().min(1).max(128) });
function parseIdentity(value: unknown) {
  const parsed = identitySchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
function snapshot(server: EditableServer): ServerSnapshot | null {
  const parsed = snapshotSchema.safeParse({
    id: server.id,
    updatedAt: revisionToken(server.updatedAt),
    name: server.name,
    description: server.description ?? "",
    websiteUrl: server.websiteUrl ?? "",
    discordUrl: server.discordUrl ?? "",
    rulesUrl: server.rulesUrl ?? "",
    mediaUrls: server.mediaUrls ?? [],
    language: server.language ?? "",
    region: server.region ?? "",
    gameplayTags: server.gameplayTags ?? [],
    ipAddress: server.ipAddress,
    port: server.port,
    httpPort: server.httpPort ?? 22005,
    gameMode: server.gameMode ?? "",
    mapName: server.mapName ?? "",
    maxPlayers: server.maxPlayers ?? 128,
    visibility: server.visibility,
  });
  return parsed.success ? parsed.data : null;
}

export function ServerDetailsForm({
  server,
  actorId,
}: {
  server: EditableServer;
  actorId: string;
}) {
  const router = useRouter();
  const { locale, dictionary } = useNexusLocale();
  const copy = dictionary.serverManagement;
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState(() => revisionToken(server.updatedAt));
  const [checked, setChecked] = useState<ServerSnapshot | null>(null);
  const [pristineServer, setPristineServer] = useState<ServerSnapshot | null>(null);
  const [dirty, setDirty] = useState(false);
  const [needsCheck, setNeedsCheck] = useState(() => !revisionToken(server.updatedAt));
  const [identityVerified, setIdentityVerified] = useState(true);
  const [foreignActor, setForeignActor] = useState(false);
  const requestPending = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const propsSnapshot = snapshot(server);
  const fromProps =
    propsSnapshot && (!lastSavedAt || Date.parse(propsSnapshot.updatedAt) > Date.parse(lastSavedAt))
      ? propsSnapshot
      : null;
  const newest =
    checked && fromProps && Date.parse(fromProps.updatedAt) > Date.parse(checked.updatedAt)
      ? fromProps
      : (checked ?? fromProps);
  const displayServer = pristineServer ?? server;
  function closeForeignDraft() {
    setForeignActor(true);
    setChecked(null);
    setNotice({ text: copy.actorChanged, error: true });
  }
  async function checkSaved() {
    if (requestPending.current || loading || foreignActor) return;
    requestPending.current = true;
    setLoading(true);
    setIdentityVerified(false);
    setChecked(null);
    try {
      const identityResponse = await fetch("/api/account/profile", privateApiRequest());
      const identity = parseIdentity((await identityResponse.json().catch(() => null))?.profile);
      if (!alive.current) return;
      if (!identityResponse.ok || !identity) throw new Error(copy.checkFailed);
      if (identity.id !== actorId) {
        closeForeignDraft();
        return;
      }
      const response = await fetch(
        `/api/servers/${encodeURIComponent(server.id)}`,
        privateApiRequest(),
      );
      const body = await response.json().catch(() => null);
      if (!alive.current) return;
      if (!response.ok) {
        const recheckResponse = await fetch("/api/account/profile", privateApiRequest());
        const recheck = parseIdentity((await recheckResponse.json().catch(() => null))?.profile);
        if (!alive.current) return;
        if (!recheckResponse.ok || !recheck) throw new Error(copy.checkFailed);
        if (recheck.id !== actorId) {
          closeForeignDraft();
          return;
        }
        setIdentityVerified(true);
        throw new Error(copy.checkFailed);
      }
      if (typeof body?.actorId !== "string") throw new Error(copy.checkFailed);
      if (body.actorId !== actorId) {
        closeForeignDraft();
        return;
      }
      const parsed = snapshotSchema.safeParse(body.server);
      if (
        !parsed.success ||
        parsed.data.id !== server.id ||
        (lastSavedAt && Date.parse(parsed.data.updatedAt) < Date.parse(lastSavedAt))
      )
        throw new Error(copy.checkFailed);
      setChecked(parsed.data);
      setIdentityVerified(true);
      setNotice(null);
    } catch {
      if (alive.current) setNotice({ text: copy.checkFailed, error: true });
    } finally {
      requestPending.current = false;
      if (alive.current) setLoading(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      requestPending.current ||
      loading ||
      needsCheck ||
      newest ||
      !lastSavedAt ||
      !identityVerified ||
      foreignActor
    )
      return;

    requestPending.current = true;
    setLoading(true);
    setNotice(null);
    let responseReceived = false;

    try {
      const form = new FormData(event.currentTarget);
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
        expectedUpdatedAt: lastSavedAt,
      };
      const options = privateApiRequest({ method: "PATCH", json: command, timeoutMs: 15_000 });
      const headers = new Headers(options.headers);
      headers.set("X-Nexus-Actor-Id", actorId);
      const response = await fetch(`/api/servers/${encodeURIComponent(server.id)}`, {
        ...options,
        headers,
      });
      responseReceived = true;
      const data = await response.json().catch(() => null);
      if (!alive.current) return;
      if (data?.code === "ACTOR_CHANGED") {
        closeForeignDraft();
        return;
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
        if (response.ok || [401, 403, 404, 409].includes(response.status) || response.status >= 500)
          setNeedsCheck(true);
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
      setDirty(false);
      setNotice({ text: copy.saved, error: false });
      router.refresh();
    } catch (caught) {
      if (alive.current) {
        if (!responseReceived) setNeedsCheck(true);
        setNotice({
          error: true,
          text:
            caught instanceof Error && caught.message ? caught.message : copy.unexpectedSaveError,
        });
      }
    } finally {
      requestPending.current = false;
      if (alive.current) setLoading(false);
    }
  }

  return (
    <>
      {!foreignActor && (
        <form
          key={pristineServer?.updatedAt ?? server.id}
          style={!identityVerified ? { display: "none" } : undefined}
          onSubmit={submit}
          onChangeCapture={() => setDirty(true)}
          aria-busy={loading}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          {loading && (
            <p role="status" className="text-xs text-muted sm:col-span-2">
              {locale === "ru"
                ? "Сохранение выполняется. Поля временно недоступны."
                : "Saving. Fields are temporarily locked."}
            </p>
          )}
          <Input
            id="manage-server-name"
            name="name"
            label={copy.name}
            defaultValue={displayServer.name}
            required
            minLength={3}
            maxLength={100}
            disabled={loading}
            pending={loading}
          />

          <Field id="manage-server-visibility" label={copy.visibility} pending={loading}>
            {(control) => (
              <select
                id={control.id}
                name="visibility"
                defaultValue={displayServer.visibility}
                disabled={loading}
                aria-describedby={control.describedBy}
                className={control.className}
              >
                <option value="public">{copy.public}</option>
                <option value="unlisted">{copy.unlisted}</option>
                <option value="private">{copy.private}</option>
              </select>
            )}
          </Field>

          <Field
            id="manage-server-description"
            label={copy.description}
            pending={loading}
            className="sm:col-span-2"
          >
            {(control) => (
              <textarea
                id={control.id}
                name="description"
                defaultValue={displayServer.description || ""}
                rows={4}
                maxLength={5000}
                disabled={loading}
                aria-describedby={control.describedBy}
                className={fieldControlClass({
                  pending: loading,
                  disabled: loading,
                  className: "h-auto min-h-28",
                })}
              />
            )}
          </Field>

          <Input
            id="manage-server-website-url"
            name="websiteUrl"
            type="url"
            label={copy.websiteUrl}
            defaultValue={displayServer.websiteUrl || ""}
            placeholder="https://..."
            disabled={loading}
            pending={loading}
          />
          <Input
            id="manage-server-discord-url"
            name="discordUrl"
            type="url"
            label={copy.discordUrl}
            defaultValue={displayServer.discordUrl || ""}
            placeholder="https://discord.gg/..."
            disabled={loading}
            pending={loading}
          />
          <Input
            id="manage-server-rules-url"
            name="rulesUrl"
            type="url"
            label={copy.rulesUrl}
            defaultValue={displayServer.rulesUrl || ""}
            placeholder="https://..."
            disabled={loading}
            pending={loading}
          />
          <Input
            id="manage-server-language"
            name="language"
            label={copy.language}
            defaultValue={displayServer.language || ""}
            maxLength={64}
            disabled={loading}
            pending={loading}
          />
          <Input
            id="manage-server-region"
            name="region"
            label={copy.region}
            defaultValue={displayServer.region || ""}
            maxLength={64}
            disabled={loading}
            pending={loading}
          />

          <div className="sm:col-span-2">
            <Input
              id="manage-server-gameplay-tags"
              name="gameplayTags"
              label={copy.gameplayTags}
              maxLength={500}
              defaultValue={(displayServer.gameplayTags || []).join(", ")}
              placeholder="roleplay, economy, freeroam"
              disabled={loading}
              pending={loading}
            />
          </div>

          <Field
            id="manage-server-media-urls"
            label={copy.mediaUrls}
            pending={loading}
            className="sm:col-span-2"
          >
            {(control) => (
              <textarea
                id={control.id}
                name="mediaUrls"
                maxLength={4007}
                defaultValue={(displayServer.mediaUrls || []).join("\n")}
                rows={3}
                placeholder="https://..."
                disabled={loading}
                aria-describedby={control.describedBy}
                className={fieldControlClass({
                  pending: loading,
                  disabled: loading,
                  className: "h-auto min-h-24",
                })}
              />
            )}
          </Field>

          <Input
            id="manage-server-ip-address"
            name="ipAddress"
            label={copy.ipAddress}
            defaultValue={displayServer.ipAddress}
            required
            disabled={loading}
            pending={loading}
          />
          <Input
            id="manage-server-port"
            name="port"
            type="number"
            label={copy.gamePort}
            defaultValue={displayServer.port}
            required
            min={1}
            max={65535}
            disabled={loading}
            pending={loading}
          />
          <Input
            id="manage-server-http-port"
            name="httpPort"
            type="number"
            label={copy.httpPort}
            defaultValue={displayServer.httpPort ?? 22005}
            required
            min={1}
            max={65535}
            disabled={loading}
            pending={loading}
          />
          <Input
            id="manage-server-game-mode"
            name="gameMode"
            label={copy.gameMode}
            defaultValue={displayServer.gameMode || ""}
            maxLength={64}
            disabled={loading}
            pending={loading}
          />
          <Input
            id="manage-server-map-name"
            name="mapName"
            label={copy.mapName}
            defaultValue={displayServer.mapName || ""}
            maxLength={64}
            disabled={loading}
            pending={loading}
          />
          <Input
            id="manage-server-max-players"
            name="maxPlayers"
            type="number"
            label={copy.maxPlayers}
            defaultValue={displayServer.maxPlayers ?? 128}
            required
            min={1}
            max={4096}
            disabled={loading}
            pending={loading}
          />

          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <Button
              type="submit"
              isLoading={loading}
              disabled={loading || needsCheck || Boolean(newest) || !lastSavedAt}
              className="min-h-11"
            >
              {loading ? copy.saving : copy.save}
            </Button>
            {notice && !notice.error && (
              <span role="status" className="text-xs text-success">
                {notice.text}
              </span>
            )}
          </div>
          {notice?.error ? <ErrorState title={notice.text} className="sm:col-span-2" /> : null}
        </form>
      )}
      {!identityVerified && notice?.error && <ErrorState title={notice.text} />}
      {foreignActor && notice?.error && <ErrorState title={notice.text} />}
      {needsCheck && !foreignActor && (
        <div className="space-y-2">
          {!lastSavedAt ? (
            <ErrorState id="server-details-missing-revision" title={copy.missingRevision} />
          ) : null}
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => void checkSaved()}
          >
            {copy.compareLatest}
          </Button>
        </div>
      )}
      {!foreignActor && identityVerified && newest && (
        <section
          aria-label={copy.latestDetails}
          className="space-y-2 rounded-lg border border-base p-4 text-sm"
        >
          <h3 className="font-semibold">{copy.latestDetails}</h3>
          <p>{copy.compareHelp}</p>
          <p>
            {copy.name}: {newest.name}
          </p>
          <p>
            {copy.visibility}: {copy[newest.visibility]}
          </p>
          <p className="whitespace-pre-wrap break-words">
            {copy.description}: {newest.description}
          </p>
          <p className="break-words">
            {copy.websiteUrl}: {newest.websiteUrl}
          </p>
          <p className="break-words">
            {copy.discordUrl}: {newest.discordUrl}
          </p>
          <p className="break-words">
            {copy.rulesUrl}: {newest.rulesUrl}
          </p>
          <p className="whitespace-pre-wrap break-words">
            {copy.mediaUrls}: {newest.mediaUrls.join("\n")}
          </p>
          <p>
            {copy.language}: {newest.language}
          </p>
          <p>
            {copy.region}: {newest.region}
          </p>
          <p>
            {copy.gameplayTags}: {newest.gameplayTags.join(", ")}
          </p>
          <p>
            {copy.ipAddress}: {newest.ipAddress}
          </p>
          <p>
            {copy.gamePort}: {newest.port}
          </p>
          <p>
            {copy.httpPort}: {newest.httpPort}
          </p>
          <p>
            {copy.gameMode}: {newest.gameMode}
          </p>
          <p>
            {copy.mapName}: {newest.mapName}
          </p>
          <p>
            {copy.maxPlayers}: {newest.maxPlayers}
          </p>
          {(!needsCheck || checked) && (
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => {
                if (!dirty) setPristineServer(newest);
                setLastSavedAt(newest.updatedAt);
                setChecked(null);
                setNeedsCheck(false);
                setNotice(null);
              }}
            >
              {copy.useLatest}
            </Button>
          )}
        </section>
      )}
    </>
  );
}
