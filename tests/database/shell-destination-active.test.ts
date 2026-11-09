import { expect, it } from "vitest";
import { shellDestinationActive } from "../../apps/web/src/components/shell-destination-policy";

it("keeps one current shell destination for nested workspace routes", () => {
  expect(shellDestinationActive("/workspace", "/workspace")).toBe(true);
  expect(shellDestinationActive("/workspace", "/workspace/library")).toBe(false);
  expect(shellDestinationActive("/workspace/servers", "/workspace/servers/new")).toBe(false);
  expect(shellDestinationActive("/workspace/servers/new", "/workspace/servers/new")).toBe(true);
  expect(shellDestinationActive("/workspace/servers", "/workspace/servers/srv_1")).toBe(true);
  expect(shellDestinationActive("/settings", "/settings/developer")).toBe(false);
  expect(shellDestinationActive("/settings/developer", "/settings/developer")).toBe(true);
  expect(shellDestinationActive("/settings", "/settings/privacy")).toBe(true);
  expect(shellDestinationActive("/", "/")).toBe(true);
  expect(shellDestinationActive("/", "/market")).toBe(false);
});
