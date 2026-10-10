import { organizationWorkspaceRepository } from "@nexus/db";
import { AppError } from "@nexus/domain";
import type { User } from "@nexus/domain";
import { generateId } from "@nexus/security";
import { safeExternalWebUrl } from "@nexus/validation";
import {
  organizationCreateSchema,
  organizationUpdateSchema,
  memberAddSchema,
  memberUpdateSchema,
  memberRemoveSchema,
} from "../organization-workspace-contract";
import type { z } from "zod";
type StoredOrganization = Awaited<ReturnType<typeof organizationWorkspaceRepository.create>>;
function editableOrganization(value: StoredOrganization) {
  return {
    id: value.id,
    slug: value.slug,
    name: value.name,
    description: value.description ?? "",
    logoUrl: safeExternalWebUrl(value.logoUrl) ?? "",
    websiteUrl: safeExternalWebUrl(value.websiteUrl) ?? "",
    ownerId: value.ownerId,
    isVerified: value.isVerified,
    updatedAt: value.updatedAt.toISOString(),
  };
}
function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new AppError("Invalid organization data", 400, "VALIDATION_ERROR");
  return result.data;
}
function audit(user: User, id: string, action: string) {
  return {
    id: generateId("aud"),
    actorId: user.id,
    actorType: "user" as const,
    targetId: id,
    targetType: "organization",
    action,
  };
}
class OrganizationWorkspaceService {
  async list(user: User, page: number, query: string) {
    const result = await organizationWorkspaceRepository.pageMine(user.id, page, query);
    return {
      ...result,
      items: result.items.map((value) => ({ ...editableOrganization(value), role: value.role })),
    };
  }
  async get(id: string, user: User, page: number, query: string) {
    const result = await organizationWorkspaceRepository.getWorkspace(id, user.id, page, query);
    const identity = <T extends { avatarUrl: string | null }>(value: T) => ({
      ...value,
      avatarUrl: safeExternalWebUrl(value.avatarUrl) ?? null,
    });
    return {
      ...result,
      organization: editableOrganization(result.organization),
      owner: result.owner ? identity(result.owner) : null,
      members: result.members.map((value) => ({
        ...identity(value),
        joinedAt: value.joinedAt.toISOString(),
      })),
    };
  }
  async create(input: unknown, user: User) {
    const { slug, ...fields } = parse(organizationCreateSchema, input);
    const id = generateId("org");
    try {
      return editableOrganization(
        await organizationWorkspaceRepository.create(
          id,
          user.id,
          slug,
          fields,
          audit(user, id, "organization.created"),
        ),
      );
    } catch (error) {
      const candidate = error as { code?: string; cause?: { code?: string } };
      if (candidate?.code === "23505" || candidate?.cause?.code === "23505")
        throw new AppError("Organization address in use", 409, "SLUG_CONFLICT");
      throw error;
    }
  }
  async update(id: string, input: unknown, user: User) {
    const { expectedUpdatedAt, ...fields } = parse(organizationUpdateSchema, input);
    return editableOrganization(
      await organizationWorkspaceRepository.updateProfile(
        id,
        user.id,
        new Date(expectedUpdatedAt),
        fields,
        audit(user, id, "organization.profile_updated"),
      ),
    );
  }
  async add(id: string, input: unknown, user: User) {
    const fields = parse(memberAddSchema, input);
    const result = await organizationWorkspaceRepository.addMember(
      id,
      user.id,
      new Date(fields.expectedUpdatedAt),
      fields.username,
      fields.role,
      fields.managesServers,
      generateId("mem"),
      audit(user, id, "organization.member_added"),
    );
    return {
      ...result,
      organization: editableOrganization(result.organization),
      member: { ...result.member, avatarUrl: safeExternalWebUrl(result.member.avatarUrl) ?? null },
    };
  }
  async leave(id: string, input: unknown, user: User) {
    const { expectedUpdatedAt } = parse(memberRemoveSchema, input);
    const result = await organizationWorkspaceRepository.leave(
      id,
      user.id,
      new Date(expectedUpdatedAt),
      audit(user, id, "organization.member_left"),
    );
    return { ...result, organization: editableOrganization(result.organization) };
  }

  async change(id: string, userId: string, input: unknown, user: User, remove = false) {
    const fields = remove ? null : parse(memberUpdateSchema, input);
    const expectedUpdatedAt =
      fields?.expectedUpdatedAt ?? parse(memberRemoveSchema, input).expectedUpdatedAt;
    const result = await organizationWorkspaceRepository.changeMember(
      id,
      user.id,
      new Date(expectedUpdatedAt),
      userId,
      fields ? { role: fields.role, managesServers: fields.managesServers } : null,
      audit(user, id, remove ? "organization.member_removed" : "organization.member_updated"),
    );
    return { ...result, organization: editableOrganization(result.organization) };
  }
}
export const organizationWorkspaceService = new OrganizationWorkspaceService();
