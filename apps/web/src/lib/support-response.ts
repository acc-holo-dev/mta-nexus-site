export type SupportCaseStatus = "open" | "resolved" | "closed";

export type SupportCaseData = {
  id: string;
  category: string;
  subject: string;
  status: SupportCaseStatus;
};

export type SupportCaseSummary = SupportCaseData & {
  updatedAt: string;
  requesterUsername?: string;
};

export type SupportMessageData = {
  id: string;
  caseId: string;
  authorRole: "requester" | "staff";
  body: string;
  createdAt: string;
};

export type SupportThreadData = {
  supportCase: SupportCaseData;
  messages: SupportMessageData[];
  messagePage: number;
  messageTotalPages: number;
  messageTotal: number;
};

export type SupportCasePage = {
  cases: SupportCaseSummary[];
  page: number;
  totalPages: number;
  total: number;
};

const caseIdPattern = /^sup_[a-f0-9]{24}$/;
const messageIdPattern = /^spm_[a-f0-9]{24}$/;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !isoDatePattern.test(value)) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 19) === value.slice(0, 19);
}

function isStatus(value: unknown): value is SupportCaseStatus {
  return value === "open" || value === "resolved" || value === "closed";
}

function parseCase(value: unknown): SupportCaseData | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" || !caseIdPattern.test(value.id) ||
    typeof value.category !== "string" || !value.category || value.category.length > 40 ||
    typeof value.subject !== "string" || !value.subject.trim() || value.subject.length > 120 ||
    !isStatus(value.status)
  ) return null;
  return { id: value.id, category: value.category, subject: value.subject, status: value.status };
}

function parseSummary(value: unknown): SupportCaseSummary | null {
  const supportCase = parseCase(value);
  if (!supportCase || !isRecord(value) || !isDate(value.updatedAt)) return null;
  if (value.requesterUsername != null && (typeof value.requesterUsername !== "string" || value.requesterUsername.length > 128)) return null;
  return {
    ...supportCase,
    updatedAt: value.updatedAt,
    ...(typeof value.requesterUsername === "string" ? { requesterUsername: value.requesterUsername } : {}),
  };
}

function parseMessage(value: unknown, caseId: string): SupportMessageData | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" || !messageIdPattern.test(value.id) ||
    value.caseId !== caseId ||
    (value.authorRole !== "requester" && value.authorRole !== "staff") ||
    typeof value.body !== "string" || !value.body || value.body.length > 4_000 ||
    !isDate(value.createdAt)
  ) return null;
  return {
    id: value.id,
    caseId,
    authorRole: value.authorRole,
    body: value.body,
    createdAt: value.createdAt,
  };
}

function parsePositiveInteger(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
    ? value
    : null;
}

export function parseSupportCasePage(payload: unknown): SupportCasePage | null {
  if (
    !isRecord(payload) ||
    !Array.isArray(payload.cases) ||
    payload.cases.length > 100
  ) {
    return null;
  }
  const page = parsePositiveInteger(payload.page);
  const totalPages = parsePositiveInteger(payload.totalPages);
  const total = parsePositiveInteger(payload.total);
  if (
    page === null ||
    page < 1 ||
    totalPages === null ||
    totalPages < 1 ||
    total === null ||
    page > totalPages
  ) {
    return null;
  }

  const cases: SupportCaseSummary[] = [];
  for (const row of payload.cases) {
    const supportCase = parseSummary(row);
    if (!supportCase) return null;
    cases.push(supportCase);
  }
  return { cases, page, totalPages, total };
}

export function parseSupportCaseList(payload: unknown): SupportCaseSummary[] | null {
  if (!isRecord(payload) || !Array.isArray(payload.cases) || payload.cases.length > 100) return null;
  const cases: SupportCaseSummary[] = [];
  for (const row of payload.cases) {
    const supportCase = parseSummary(row);
    if (!supportCase) return null;
    cases.push(supportCase);
  }
  return cases;
}

export function parseSupportThread(payload: unknown, caseId: string): SupportThreadData | null {
  if (
    !caseIdPattern.test(caseId) ||
    !isRecord(payload) ||
    !Array.isArray(payload.messages) ||
    payload.messages.length > 100
  ) {
    return null;
  }
  const supportCase = parseCase(payload.supportCase);
  if (!supportCase || supportCase.id !== caseId) return null;
  const messagePage = parsePositiveInteger(payload.messagePage);
  const messageTotalPages = parsePositiveInteger(payload.messageTotalPages);
  const messageTotal = parsePositiveInteger(payload.messageTotal);
  if (
    messagePage === null ||
    messagePage < 1 ||
    messageTotalPages === null ||
    messageTotalPages < 1 ||
    messageTotal === null ||
    messagePage > messageTotalPages
  ) {
    return null;
  }
  const messages: SupportMessageData[] = [];
  for (const row of payload.messages) {
    const message = parseMessage(row, caseId);
    if (!message) return null;
    messages.push(message);
  }
  return {
    supportCase,
    messages,
    messagePage,
    messageTotalPages,
    messageTotal,
  };
}

export function confirmSupportCaseCreated(
  status: number,
  payload: unknown,
  input: { category: string; subject: string },
): SupportCaseSummary | null {
  if (status !== 201 || !isRecord(payload) || payload.success !== true) return null;
  const supportCase = parseSummary(payload.supportCase);
  if (
    !supportCase || supportCase.status !== "open" ||
    supportCase.category !== input.category ||
    supportCase.subject !== input.subject.trim()
  ) return null;
  return supportCase;
}

export function confirmSupportReply(
  status: number,
  payload: unknown,
  caseId: string,
  body: string,
): { supportCase: SupportCaseData; message: SupportMessageData } | null {
  if (status !== 201 || !isRecord(payload) || payload.success !== true) return null;
  const supportCase = parseCase(payload.supportCase);
  const message = parseMessage(payload.message, caseId);
  if (
    !supportCase || supportCase.id !== caseId || supportCase.status !== "open" ||
    !message || message.body !== body.trim()
  ) return null;
  return { supportCase, message };
}

export function confirmSupportStatusChanged(
  status: number,
  payload: unknown,
  caseId: string,
  expectedStatus: SupportCaseStatus,
): SupportCaseData | null {
  if (status !== 200 || !isRecord(payload) || payload.success !== true) return null;
  const supportCase = parseCase(payload.supportCase);
  if (!supportCase || supportCase.id !== caseId || supportCase.status !== expectedStatus) return null;
  return supportCase;
}
