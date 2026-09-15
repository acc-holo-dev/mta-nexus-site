import type {
  User,
  Organization,
  Server,
  Product,
  Build,
  License,
  Content,
  Comment,
  AuditEvent,
  Report,
} from "@nexus/domain";

export const initialUsers: User[] = [
  {
    id: "usr_admin_001",
    email: "admin@mta-nexus.com",
    username: "nexus_admin",
    displayName: "Nexus Master Admin",
    avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=nexus_admin",
    bio: "Official System Administrator & Core Architect of MTA Nexus.",
    role: "admin",
    isVerified: true,
    emailVerified: true,
    twoFactorEnabled: true,
    activeContextId: "personal",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  },
  {
    id: "usr_dev_001",
    email: "horizon@mta-nexus.com",
    username: "horizon_dev",
    displayName: "Horizon Studio Lead",
    avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=horizon_dev",
    bio: "Fullstack Lua & C++ MTA developer. Creating high-performance networked resources since 2014.",
    role: "developer",
    isVerified: true,
    emailVerified: true,
    twoFactorEnabled: true,
    activeContextId: "org_horizon",
    createdAt: new Date("2026-02-10T12:00:00Z"),
    updatedAt: new Date("2026-02-10T12:00:00Z"),
  },
  {
    id: "usr_server_001",
    email: "owner@sadrift.com",
    username: "drift_king",
    displayName: "SA Drift King",
    avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=drift_king",
    bio: "Founder of SA Drift Paradise & MTA competitive organizer.",
    role: "server_owner",
    isVerified: true,
    emailVerified: true,
    twoFactorEnabled: false,
    activeContextId: "personal",
    createdAt: new Date("2026-03-01T08:00:00Z"),
    updatedAt: new Date("2026-03-01T08:00:00Z"),
  },
  {
    id: "usr_player_001",
    email: "player@example.com",
    username: "speedy_cj",
    displayName: "Speedy Carl",
    avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=speedy_cj",
    bio: "Passionate MTA racer and asset collector.",
    role: "user",
    isVerified: false,
    emailVerified: true,
    twoFactorEnabled: false,
    activeContextId: "personal",
    createdAt: new Date("2026-04-15T10:00:00Z"),
    updatedAt: new Date("2026-04-15T10:00:00Z"),
  },
];

export const initialOrganizations: Organization[] = [
  {
    id: "org_horizon",
    name: "Horizon Interactive",
    slug: "horizon-interactive",
    description: "Premium engineering group specialized in custom MTA:SA systems and synchronization modules.",
    logoUrl: "https://api.dicebear.com/7.x/shapes/svg?seed=horizon-interactive",
    websiteUrl: "https://horizon-mta.com",
    isVerified: true,
    ownerId: "usr_dev_001",
    createdAt: new Date("2026-02-10T12:00:00Z"),
    updatedAt: new Date("2026-02-10T12:00:00Z"),
  },
];

export const initialServers: Server[] = [
  {
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
    ownerId: "usr_server_001",
    status: "active",
    visibility: "public",
    isVerified: true,
    bannerUrl: "https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?auto=format&fit=crop&w=1200&q=80",
    logoUrl: "https://api.dicebear.com/7.x/identicon/svg?seed=sa-drift-paradise",
    createdAt: new Date("2026-03-01T08:00:00Z"),
    updatedAt: new Date("2026-03-01T08:00:00Z"),
  },
  {
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
    ownerId: "usr_dev_001",
    organizationId: "org_horizon",
    status: "active",
    visibility: "public",
    isVerified: true,
    bannerUrl: "https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=1200&q=80",
    logoUrl: "https://api.dicebear.com/7.x/identicon/svg?seed=horizon-roleplay",
    createdAt: new Date("2026-02-15T14:00:00Z"),
    updatedAt: new Date("2026-02-15T14:00:00Z"),
  },
  {
    id: "srv_zombie_exodus",
    name: "Exodus: DayZ Apocalypse Survival",
    slug: "exodus-dayz-apocalypse",
    description: "Survival sandbox with atmospheric weather, procedural loot zones, barricade base building, custom infected variants, and safe haven radio stations.",
    ipAddress: "survival.exodus-mta.net",
    port: 22003,
    httpPort: 22005,
    gameMode: "DayZ Survival",
    mapName: "Red County Exclusion Zone",
    maxPlayers: 250,
    currentPlayers: 198,
    ownerId: "usr_server_001",
    status: "active",
    visibility: "public",
    isVerified: false,
    bannerUrl: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1200&q=80",
    logoUrl: "https://api.dicebear.com/7.x/identicon/svg?seed=exodus-survival",
    createdAt: new Date("2026-03-20T11:00:00Z"),
    updatedAt: new Date("2026-03-20T11:00:00Z"),
  },
];

