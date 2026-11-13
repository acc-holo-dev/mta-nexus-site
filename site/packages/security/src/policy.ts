import { grantsServerManagement } from "@nexus/domain";
import type { User, Product, Server, License, Content } from "@nexus/domain";

export type Action =
  | "admin.access"
  | "admin.moderation"
  | "admin.audit"
  | "product.create"
  | "product.update"
  | "product.delete"
  | "product.publish"
  | "build.release"
  | "build.retire"
  | "server.create"
  | "server.manage"
  | "server.delete"
  | "license.view"
  | "license.revoke"
  | "content.create"
  | "content.update"
  | "content.delete"
  | "organization.manage";

export const ACTIONS = [
  "admin.access",
  "admin.moderation",
  "admin.audit",
  "product.create",
  "product.update",
  "product.delete",
  "product.publish",
  "build.release",
  "build.retire",
  "server.create",
  "server.manage",
  "server.delete",
  "license.view",
  "license.revoke",
  "content.create",
  "content.update",
  "content.delete",
  "organization.manage",
] as const satisfies readonly Action[];

const STATIC_ROLE_CAPABILITIES: Record<User["role"], readonly Action[]> = {
  user: ["server.create", "content.create"],
  developer: ["product.create", "server.create", "content.create"],
  server_owner: ["server.create", "content.create"],
  moderator: ["admin.access", "admin.moderation", "content.create"],
  admin: ACTIONS,
};

export function getStaticCapabilities(role: User["role"]): readonly Action[] {
  return STATIC_ROLE_CAPABILITIES[role];
}

export interface PolicyContext {
  organizationMemberships?: { organizationId: string; role: string; permissions: string[] }[];
}

/**
 * Universal server-side policy function: can(user, action, resource, context)
 */
export function can(
  user: User | null | undefined,
  action: Action,
  resource?: unknown,
  context?: PolicyContext,
): boolean {
  if (!user) {
    return false;
  }

  // Super-admin override for maintenance
  if (user.role === "admin") {
    return true;
  }

  if (getStaticCapabilities(user.role).includes(action)) {
    return true;
  }

  // Base permission checks by action
  switch (action) {
    case "admin.access":
    case "admin.moderation":
    case "admin.audit":
      return action === "admin.moderation" && user.role === "moderator";

    case "product.create":
      return user.role === "developer" || user.isVerified;

    case "product.update":
    case "product.delete":
    case "product.publish":
    case "build.release":
    case "build.retire": {
      if (!resource) return false;
      const product = resource as Partial<Product>;
      if (!product.organizationId && product.authorId === user.id) return true;
      if (product.organizationId && context?.organizationMemberships) {
        const mem = context.organizationMemberships.find(
          (m) => m.organizationId === product.organizationId,
        );
        if (
          mem &&
          (mem.role === "owner" ||
            mem.role === "admin" ||
            mem.permissions.includes("manage_products"))
        ) {
          return true;
        }
      }
      return false;
    }

    case "server.create":
      return true;

    case "server.manage":
    case "server.delete": {
      if (!resource) return false;
      const server = resource as Partial<Server>;
      if (!server.organizationId && server.ownerId === user.id) return true;
      if (server.organizationId && context?.organizationMemberships) {
        const mem = context.organizationMemberships.find(
          (m) => m.organizationId === server.organizationId,
        );
        if (grantsServerManagement(mem)) {
          return true;
        }
      }
      return false;
    }

    case "license.view": {
      if (!resource) return false;
      const license = resource as Partial<License>;
      return license.userId === user.id;
    }

    case "license.revoke": {
      return false;
    }

    case "content.create":
      return true;

    case "content.update":
    case "content.delete": {
      if (!resource) return false;
      const content = resource as Partial<Content>;
      if (content.authorId === user.id) return true;
      if (user.role === "moderator") return true;
      return false;
    }

    case "organization.manage": {
      if (!resource) return false;
      const orgId =
        typeof resource === "string"
          ? resource
          : typeof resource === "object" &&
              resource !== null &&
              "id" in resource &&
              typeof resource.id === "string"
            ? resource.id
            : undefined;
      if (!orgId) return false;
      if (context?.organizationMemberships) {
        const mem = context.organizationMemberships.find((m) => m.organizationId === orgId);
        return mem?.role === "owner" || mem?.role === "admin";
      }
      return false;
    }

    default:
      return false;
  }
}
