import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

export const REQUEST_ID_HEADER = "X-Request-Id";

export type RequestLogContext = Readonly<{
  requestId: string;
  method: string;
  path: string;
}>;

type LogLevel = "info" | "warn" | "error";

type LogValue = string | number | boolean | null | undefined;

type StructuredLogInput = Readonly<{
  level: LogLevel;
  event: string;
  context: RequestLogContext;
  status?: number;
  error?: unknown;
  fields?: Readonly<Record<string, LogValue>>;
}>;

const blockedFieldNames = /(?:authorization|cookie|token|secret|password|email|ip|headers|body|query|url)/iu;

function cleanText(value: string, maxLength = 160): string {
  return value.replace(/[\r\n\t]+/gu, " ").slice(0, maxLength);
}

export function createRequestLogContext(
  request: Pick<NextRequest, "method" | "nextUrl">,
  idFactory: () => string = randomUUID,
): RequestLogContext {
  return Object.freeze({
    requestId: cleanText(idFactory(), 96),
    method: cleanText(request.method || "UNKNOWN", 16),
    path: cleanText(request.nextUrl.pathname || "/", 256),
  });
}

export function errorLogMetadata(error: unknown): Readonly<{
  name: string;
  code?: string | number;
}> {
  if (!(error instanceof Error)) {
    return Object.freeze({ name: "UnknownError" });
  }

  const metadata: { name: string; code?: string | number } = {
    name: cleanText(error.name || "Error", 80),
  };

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error
  ) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") metadata.code = cleanText(code, 80);
    if (typeof code === "number" && Number.isFinite(code)) metadata.code = code;
  }

  return Object.freeze(metadata);
}

export function createStructuredLogEntry(input: StructuredLogInput) {
  const fields: Record<string, Exclude<LogValue, undefined>> = {};

  for (const [key, value] of Object.entries(input.fields ?? {})) {
    if (value === undefined || blockedFieldNames.test(key)) continue;
    fields[key] = typeof value === "string" ? cleanText(value) : value;
  }

  return Object.freeze({
    timestamp: new Date().toISOString(),
    level: input.level,
    event: cleanText(input.event, 120),
    requestId: input.context.requestId,
    method: input.context.method,
    path: input.context.path,
    ...(input.status === undefined ? {} : { status: input.status }),
    ...(input.error === undefined ? {} : { error: errorLogMetadata(input.error) }),
    ...fields,
  });
}

export function logRequestEvent(input: StructuredLogInput): void {
  const line = JSON.stringify(createStructuredLogEntry(input));
  if (input.level === "error") {
    console.error(line);
    return;
  }
  if (input.level === "warn") {
    console.warn(line);
    return;
  }
  console.info(line);
}

export function jsonWithRequestId(
  context: RequestLogContext,
  body: unknown,
  init: ResponseInit = {},
) {
  const headers = new Headers(init.headers);
  headers.set(REQUEST_ID_HEADER, context.requestId);
  return NextResponse.json(body, { ...init, headers });
}
