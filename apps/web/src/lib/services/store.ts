import {
  initialUsers,
  initialOrganizations,
  initialServers,
  initialProducts,
  initialBuilds,
  initialLicenses,
  initialArticles,
  initialComments,
  initialAuditLogs,
  initialReports,
} from "./mock-data";
import type {
  User,
  Organization,
  Server,
  Product,
  Build,
  License,
  Order,
  Payment,
  LedgerEntry,
  Content,
  Comment,
  AuditEvent,
  Report,
} from "@nexus/domain";

// In-Memory Global Store singleton (survives hot reload in development)
class NexusDataStore {
  public users: Map<string, User> = new Map();
  public organizations: Map<string, Organization> = new Map();
  public servers: Map<string, Server> = new Map();
  public products: Map<string, Product> = new Map();
  public builds: Map<string, Build> = new Map();
  public licenses: Map<string, License> = new Map();
  public orders: Map<string, Order> = new Map();
  public payments: Map<string, Payment> = new Map();
  public ledgerEntries: LedgerEntry[] = [];
  public content: Map<string, Content> = new Map();
  public comments: Map<string, Comment> = new Map();
  public auditEvents: AuditEvent[] = [];
  public reports: Map<string, Report> = new Map();
  public sessions: Map<string, { userId: string; expiresAt: Date }> = new Map();

  constructor() {
    this.seed();
  }

  public seed() {
    initialUsers.forEach((u) => this.users.set(u.id, { ...u }));
    initialOrganizations.forEach((o) => this.organizations.set(o.id, { ...o }));
    initialServers.forEach((s) => this.servers.set(s.id, { ...s }));
    initialProducts.forEach((p) => this.products.set(p.id, { ...p }));
    initialBuilds.forEach((b) => this.builds.set(b.id, { ...b }));
    initialLicenses.forEach((l) => this.licenses.set(l.id, { ...l }));
    initialArticles.forEach((a) => this.content.set(a.id, { ...a }));
    initialComments.forEach((c) => this.comments.set(c.id, { ...c }));
    this.auditEvents = [...initialAuditLogs];
    initialReports.forEach((r) => this.reports.set(r.id, { ...r }));

    // Pre-seed an active demo session for instant interactive testing
    this.sessions.set("session_demo_admin", {
      userId: "usr_admin_001",
      expiresAt: new Date(Date.now() + 86400000 * 30),
    });
  }
}

// Global variable pattern for Next.js hot reload safety
const globalForStore = globalThis as unknown as { nexusStore?: NexusDataStore };

export const store = globalForStore.nexusStore ?? new NexusDataStore();

if (process.env.NODE_ENV !== "production") {
  globalForStore.nexusStore = store;
}