export const initialProducts: Product[] = [
  {
    id: "prd_inv_pro",
    title: "Nexus Grid Inventory & Crafting v3",
    slug: "nexus-grid-inventory-pro",
    shortDescription: "Ultra-responsive grid inventory with drag-and-drop, weight physics, durability, attachments, and 3D item preview.",
    description: `A state-of-the-art grid inventory engine built exclusively for modern MTA:SA servers.
    
### Core Features
- Full drag-and-drop item movement with rotational support (vertical/horizontal).
- Sub-inventories: backpacks, pockets, glove compartments, trunks, and floor containers.
- Dynamic weight calculations and slot dimensions.
- Server-authoritative anti-duplication verification loop.
- Full localization (EN, RU, ES, PL, PT).
- Integration ready with SQLite, MySQL, and PostgreSQL backends.`,
    type: "script",
    status: "published",
    authorId: "usr_dev_001",
    organizationId: "org_horizon",
    price: 3499, // $34.99
    currency: "USD",
    licenseModel: "single_server",
    tags: ["inventory", "crafting", "ui", "roleplay", "dx", "networking"],
    currentVersion: "3.2.0",
    ratingAverage: 49, // 4.9
    ratingCount: 52,
    salesCount: 148,
    isFeatured: true,
    thumbnailUrl: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=600&q=80",
    screenshots: [
      "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80",
    ],
    compatibility: {
      mtaMinVersion: "1.6.0",
      moduleMinVersion: "1.0.0",
      dependencies: ["nexus_module", "dx_library"],
    },
    createdAt: new Date("2026-02-12T10:00:00Z"),
    updatedAt: new Date("2026-03-01T15:30:00Z"),
  },
  {
    id: "prd_drift_physics",
    title: "Apex Drift Handling & Telemetry Suite",
    slug: "apex-drift-handling-suite",
    shortDescription: "Pro-level dynamic handling adjustments, angle-speed angle multiplier scoring, smoke particle density, and live telemetry overlay.",
    description: `Turn any MTA server into an adrenaline-filled drift spectacle. Includes over 85 calibrated vehicle handling presets, live slip-angle calculations, tandem distance detector, and a DX telemetry HUD showing RPM, boost, gear, and clutch slip.`,
    type: "script",
    status: "published",
    authorId: "usr_dev_001",
    organizationId: "org_horizon",
    price: 1999, // $19.99
    currency: "USD",
    licenseModel: "single_server",
    tags: ["drift", "handling", "vehicles", "physics", "telemetry"],
    currentVersion: "2.1.4",
    ratingAverage: 48, // 4.8
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
    createdAt: new Date("2026-02-20T16:00:00Z"),
    updatedAt: new Date("2026-03-10T12:00:00Z"),
  },
  {
    id: "prd_jdm_pack",
    title: "Kyoto Legends: 15 HQ JDM Tuner Vehicles",
    slug: "kyoto-legends-jdm-pack",
    shortDescription: "High quality, optimized 3D models with functional dials, custom engine bays, breakable glass, and 6 bodykit tuning variants per car.",
    description: `Optimized polygon counts for lag-free mass server events. Under 25MB DFF and TXD per vehicle with custom collision files (COL) and full SA lights / IVF lights support.`,
    type: "vehicle",
    status: "published",
    authorId: "usr_dev_001",
    price: 4999, // $49.99
    currency: "USD",
    licenseModel: "multiple_servers",
    tags: ["vehicles", "jdm", "tuning", "3d-models", "dff", "txd"],
    currentVersion: "1.4.0",
    ratingAverage: 50, // 5.0
    ratingCount: 24,
    salesCount: 89,
    isFeatured: false,
    thumbnailUrl: "https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&w=600&q=80",
    screenshots: [
      "https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&w=1200&q=80",
    ],
    compatibility: {
      mtaMinVersion: "1.5.8",
      dependencies: [],
    },
    createdAt: new Date("2026-03-05T09:00:00Z"),
    updatedAt: new Date("2026-03-05T09:00:00Z"),
  },
  {
    id: "prd_cef_phone",
    title: "AuraOS: Modular CEF Smartphone",
    slug: "aura-os-cef-smartphone",
    shortDescription: "Ultra-modern smartphone interface built with React, WebRTC in-game calling, camera photos uploaded to CDN, dark mode, and customizable apps.",
    description: `A next-generation in-game smartphone powered by MTA's Chromium Embedded Framework (CEF). Offers zero frame drops, smooth CSS animations, messaging, banking app, Twitter/Lifeinvader feed, and emergency dispatcher services.`,
    type: "ui",
    status: "published",
    authorId: "usr_dev_001",
    organizationId: "org_horizon",
    price: 3999, // $39.99
    currency: "USD",
    licenseModel: "single_server",
    tags: ["cef", "phone", "react", "ui", "roleplay", "webrtc"],
    currentVersion: "2.0.0",
    ratingAverage: 47, // 4.7
    ratingCount: 41,
    salesCount: 160,
    isFeatured: true,
    thumbnailUrl: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=600&q=80",
    screenshots: [
      "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1200&q=80",
    ],
    compatibility: {
      mtaMinVersion: "1.6.0",
      dependencies: ["cef_browser"],
    },
    createdAt: new Date("2026-01-25T18:00:00Z"),
    updatedAt: new Date("2026-03-12T14:20:00Z"),
  },
];

