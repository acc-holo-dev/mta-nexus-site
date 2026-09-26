import {
  userRepository,
  sessionRepository,
  organizationRepository,
  authRepository,
  auditRepository,
  accountEmailEnrollmentRepository,
  accountRecoveryAbuseLimitRepository,
  getPinnedAccountMailProducerCipher,
  getPinnedAccountRecoveryAbuseKey,
  accountPasswordResetRepository,
} from "@nexus/db";
import {
  generateId,
  generateSessionToken,
  hashPassword,
  normalizeEmailForAbuse,
  verifyPassword,
} from "@nexus/security";
import {
  NotFoundError,
  UnauthorizedError,
  ConflictError,
  ForbiddenError,
  RateLimitExceededError,
} from "@nexus/domain";
import type { User } from "@nexus/domain";

function toPublicUser(user: User & { passwordHash?: string | null }): User {
  const { passwordHash: _, ...publicUser } = user;
  return publicUser as User;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

export class AuthService {
  async register(input: {
    email: string;
    username: string;
    password: string;
    displayName?: string;
  }): Promise<{ user: User; token: string }> {
    const existingEmail = await userRepository.findByEmail(input.email);
    if (existingEmail) {
      throw new ConflictError("A user with this email already exists");
    }

    const existingUsername = await userRepository.findByUsername(input.username);
    if (existingUsername) {
      throw new ConflictError("This username is already taken");
    }

    const userId = generateId("usr");
    const passwordHash = await hashPassword(input.password);
    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + 86400000 * 14);

    try {
      const user = await authRepository.registerAccount({
        user: {
          id: userId,
          email: input.email,
          username: input.username,
          displayName: input.displayName || input.username,
          passwordHash,
        },
        session: {
          id: generateId("ses"),
          userId,
          token,
          expiresAt,
        },
        audit: {
          id: generateId("aud"),
          actorId: userId,
          actorType: "user",
          action: "user.registered",
          targetId: userId,
          targetType: "user",
          details: { email: input.email.toLowerCase() },
        },
      });
      return { user: toPublicUser(user), token };
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictError("Email or username is already registered");
      }
      throw error;
    }
  }

  async login(input: {
    email: string;
    password: string;
  }): Promise<{ user: User; token: string }> {
    const userWithHash = await userRepository.findByEmail(input.email);
    if (!userWithHash || !userWithHash.passwordHash) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const isMatch = await verifyPassword(input.password, userWithHash.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + 86400000 * 14);

    await authRepository.createLoginSession(
      {
        id: generateId("ses"),
        userId: userWithHash.id,
        token,
        expiresAt,
      },
      {
        id: generateId("aud"),
        actorId: userWithHash.id,
        actorType: "user",
        action: "user.logged_in",
        targetId: userWithHash.id,
        targetType: "user",
        details: { email: userWithHash.email },
      },
      userWithHash.passwordHash
    );

    return { user: toPublicUser(userWithHash), token };
  }

  async getSession(token?: string | null): Promise<User | null> {
    if (!token) return null;
    const result = await sessionRepository.findValidSession(token);
    return result ? toPublicUser(result.user) : null;
  }

  async logout(token: string): Promise<void> {
    const session = await sessionRepository.findValidSession(token);
    if (!session) {
      await sessionRepository.delete(token);
      return;
    }

    await authRepository.revokeSession(token, {
      id: generateId("aud"),
      actorId: session.user.id,
      actorType: "user",
      action: "user.logged_out",
      targetId: session.user.id,
      targetType: "user",
    });
  }

  async changePassword(input: {
    userId: string;
    currentPassword: string;
    newPassword: string;
    currentToken: string;
  }): Promise<{ revokedSessionCount: number; token: string; expiresAt: Date }> {
    const user = await userRepository.findById(input.userId);
    if (!user) throw new NotFoundError("User", input.userId);

    const stored = await userRepository.findByEmail(user.email);
    if (!stored?.passwordHash || !(await verifyPassword(input.currentPassword, stored.passwordHash))) {
      throw new UnauthorizedError("Current password is incorrect");
    }

    const passwordHash = await hashPassword(input.newPassword);
    const token = generateSessionToken();
    const changed = await authRepository.changePassword({
      userId: input.userId,
      expectedPasswordHash: stored.passwordHash,
      passwordHash,
      currentToken: input.currentToken,
      nextToken: token,
      audit: {
        id: generateId("aud"),
        actorId: input.userId,
        actorType: "user",
        action: "user.password_changed",
        targetId: input.userId,
        targetType: "user",
      },
    });
    return { ...changed, token };
  }

  async getRecoveryEmailStatus(userId: string) {
    return accountEmailEnrollmentRepository.status(userId);
  }

  async requestRecoveryEmailVerification(input: {
    userId: string;
    currentToken: string;
    currentPassword: string;
  }): Promise<{ accepted: boolean; alreadyVerified: boolean; challengeId?: string; expiresAt?: Date }> {
    const status = await accountEmailEnrollmentRepository.status(input.userId);
    if (!status) throw new NotFoundError("User", input.userId);
    if (!status.eligible) throw new ForbiddenError("Recovery email verification is unavailable for this account");
    if (status.verified) return { accepted: false, alreadyVerified: true };

    const limit = await accountRecoveryAbuseLimitRepository.consume({
      scope: "email_verify_request",
      subject: `user:${input.userId}`,
      key: getPinnedAccountRecoveryAbuseKey(),
      limit: 5,
      windowSeconds: 3600,
    });
    if (!limit.success) throw new RateLimitExceededError("Too many email verification attempts. Please try again later.");

    const stored = await userRepository.findByEmail(status.email);
    if (!stored?.passwordHash || !(await verifyPassword(input.currentPassword, stored.passwordHash))) {
      throw new UnauthorizedError("Current password is incorrect");
    }

    const queued = await accountEmailEnrollmentRepository.request({
      userId: input.userId,
      currentToken: input.currentToken,
      expectedPasswordHash: stored.passwordHash,
      auditId: generateId("aud"),
      cipher: getPinnedAccountMailProducerCipher(),
    });
    return { accepted: true, alreadyVerified: false, challengeId: queued.challengeId, expiresAt: queued.expiresAt };
  }

  async confirmRecoveryEmailVerification(input: {
    userId: string;
    currentToken: string;
    challengeId: string;
    token: string;
  }): Promise<{ email: string; verifiedAt: Date }> {
    const status = await accountEmailEnrollmentRepository.status(input.userId);
    if (!status) throw new NotFoundError("User", input.userId);
    if (!status.eligible) throw new ForbiddenError("Recovery email verification is unavailable for this account");
    const stored = await userRepository.findByEmail(status.email);
    if (!stored?.passwordHash) throw new ForbiddenError("Recovery email verification is unavailable for this account");
    return accountEmailEnrollmentRepository.confirm({
      userId: input.userId,
      currentToken: input.currentToken,
      expectedPasswordHash: stored.passwordHash,
      challengeId: input.challengeId,
      token: input.token,
      consumeAuditId: generateId("aud"),
      bindingAuditId: generateId("aud"),
    });
  }

  async requestPasswordReset(input: {
    email: string;
    ip: string;
  }): Promise<{ accepted: true }> {
    // Read dedicated configuration before account lookup so missing production
    // wiring cannot reveal whether a valid address exists.
    const cipher = getPinnedAccountMailProducerCipher();
    const abuseKey = getPinnedAccountRecoveryAbuseKey();
    const email = input.email.trim().toLowerCase();
    const abuseEmail = normalizeEmailForAbuse(input.email);
    const ip = input.ip.trim() || "unknown";

    const [emailLimit, ipLimit] = await Promise.all([
      accountRecoveryAbuseLimitRepository.consume({
        scope: "password_reset_request",
        subject: `email:${abuseEmail}`,
        key: abuseKey,
        limit: 3,
        windowSeconds: 3600,
      }),
      accountRecoveryAbuseLimitRepository.consume({
        scope: "password_reset_request",
        subject: `ip:${ip}`,
        key: abuseKey,
        limit: 20,
        windowSeconds: 3600,
      }),
    ]);

    if (!emailLimit.success || !ipLimit.success) return { accepted: true };

    const user = await userRepository.findByEmail(email);
    if (!user) return { accepted: true };
    const status = await accountEmailEnrollmentRepository.status(user.id);
    if (!status?.verified || !status.eligible) return { accepted: true };

    try {
      await accountPasswordResetRepository.request({
        userId: user.id,
        auditId: generateId("aud"),
        cipher,
      });
    } catch {
      // Queue/binding races after the neutral eligibility check must not become
      // an address-existence oracle. Operational health is monitored separately.
      console.error("Password reset mail could not be queued");
    }
    return { accepted: true };
  }

  async confirmPasswordReset(input: {
    challengeId: string;
    token: string;
    newPassword: string;
    ip: string;
    consumeAuditId?: string;
  }): Promise<{ revokedSessionCount: number }> {
    const confirmLimit = await accountRecoveryAbuseLimitRepository.consume({
      scope: "password_reset_confirm",
      subject: `ip:${input.ip.trim() || "unknown"}`,
      key: getPinnedAccountRecoveryAbuseKey(),
      limit: 30,
      windowSeconds: 15 * 60,
    });
    if (!confirmLimit.success) {
      throw new RateLimitExceededError("Invalid or expired password reset");
    }

    // Reject random/expired/replayed proofs before doing the expensive password
    // hash. The final consume transaction still repeats all security checks.
    await accountPasswordResetRepository.assertLiveProof({
      challengeId: input.challengeId,
      token: input.token,
    });

    // Hash outside the proof transaction: scrypt must not hold DB locks.
    const passwordHash = await hashPassword(input.newPassword);
    return accountPasswordResetRepository.confirm({
      challengeId: input.challengeId,
      token: input.token,
      passwordHash,
      consumeAuditId: input.consumeAuditId ?? generateId("aud"),
      resetAuditId: generateId("aud"),
      notificationId: generateId("not"),
    });
  }

  async getCurrentSessionId(token?: string | null): Promise<string | null> {
    if (!token) return null;
    const current = await sessionRepository.findValidSession(token);
    return current?.session.id ?? null;
  }

  async listSessions(userId: string) {
    return sessionRepository.listByUser(userId);
  }

  async revokeSession(userId: string, sessionId: string, currentToken: string): Promise<boolean> {
    return authRepository.revokeOwnedSession({
      userId, sessionId, currentToken, auditId: generateId("aud"),
    });
  }

  async revokeOtherSessions(userId: string, currentToken: string): Promise<number> {
    return authRepository.revokeOtherSessions({
      userId, currentToken, auditId: generateId("aud"),
    });
  }

  async switchContext(userId: string, contextId: string): Promise<User> {
    const nextContextId = contextId.trim();
    if (!nextContextId) throw new ForbiddenError("A context is required");

    const updated = await authRepository.switchContext({
      userId,
      contextId: nextContextId,
      auditId: generateId("aud"),
    });
    return toPublicUser(updated);
  }

  async getUserById(id: string): Promise<User | null> {
    const user = await userRepository.findById(id);
    return user ? toPublicUser(user) : null;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const user = await userRepository.findByUsername(username);
    return user ? toPublicUser(user) : null;
  }

  async listDevelopers(limit = 100): Promise<User[]> {
    const users = await userRepository.listDevelopers(limit);
    return users.map((user) => toPublicUser(user));
  }

  async listUsers(): Promise<User[]> {
    const users = await userRepository.listAll();
    return users.map((user) => toPublicUser(user));
  }
}

export const authService = new AuthService();
