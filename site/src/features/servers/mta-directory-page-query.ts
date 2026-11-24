const MTA_DIRECTORY_MIN_PLAYERS = [0, 1, 10, 50, 100] as const;
export type MtaDirectoryMinPlayers = (typeof MTA_DIRECTORY_MIN_PLAYERS)[number];

export type MtaDirectoryPageQuery = {
  query: string;
  minPlayers: MtaDirectoryMinPlayers;
  page: number;
};

type Input = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

function parseMinPlayers(raw: string | undefined): MtaDirectoryMinPlayers {
  const value = Number(raw);
  return MTA_DIRECTORY_MIN_PLAYERS.includes(value as MtaDirectoryMinPlayers)
    ? (value as MtaDirectoryMinPlayers)
    : 0;
}

export function parseMtaDirectoryPageQuery(input: Input): MtaDirectoryPageQuery {
  const rawPage = first(input.page) ?? "1";
  const page = /^\d{1,4}$/u.test(rawPage) ? Math.min(Math.max(Number(rawPage), 1), 1000) : 1;
  const query = (first(input.q) ?? "").trim().slice(0, 100);
  const minPlayers = parseMinPlayers(first(input.minPlayers));
  return { query, minPlayers, page };
}

export function parseMtaDirectoryApiQuery(params: URLSearchParams): MtaDirectoryPageQuery | null {
  const input: Input = {};
  for (const key of ["q", "page", "minPlayers"] as const) {
    const values = params.getAll(key);
    if (values.length > 1) return null;
    input[key] = values[0];
  }
  const rawPage = input.page;
  if (rawPage && (!/^[1-9]\d{0,3}$/u.test(rawPage as string) || Number(rawPage) > 1000)) {
    return null;
  }
  if ((input.q as string | undefined)?.length && (input.q as string).length > 100) return null;
  const min = first(input.minPlayers);
  if (min && !MTA_DIRECTORY_MIN_PLAYERS.includes(Number(min) as MtaDirectoryMinPlayers)) {
    return null;
  }
  return parseMtaDirectoryPageQuery(input);
}

export function mtaDirectoryHref(
  state: Partial<MtaDirectoryPageQuery> & Pick<MtaDirectoryPageQuery, "query" | "minPlayers">,
  path = "/servers",
): string {
  const normalized = parseMtaDirectoryPageQuery({
    q: state.query,
    minPlayers: String(state.minPlayers),
    page: String(state.page ?? 1),
  });
  const params = new URLSearchParams();
  if (normalized.query) params.set("q", normalized.query);
  if (normalized.minPlayers > 0) params.set("minPlayers", String(normalized.minPlayers));
  if (normalized.page > 1) params.set("page", String(normalized.page));
  return params.size ? `${path}?${params}` : path;
}