export const initialBuilds: Build[] = [
  {
    id: "bld_inv_320",
    productId: "prd_inv_pro",
    version: "3.2.0",
    releaseNotes: "- Optimized item synchronization payload size by 40%\n- Added audio feedback when moving metallic items\n- Fixed rare item duplication edge-case during high packet loss",
    status: "published",
    storageKey: "builds/prd_inv_pro/v3.2.0.zip",
    sha256Hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    fileSizeBytes: 4829104,
    mtaVersionTarget: "1.6.0",
    isSigned: true,
    createdAt: new Date("2026-03-01T15:30:00Z"),
  },
];

export const initialLicenses: License[] = [
  {
    id: "lic_user_001",
    key: "NX-INV-7F89-A2C4-9981",
    productId: "prd_inv_pro",
    userId: "usr_server_001",
    serverId: "srv_drift_01",
    model: "single_server",
    status: "active",
    expiresAt: undefined, // lifetime
    entitlements: ["server.run", "updates.download", "support.priority"],
    createdAt: new Date("2026-03-02T10:00:00Z"),
    updatedAt: new Date("2026-03-02T10:00:00Z"),
  },
];

export const initialArticles: Content[] = [
  {
    id: "cnt_art_001",
    title: "MTA:SA High-Concurrence Network Optimization: Lessons from 1000 Players",
    slug: "mta-high-concurrence-network-optimization",
    excerpt: "How we reduced tick latency and packet loss by 68% on 1000 player servers through binary serialization and selective synchronization.",
    body: `Running a 1,000 player concurrent server in MTA:SA is no longer science fiction. In this technical deep dive, we explore the architectural bottlenecks that cause lag spikes and how to solve them with modern runtime techniques.

## 1. The Cost of Element Data
Many scripters overuse \`setElementData\` with \`synchronize = true\`. When 1,000 players exist in the stream zone, every element data update broadcasts to hundreds of sockets.

### Better Approach: Selective Packet Routing
Instead of relying on element data, establish dedicated RPC channels that only send delta updates to clients inside the relevant spatial grid:

\`\`\`lua
-- Example: Spatial Grid Broadcast
function broadcastToGrid(gridX, gridY, eventName, ...)
    local subscribers = spatialGrids[gridX][gridY]
    if subscribers then
        triggerClientEvent(subscribers, eventName, resourceRoot, ...)
    end
end
\`\`\`

## 2. Compacting Lua Payloads
Text representations like JSON take significant bandwidth. Switching to binary bit-packing reduced our network footprint from 14 MB/s down to 2.8 MB/s.

## 3. The Nexus Runtime Module
With native C++ extensions, we offload heavy distance calculations and trajectory predictions to background worker threads, freeing the MTA main thread to maintain a constant 60 FPS.`,
    coverImageUrl: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=80",
    type: "article",
    authorId: "usr_dev_001",
    serverId: "srv_horizon_rp",
    organizationId: "org_horizon",
    status: "published",
    viewCount: 4210,
    likeCount: 312,
    commentCount: 28,
    tags: ["networking", "performance", "optimization", "c++", "lua"],
    publishedAt: new Date("2026-02-28T14:00:00Z"),
    createdAt: new Date("2026-02-28T14:00:00Z"),
    updatedAt: new Date("2026-02-28T14:00:00Z"),
  },
  {
    id: "cnt_art_002",
    title: "Building Modern CEF User Interfaces with React 19 and Tailwind CSS",
    slug: "building-cef-interfaces-react-tailwind",
    excerpt: "A complete step-by-step architecture guide to creating zero-latency, beautiful in-game web interfaces inside MTA's Chromium engine.",
    body: `CEF (Chromium Embedded Framework) allows MTA creators to build web-quality UIs inside the game engine. However, unoptimized DOM trees and unthrottled postMessage bridges can degrade game framerates.

Here is how we build sleek, 60fps CEF applications with React 19 and Tailwind CSS.`,
    coverImageUrl: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=1200&q=80",
    type: "devlog",
    authorId: "usr_dev_001",
    organizationId: "org_horizon",
    status: "published",
    viewCount: 2890,
    likeCount: 195,
    commentCount: 14,
    tags: ["cef", "react", "tailwind", "ui", "tutorial"],
    publishedAt: new Date("2026-03-08T10:00:00Z"),
    createdAt: new Date("2026-03-08T10:00:00Z"),
    updatedAt: new Date("2026-03-08T10:00:00Z"),
  },
];

