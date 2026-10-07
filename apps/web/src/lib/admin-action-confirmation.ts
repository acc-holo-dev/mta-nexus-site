export function confirmsAdminAction(
  status: number,
  body: unknown,
  targetId: string,
  action: string,
): boolean {
  if (
    !Number.isSafeInteger(status) ||
    status < 200 ||
    status >= 300 ||
    !body ||
    typeof body !== "object"
  ) {
    return false;
  }

  const value = body as Record<string, unknown>;
  return (
    value.success === true &&
    value.targetId === targetId &&
    value.action === action
  );
}
