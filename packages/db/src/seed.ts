import { hashPassword } from "@nexus/security";
import {
  userRepository,
  organizationRepository,
  serverRepository,
  productRepository,
  buildRepository,
  licenseRepository,
  contentRepository,
  auditRepository,
} from "./repositories/index";

export async function runSeed() {
  console.log("Seeding MTA Nexus database with baseline records...");

  const defaultPasswordHash = await hashPassword("password123");

  // 1. Users
  const admin = await userRepository.create({
    id: "usr_admin_001",
    email: "admin@mta-nexus.com",
    username: "nexus_admin",
    displayName: "Nexus Master Admin",
    passwordHash: defaultPasswordHash,
    role: "admin",
    avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=nexus_admin",
    bio: "Official System Administrator & Core Architect of MTA Nexus.",
    isVerified: true,
    emailVerified: true,
  });

  const dev = await userRepository.create({
    id: "usr_dev_001",
    email: "horizon@mta-nexus.com",
    username: "horizon_dev",
    displayName: "Horizon Studio Lead",
    passwordHash: defaultPasswordHash,
    role: "developer",
    avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=horizon_dev",
    bio: "Fullstack Lua & C++ MTA developer. Creating high-performance networked resources since 2014.",
    isVerified: true,
    emailVerified: true,
  });

  const serverOwner = await userRepository.create({
    id: "usr_server_001",
    email: "owner@sadrift.com",
    username: "drift_king",
    displayName: "SA Drift King",
    passwordHash: defaultPasswordHash,
    role: "server_owner",
    avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=drift_king",
    bio: "Founder of SA Drift Paradise & MTA competitive organizer.",
    isVerified: true,
    emailVerified: true,
  });

  const player = await userRepository.create({
    id: "usr_player_001",
    email: "player@example.com",
    username: "speedy_cj",
    displayName: "Speedy Carl",
    passwordHash: defaultPasswordHash,
    role: "user",
    avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=speedy_cj",
    bio: "Passionate MTA racer and asset collector.",
    isVerified: false,
    emailVerified: true,
  });

  // 2. Organization
  await organizationRepository.create({
    id: "org_horizon",
    name: "Horizon Interactive",
    slug: "horizon-interactive",
    description: "Premium engineering group specialized in custom MTA:SA systems and synchronization modules.",
    logoUrl: "https://api.dicebear.com/7.x/shapes/svg?seed=horizon-interactive",
    websiteUrl: "https://horizon-mta.com",
    ownerId: dev.id,
  });

  // 3. Servers
  await serverRepository.create({
    id: "srv_drift_01",
    name: "SA Drift Paradise | Season 8",
    slug: "sa-drift-paradise",
    description: "The #1 Drift & Touge server in MTA:SA with custom handling, realistic physics, multiplayer tandem battles, and over 400 custom tuned vehicles.",
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
    bannerUrl: "https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?auto=format&fit=crop&w=1200&q=80",
    logoUrl: "https://api.dicebear.com/7.x/identicon/svg?seed=sa-drift-paradise",
  });

  await serverRepository.create({
    id: "srv_horizon_rp",
    name: "Horizon Roleplay: Los Santos 2026",
    slug: "horizon-roleplay",
    description: "Hardcore text & voice roleplay server powered by Nexus Runtime Module with dynamic economy, inventory physics, faction warfare, and authentic government mechanics.",
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
    bannerUrl: "https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=1200&q=80",
    logoUrl: "https://api.dicebear.com/7.x/identicon/svg?seed=horizon-roleplay",
  });

  // 4. Products
  const prodInv = await productRepository.create({
    id: "prd_inv_pro",
    title: "Nexus Grid Inventory & Crafting v3",
    slug: "nexus-grid-inventory-pro",
    shortDescription: "Ultra-responsive grid inventory with drag-and-drop, weight physics, durability, attachments, and 3D item preview.",
    description: "State-of-the-art grid inventory engine built exclusively for modern MTA:SA servers with sub-inventories and server-authoritative replication.",
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
    thumbnailUrl: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=600&q=80",
    screenshots: [
      "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80",
    ],
    compatibility: {
      mtaMinVersion: "1.6.0",
      moduleMinVersion: "1.0.0",
      dependencies: [],
    },
  });

  await productRepository.create({
    id: "prd_drift_physics",
    title: "Apex Drift Handling & Telemetry Suite",
    slug: "apex-drift-handling-suite",
    shortDescription: "Pro-level dynamic handling adjustments, angle-speed angle multiplier scoring, smoke particle density, and live telemetry overlay.",
    description: "Turn any MTA server into an adrenaline-filled drift spectacle with 85+ calibrated vehicle handling presets and live DX telemetry HUD.",
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
    thumbnailUrl: "https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=600&q=80",
    screenshots: [
      "https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=1200&q=80",
    ],
    compatibility: {
      mtaMinVersion: "1.5.9",
      dependencies: [],
    },
  });

  // 5. Builds
  await buildRepository.create({
    id: "bld_inv_320",
    productId: prodInv.id,
    version: "3.2.0",
    releaseNotes: "Optimized item synchronization payload size by 40% and added audio feedback.",
    status: "published",
    storageKey: "builds/prd_inv_pro/v3.2.0.zip",
    sha256Hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    fileSizeBytes: 4829104,
    mtaVersionTarget: "1.6.0",
    fileName: "resource.zip",
    mimeType: "application/zip",
    scanStatus: "clean",
    scanner: "seed-manual-review",
    scannedAt: new Date(),
    isSigned: false,
  });

  // 6. Licenses
  await licenseRepository.create({
    id: "lic_user_001",
    key: "NX-INV-7F89-A2C4-9981",
    productId: prodInv.id,
    userId: serverOwner.id,
    serverId: "srv_drift_01",
    model: "single_server",
    status: "active",
    entitlements: ["server.run", "updates.download", "support.priority"],
  });

  // 7. Content
  await contentRepository.create({
    id: "cnt_art_001",
    title: "MTA:SA High-Concurrence Network Optimization: Lessons from 1000 Players",
    slug: "mta-high-concurrence-network-optimization",
    excerpt: "How we reduced tick latency and packet loss by 68% on 1000 player servers through binary serialization and selective synchronization.",
    body: "Running a 1,000 player concurrent server in MTA:SA is no longer science fiction. In this deep dive we explore spatial grid broadcast and binary payload packing.",
    coverImageUrl: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=80",
    type: "article",
    authorId: dev.id,
    serverId: "srv_horizon_rp",
    organizationId: "org_horizon",
    status: "published",
    viewCount: 4210,
    likeCount: 312,
    commentCount: 28,
    tags: ["networking", "performance", "optimization", "c++", "lua"],
  });

  // 8. Audit Event
  await auditRepository.record({
    id: "aud_001",
    actorId: admin.id,
    actorType: "admin",
    action: "database.seeded",
    targetId: "system",
    targetType: "database",
    details: { baseline: "MTA Nexus 1.1 seed completed" },
  });

  console.log("Database seeded successfully.");
}

// Execute if called directly
runSeed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed error:", err);
    process.exit(1);
  });