export const initialComments: Comment[] = [
  {
    id: "cmt_001",
    productId: "prd_inv_pro",
    authorId: "usr_server_001",
    text: "Installed this on our drift server for the trunk and glovebox inventory. The performance is rock solid even with 300+ players opening trunks simultaneously. Customer support responded in 5 minutes.",
    isVerifiedPurchase: true,
    rating: 5,
    createdAt: new Date("2026-03-03T11:20:00Z"),
  },
];

export const initialAuditLogs: AuditEvent[] = [
  {
    id: "aud_001",
    actorId: "usr_admin_001",
    actorType: "admin",
    action: "server.verified",
    targetId: "srv_drift_01",
    targetType: "server",
    ipAddress: "127.0.0.1",
    details: { reason: "Server identity and IP ownership verified through DNS TXT record" },
    createdAt: new Date("2026-03-01T09:00:00Z"),
  },
  {
    id: "aud_002",
    actorId: "usr_dev_001",
    actorType: "user",
    action: "build.published",
    targetId: "bld_inv_320",
    targetType: "build",
    ipAddress: "127.0.0.1",
    details: { version: "3.2.0", sha256: "e3b0c442..." },
    createdAt: new Date("2026-03-01T15:30:00Z"),
  },
];

export const initialReports: Report[] = [
  {
    id: "rpt_001",
    reporterId: "usr_player_001",
    targetType: "product",
    targetId: "prd_jdm_pack",
    type: "copyright",
    reason: "Suspected uncredited 3D wheel model source",
    evidenceUrls: ["https://example.com/evidence1"],
    status: "resolved",
    moderatorNotes: "Author provided original 3ds Max workfiles and proof of purchase for base meshes.",
    createdAt: new Date("2026-03-06T12:00:00Z"),
    resolvedAt: new Date("2026-03-07T14:00:00Z"),
  },
];
