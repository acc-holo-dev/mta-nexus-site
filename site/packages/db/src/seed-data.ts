import type { users, organizations, servers, products, builds, licenses, content } from "./schema";
import type { ensureSeedArchives } from "./seed-archive";

export function createSeedData(
  defaultPasswordHash: string,
  archives: Awaited<ReturnType<typeof ensureSeedArchives>>,
) {
  const admin = {
    id: "usr_admin_001",
    email: "admin@mta-nexus.com",
    username: "nexus_admin",
    displayName: "Nexus Master Admin",
    passwordHash: defaultPasswordHash,
    role: "admin",
    bio: "Official System Administrator & Core Architect of MTA Nexus.",
    isVerified: true,
    emailVerified: true,
  } satisfies typeof users.$inferInsert;

  const dev = {
    id: "usr_dev_001",
    email: "horizon@mta-nexus.com",
    username: "horizon_dev",
    displayName: "Horizon Studio Lead",
    passwordHash: defaultPasswordHash,
    role: "developer",
    bio: "Fullstack Lua & C++ MTA developer. Creating high-performance networked resources since 2014.",
    isVerified: true,
    emailVerified: true,
  } satisfies typeof users.$inferInsert;

  const serverOwner = {
    id: "usr_server_001",
    email: "owner@sadrift.com",
    username: "drift_king",
    displayName: "SA Drift King",
    passwordHash: defaultPasswordHash,
    role: "server_owner",
    bio: "Founder of SA Drift Paradise & MTA competitive organizer.",
    isVerified: true,
    emailVerified: true,
  } satisfies typeof users.$inferInsert;

  const player = {
    id: "usr_player_001",
    email: "player@example.com",
    username: "speedy_cj",
    displayName: "Speedy Carl",
    passwordHash: defaultPasswordHash,
    role: "user",
    bio: "Passionate MTA racer and asset collector.",
    isVerified: false,
    emailVerified: true,
  } satisfies typeof users.$inferInsert;

  const organization = {
    id: "org_horizon",
    name: "Horizon Interactive",
    slug: "horizon-interactive",
    description:
      "Premium engineering group specialized in custom MTA:SA systems and synchronization modules.",
    ownerId: dev.id,
  } satisfies typeof organizations.$inferInsert;

  const driftServer = {
    id: "srv_drift_01",
    name: "SA Drift Paradise | Season 8",
    slug: "sa-drift-paradise",
    description:
      "The #1 Drift & Touge server in MTA:SA with custom handling, realistic physics, multiplayer tandem battles, and over 400 custom tuned vehicles.",
    ipAddress: "play.sadrift.com",
    port: 22003,
    httpPort: 22005,
    gameMode: "Drift / Touge / Racing",
    mapName: "San Fierro & Ebisu Minami",
    maxPlayers: 500,
    currentPlayers: 342,
    ownerId: serverOwner.id,
    status: "active",
    visibility: "public",
    isVerified: true,
  } satisfies typeof servers.$inferInsert;

  const rpServer = {
    id: "srv_horizon_rp",
    name: "Horizon Roleplay: Los Santos 2026",
    slug: "horizon-roleplay",
    description:
      "Hardcore text & voice roleplay server with dynamic economy, inventory physics, faction warfare, and authentic government mechanics.",
    ipAddress: "rp.horizon-mta.com",
    port: 22003,
    httpPort: 22005,
    gameMode: "Hardcore Roleplay",
    mapName: "Los Santos Remastered",
    maxPlayers: 1000,
    currentPlayers: 789,
    ownerId: dev.id,
    organizationId: "org_horizon",
    status: "active",
    visibility: "public",
    isVerified: true,
  } satisfies typeof servers.$inferInsert;

  const prodInv = {
    id: "prd_inv_pro",
    title: "Nexus Grid Inventory & Crafting v3",
    slug: "nexus-grid-inventory-pro",
    shortDescription:
      "DEMO: download fixture only. Ultra-responsive grid inventory with drag-and-drop, weight physics, durability, attachments, and 3D item preview.",
    description:
      "DEMO: download fixture only, no functional product implementation. State-of-the-art grid inventory engine built exclusively for modern MTA:SA servers with sub-inventories and server-authoritative replication.",
    type: "script",
    status: "published",
    authorId: dev.id,
    organizationId: "org_horizon",
    price: 0,
    currency: "USD",
    licenseModel: "unlimited",
    tags: ["inventory", "crafting", "ui", "roleplay", "networking"],
    currentVersion: "3.2.0",
    ratingAverage: 49,
    ratingCount: 52,
    salesCount: 148,
    isFeatured: true,
    screenshots: [],
    compatibility: {
      mtaMinVersion: "1.6.0",
      dependencies: [],
    },
  } satisfies typeof products.$inferInsert;

  const prodDrift = {
    id: "prd_drift_physics",
    title: "Apex Drift Handling & Telemetry Suite",
    slug: "apex-drift-handling-suite",
    shortDescription:
      "DEMO: download fixture only. Pro-level dynamic handling adjustments, angle-speed angle multiplier scoring, smoke particle density, and live telemetry overlay.",
    description:
      "DEMO: download fixture only, no functional product implementation. Turn any MTA server into an adrenaline-filled drift spectacle with 85+ calibrated vehicle handling presets and live DX telemetry HUD.",
    type: "script",
    status: "published",
    authorId: dev.id,
    organizationId: "org_horizon",
    price: 0,
    currency: "USD",
    licenseModel: "unlimited",
    tags: ["drift", "handling", "vehicles", "physics", "telemetry"],
    currentVersion: "2.1.4",
    ratingAverage: 48,
    ratingCount: 38,
    salesCount: 215,
    isFeatured: true,
    screenshots: [],
    compatibility: {
      mtaMinVersion: "1.5.9",
      dependencies: [],
    },
  } satisfies typeof products.$inferInsert;

  const inventoryBuild = {
    id: "bld_inv_320",
    productId: prodInv.id,
    version: "3.2.0",
    releaseNotes:
      "Development demo archive for claim/download testing; no inventory implementation included.",
    status: "published",
    ...archives.inventory,
    mtaVersionTarget: "1.6.0",
    fileName: "resource.zip",
    mimeType: "application/zip",
    scanStatus: "clean",
    scanner: "seed-manual-review",
    scannedAt: new Date(),
    isSigned: false,
  } satisfies typeof builds.$inferInsert;

  const license = {
    id: "lic_user_001",
    key: "NX-INV-7F89-A2C4-9981",
    productId: prodInv.id,
    userId: serverOwner.id,
    serverId: "srv_drift_01",
    model: "single_server",
    status: "active",
    entitlements: ["server.run", "updates.download", "support.priority"],
  } satisfies typeof licenses.$inferInsert;

  const article = {
    id: "cnt_art_001",
    title: "MTA:SA High-Concurrence Network Optimization: Lessons from 1000 Players",
    slug: "mta-high-concurrence-network-optimization",
    excerpt:
      "How we reduced tick latency and packet loss by 68% on 1000 player servers through binary serialization and selective synchronization.",
    body: "Running a 1,000 player concurrent server in MTA:SA is no longer science fiction. In this deep dive we explore spatial grid broadcast and binary payload packing.",
    type: "article",
    authorId: dev.id,
    serverId: "srv_horizon_rp",
    organizationId: "org_horizon",
    status: "published",
    viewCount: 4210,
    likeCount: 312,
    commentCount: 28,
    tags: ["networking", "performance", "optimization", "c++", "lua"],
  } satisfies typeof content.$inferInsert;

  const driftBuild = {
    id: "bld_drift_214",
    productId: prodDrift.id,
    version: "2.1.4",
    releaseNotes:
      "Development demo archive for claim/download testing; no handling implementation included.",
    status: "published",
    ...archives.drift,
    fileName: "resource.zip",
    mimeType: "application/zip",
    mtaVersionTarget: "1.5.9",
    scanStatus: "clean",
    scanner: "seed-manual-review",
    scannedAt: new Date(),
    isSigned: false,
  } satisfies typeof builds.$inferInsert;
  return {
    users: [admin, dev, serverOwner, player],
    organizations: [organization],
    servers: [driftServer, rpServer],
    products: [prodInv, prodDrift],
    builds: [inventoryBuild, driftBuild],
    licenses: [license],
    content: [article],
  };
}
export type SeedData = ReturnType<typeof createSeedData>;
