/**
 * Keys for value-only lists without database IDs. Equal values remain separate
 * occurrences; inserting or moving a different value does not change their keys.
 * Stateful entities should use their own persistent IDs instead.
 */
export function withOccurrenceKeys<T>(
  items: readonly T[],
  identity: (item: T) => string,
): Array<{ key: string; item: T }> {
  const counts = new Map<string, number>();
  return items.map((item) => {
    const value = identity(item);
    const occurrence = counts.get(value) ?? 0;
    counts.set(value, occurrence + 1);
    return { key: JSON.stringify([value, occurrence]), item };
  });
}
