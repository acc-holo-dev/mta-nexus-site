// PostgreSQL LIKE treats %, _ and backslash as pattern syntax. Public search
// accepts them as literal characters, just like JavaScript includes().
export function containsPattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, "\\$&")}%`;
}
