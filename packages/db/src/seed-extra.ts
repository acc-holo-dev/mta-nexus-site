import { hashPassword } from "@nexus/security";
import { sql } from "drizzle-orm";
import { db } from "./client";
import { userRepository, serverRepository, productRepository, buildRepository, contentRepository, auditRepository } from "./repositories/index";
import { socialRepository } from "./repositories/social";
import { notificationRepository } from "./repositories/notifications";
import { serverObservationRepository } from "./repositories/server-observations";
import { comments } from "./schema";

async function runSeedExtra() {
  // Idempotency guard: skip when the extra users already exist.
  const raw = await db.execute(sql`SELECT 1 FROM users WHERE id = 'usr_dev_002' LIMIT 1`);
  const marker = Array.isArray(raw) ? raw : [];
  if (marker.length > 0) {
    console.log("Extra seed already applied, skipping.");
    return;
  }

  console.log("Seeding extra live-look data...");
  const passwordHash = await hashPassword("password123");

  // ---- 1. Extra users -------------------------------------------------------
  const usersSpec = [
    { id: "usr_dev_002", email: "nova@mta-nexus.com", username: "nova_scripter", displayName: "Nova Scripter", role: "developer", bio: "Lua specialist. Async frameworks, UI/UX and anti-cheat systems." },
    { id: "usr_dev_003", email: "pixel@mta-nexus.com", username: "pixel_forge", displayName: "Pixel Forge", role: "developer", bio: "Vehicle & environment artist. Optimized models since 2011." },
    { id: "usr_owner_002", email: "sunset@mta-nexus.com", username: "sunset_host", displayName: "Sunset Host", role: "server_owner", bio: "Owner of Sunset Freeroam. Community first." },
    { id: "usr_owner_003", email: "race@mta-nexus.com", username: "race_arena", displayName: "Race Arena Crew", role: "server_owner", bio: "Competitive MTA racing league organizer." },
    { id: "usr_mod_001", email: "moderator@mta-nexus.com", username: "nexus_moderator", displayName: "Nexus Moderator", role: "moderator", bio: "Keeping the catalog clean and safe." },
    { id: "usr_player_002", email: "lena@example.com", username: "lena_ls", displayName: "Lena from LS", role: "user", bio: "Freeroam explorer and screenshot hunter." },
    { id: "usr_player_003", email: "dima@example.com", username: "dima_drift", displayName: "Dima Drift", role: "user", bio: "Tandem drift addict. V8 forever." },
    { id: "usr_player_004", email: "kate@example.com", username: "kate_rp", displayName: "Kate RP", role: "user", bio: "Roleplay storyteller." },
  ];
  for (const u of usersSpec) {
    await userRepository.create({
      ...u,
      passwordHash,
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${u.username}`,
      isVerified: true,
      emailVerified: true,
    });
  }

  // ---- 2. Extra servers -----------------------------------------------------
  const serversSpec = [
    { id: "srv_sunset_fr", name: "Sunset Freeroam | 24/7", slug: "sunset-freeroam", description: "Classic freeroam with custom vehicle spawner, derby arenas, wind tunnels and a friendly international community.", ipAddress: "freeroam.sunset-mta.com", gameMode: "Freeroam", mapName: "Los Santos", maxPlayers: 300, currentPlayers: 187, ownerId: "usr_owner_002" },
    { id: "srv_race_arena", name: "Race Arena | Cup Season 12", slug: "race-arena-cup", description: "Competitive circuit racing with ranked seasons, ghost replays, anti-cheat verification and weekly cash-prize cups.", ipAddress: "race.arena-mta.net", gameMode: "Racing / Ranked", mapName: "San Fierro Circuit", maxPlayers: 128, currentPlayers: 96, ownerId: "usr_owner_003" },
    { id: "srv_zombie_out", name: "Outbreak: Zombie Survival", slug: "outbreak-zombie-survival", description: "Co-op zombie survival with dynamic infection spread, safezone economy, barricade building and boss waves every night cycle.", ipAddress: "outbreak.mta-zone.com", gameMode: "Survival / Co-op", mapName: "Countryside & Red County", maxPlayers: 200, currentPlayers: 143, ownerId: "usr_owner_002" },
    { id: "srv_city_life", name: "City Life | Light RP", slug: "city-life-light-rp", description: "Relaxed roleplay: jobs, housing, vehicle dealerships, phone system and player-run businesses without hardcore whitelists.", ipAddress: "citylife.mta-play.com", gameMode: "Light Roleplay", mapName: "Los Santos & Countryside", maxPlayers: 400, currentPlayers: 264, ownerId: "usr_server_001" },
    { id: "srv_dd_room", name: "Destruction Derby Room", slug: "destruction-derby-room", description: "Non-stop destruction derby: bloodring rage, stadium jumps, last-man-standing rounds and map voting every 10 minutes.", ipAddress: "derby.dd-room.ru", gameMode: "Destruction Derby", mapName: "Bloodring Stadium", maxPlayers: 100, currentPlayers: 71, ownerId: "usr_dev_002" },
  ];
  for (const s of serversSpec) {
    await serverRepository.create({
      ...s,
      port: 22003,
      httpPort: 22005,
      status: "active",
      visibility: "public",
      isVerified: true,
      bannerUrl: `https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?auto=format&fit=crop&w=1200&q=80&lock=${s.id.length}`,
      logoUrl: `https://api.dicebear.com/7.x/identicon/svg?seed=${s.slug}`,
    });
  }

  // ---- 3. Extra products + builds -------------------------------------------
  const sha = (n: number) => n.toString(16).padStart(64, "0");
  const productsSpec: ReadonlyArray<{
    id: string;
    title: string;
    slug: string;
    type: "script" | "map" | "vehicle" | "plugin";
    shortDescription: string;
    tags: string[];
    version: string;
    ratingAverage: number;
    ratingCount: number;
    salesCount: number;
    featured: boolean;
    author: string;
    org: string | null;
    buildNotes: string;
    size: number;
  }> = [
    { id: "prd_anticheat", title: "Sentinel Anti-Cheat Shield", slug: "sentinel-anticheat-shield", type: "script", shortDescription: "Server-authoritative anti-cheat: speed, teleport, weapon and money validation with ML anomaly scoring.", tags: ["anticheat", "security", "performance"], version: "4.0.1", ratingAverage: 50, ratingCount: 91, salesCount: 342, featured: true, author: "usr_dev_002", org: "org_horizon", buildNotes: "Added adaptive detection thresholds and reduced false positives on high-latency connections.", size: 7340032 },
    { id: "prd_hud_2026", title: "Glass HUD & Speedometer 2026", slug: "glass-hud-speedometer-2026", type: "script", shortDescription: "Modern glassmorphism HUD: speedometer, fuel, minimap, radio panel and full DX draw-optimized rendering.", tags: ["hud", "ui", "dx", "speedometer"], version: "2.5.0", ratingAverage: 47, ratingCount: 64, salesCount: 198, featured: true, author: "usr_dev_002", org: "org_horizon", buildNotes: "New radio panel, 30% lower draw calls, controller navigation support.", size: 5242880 },
    { id: "prd_map_pack", title: "Legendary Drift Maps Vol.2", slug: "legendary-drift-maps-vol2", type: "map", shortDescription: "25 tournament-grade drift maps: Ebisu, Meihan-style layouts, tandem lanes and spectator zones.", tags: ["maps", "drift", "touge"], version: "1.0.2", ratingAverage: 48, ratingCount: 37, salesCount: 156, featured: false, author: "usr_dev_003", org: null, buildNotes: "Added collision fixes and 4 new touge layouts with checkpoint variants.", size: 15728640 },
    { id: "prd_car_pack", title: "JDM Legends Car Pack", slug: "jdm-legends-car-pack", type: "vehicle", shortDescription: "40 optimized JDM vehicles with custom handling, tuning parts, steering wheels and LOD-safe models.", tags: ["vehicles", "jdm", "tuning"], version: "3.1.0", ratingAverage: 49, ratingCount: 73, salesCount: 287, featured: true, author: "usr_dev_003", org: null, buildNotes: "Added 6 new models, fixed mirror reflections, updated handling lines.", size: 26214400 },
    { id: "prd_economy", title: "Dynamic Economy Engine", slug: "dynamic-economy-engine", type: "script", shortDescription: "Player-driven economy: jobs, taxes, inflation, business ownership, banking and transaction ledger.", tags: ["economy", "roleplay", "jobs", "banking"], version: "1.8.3", ratingAverage: 46, ratingCount: 29, salesCount: 121, featured: false, author: "usr_dev_002", org: "org_horizon", buildNotes: "Stable transaction serialization and admin audit export.", size: 9437184 },
    { id: "prd_admin_tool", title: "Command Center Admin Suite", slug: "command-center-admin-suite", type: "plugin", shortDescription: "Web-connected admin panel: live player list, bans, mutes, teleport map, logs and moderation queue.", tags: ["admin", "moderation", "panel"], version: "2.2.1", ratingAverage: 45, ratingCount: 41, salesCount: 176, featured: false, author: "usr_dev_003", org: null, buildNotes: "Added moderation queue webhooks and dark mode.", size: 6291456 },
  ];
  for (const p of productsSpec) {
    const created = await productRepository.create({
      id: p.id,
      title: p.title,
      slug: p.slug,
      shortDescription: p.shortDescription,
      description: `${p.shortDescription} Built for modern MTA:SA servers, tested under load, documented and supported by the author.`,
      type: p.type,
      status: "published",
      authorId: p.author,
      organizationId: p.org ?? undefined,
      price: 0,
      currency: "USD",
      licenseModel: "unlimited",
      tags: p.tags,
      currentVersion: p.version,
      ratingAverage: p.ratingAverage,
      ratingCount: p.ratingCount,
      salesCount: p.salesCount,
      isFeatured: p.featured,
      thumbnailUrl: `https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=600&q=80&lock=${p.id.length}`,
      screenshots: [
        `https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80&lock=${p.id.length}`,
      ],
      compatibility: { mtaMinVersion: "1.6.0", dependencies: [] },
    });
    await buildRepository.create({
      id: `bld_${p.id}`,
      productId: created.id,
      version: p.version,
      releaseNotes: p.buildNotes,
      status: "published",
      storageKey: `builds/${p.id}/v${p.version}.zip`,
      sha256Hash: sha(p.id.length * 7 + 11),
      fileSizeBytes: p.size,
      mtaVersionTarget: "1.6.0",
      fileName: "resource.zip",
      mimeType: "application/zip",
      scanStatus: "clean",
      scanner: "seed-manual-review",
      scannedAt: new Date(),
      isSigned: false,
    });
  }

  // ---- 4. Reviews (comments with ratings) -----------------------------------
  const reviewsSpec = [
    { id: "cmt_rev_001", productId: "prd_anticheat", author: "usr_server_001", rating: 5, text: "Cheater count dropped to near zero on a 400-slot server. Absolute must-have." },
    { id: "cmt_rev_002", productId: "prd_anticheat", author: "usr_owner_002", rating: 5, text: "Support is fast, updates are regular. Best anti-cheat we have used in 3 years." },
    { id: "cmt_rev_003", productId: "prd_anticheat", author: "usr_player_002", rating: 4, text: "Works great, initial setup takes some reading but worth it." },
    { id: "cmt_rev_004", productId: "prd_hud_2026", author: "usr_player_003", rating: 5, text: "The speedometer looks stunning even on low-end PCs. Zero FPS loss." },
    { id: "cmt_rev_005", productId: "prd_hud_2026", author: "usr_owner_003", rating: 4, text: "Very customizable. Would love per-gamemode presets out of the box." },
    { id: "cmt_rev_006", productId: "prd_map_pack", author: "usr_player_003", rating: 5, text: "Tandem lanes are perfectly sized. Our drift community switched to this pack fully." },
    { id: "cmt_rev_007", productId: "prd_car_pack", author: "usr_player_004", rating: 5, text: "Models are clean and lightweight, tuning parts fit perfectly. 10/10." },
    { id: "cmt_rev_008", productId: "prd_car_pack", author: "usr_owner_002", rating: 4, text: "Great pack, only wish there were more liveries included." },
    { id: "cmt_rev_009", productId: "prd_economy", author: "usr_server_001", rating: 4, text: "Inflation control works as advertised. Docs could be deeper but the code is clean." },
    { id: "cmt_rev_010", productId: "prd_admin_tool", author: "usr_owner_003", rating: 5, text: "The live map teleport saves our admins hours every day." },
    { id: "cmt_rev_011", productId: "prd_inv_pro", author: "usr_player_004", rating: 5, text: "Drag-and-drop feels instant even with 300 players online. Impressive sync." },
  ];
  for (const r of reviewsSpec) {
    await db.insert(comments).values({
      id: r.id,
      productId: r.productId,
      authorId: r.author,
      text: r.text,
      rating: r.rating,
      isVerifiedPurchase: true,
      createdAt: new Date(Date.now() - r.id.length * 3600 * 1000),
    });
  }

  // ---- 5. Extra articles ----------------------------------------------------
  await contentRepository.create({
    id: "cnt_art_002",
    title: "ClamAV Scan Gates: How MTA NEXUS Keeps Free Builds Safe",
    slug: "clamav-scan-gates-safe-builds",
    excerpt: "Every downloadable build passes a trusted clean scan with scanner identity and timestamp before it becomes public.",
    body: "Safety is not a checkbox at MTA NEXUS. Each uploaded build is scanned, signed with scanner identity and only published when the result is trusted clean. Here is how the pipeline works and why fail-closed matters.",
    coverImageUrl: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=80",
    type: "article",
    authorId: "usr_admin_001",
    status: "published",
    viewCount: 1832,
    likeCount: 94,
    commentCount: 12,
    tags: ["security", "scanner", "platform"],
  });
  await contentRepository.create({
    id: "cnt_art_003",
    title: "Season 12 Racing Cup: Registration Open",
    slug: "season-12-racing-cup-registration",
    excerpt: "Ranked circuit racing returns with weekly cups, ghost replays and a new anti-cheat verified leaderboard.",
    body: "Race Arena opens Season 12 registration. Verify your account, pick your class and qualify on the new San Fierro circuit. Weekly cups, prize pool and full replay telemetry for every race.",
    coverImageUrl: "https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=1200&q=80",
    type: "article",
    authorId: "usr_owner_003",
    serverId: "srv_race_arena",
    status: "published",
    viewCount: 967,
    likeCount: 61,
    commentCount: 8,
    tags: ["racing", "esports", "community"],
  });

  // ---- 6. Social graph ------------------------------------------------------
  const followSpec = [
    { id: "flw_001", follower: "usr_player_002", targetType: "user", targetId: "usr_dev_002" },
    { id: "flw_002", follower: "usr_player_003", targetType: "user", targetId: "usr_dev_003" },
    { id: "flw_003", follower: "usr_player_004", targetType: "user", targetId: "usr_dev_002" },
    { id: "flw_004", follower: "usr_player_002", targetType: "server", targetId: "srv_sunset_fr" },
    { id: "flw_005", follower: "usr_player_003", targetType: "server", targetId: "srv_race_arena" },
    { id: "flw_006", follower: "usr_player_004", targetType: "server", targetId: "srv_city_life" },
    { id: "flw_007", follower: "usr_player_002", targetType: "product", targetId: "prd_hud_2026" },
    { id: "flw_008", follower: "usr_player_003", targetType: "product", targetId: "prd_car_pack" },
    { id: "flw_009", follower: "usr_player_004", targetType: "product", targetId: "prd_anticheat" },
    { id: "flw_010", follower: "usr_player_001", targetType: "server", targetId: "srv_horizon_rp" },
    { id: "flw_011", follower: "usr_player_001", targetType: "product", targetId: "prd_inv_pro" },
  ];
  for (const f of followSpec) {
    await socialRepository.follow({ id: f.id, followerId: f.follower, targetType: f.targetType as "user" | "server" | "product", targetId: f.targetId });
  }

  // ---- 7. Server observations (player history) ------------------------------
  const obsServers = [
    { id: "srv_drift_01", base: 342, wave: 40 },
    { id: "srv_horizon_rp", base: 789, wave: 60 },
    { id: "srv_sunset_fr", base: 187, wave: 30 },
    { id: "srv_race_arena", base: 96, wave: 25 },
    { id: "srv_zombie_out", base: 143, wave: 35 },
    { id: "srv_city_life", base: 264, wave: 45 },
    { id: "srv_dd_room", base: 71, wave: 20 },
  ];
  const sources = ["mta_master", "mta_query"] as const;
  let obsCounter = 0;
  for (const s of obsServers) {
    for (let minutesAgo = 240; minutesAgo >= 0; minutesAgo -= 30) {
      const drift = Math.round(Math.sin((240 - minutesAgo) / 38) * s.wave);
      await serverObservationRepository.record({
        serverId: s.id,
        source: sources[obsCounter % 2],
        name: undefined,
        currentPlayers: Math.max(0, s.base + drift),
        maxPlayers: undefined,
        responding: true,
        passworded: false,
        observedAt: new Date(Date.now() - minutesAgo * 60 * 1000),
      });
      obsCounter++;
    }
  }

  // ---- 8. Notifications for admin -------------------------------------------
  const notifSpec = [
    { id: "ntf_001", recipient: "usr_admin_001", title: "Новый ресурс опубликован", message: "Sentinel Anti-Cheat Shield 4.0.1 прошёл безопасную проверку и опубликован в каталоге.", link: "/market/sentinel-anticheat-shield", type: "content", category: "content", isRead: false },
    { id: "ntf_002", recipient: "usr_admin_001", title: "Отчёт обработан", message: "Жалоба на ресурс рассмотрена модератором nexus_moderator.", link: "/admin", type: "security", category: "security", isRead: false },
    { id: "ntf_003", recipient: "usr_admin_001", title: "Сервер прошёл верификацию", message: "Race Arena | Cup Season 12 подтверждён как верифицированный сервер.", link: "/servers/race-arena-cup", type: "server", category: "server", isRead: false },
    { id: "ntf_004", recipient: "usr_admin_001", title: "Новый подписчик", message: "lena_ls подписалась на ваши обновления.", link: "/users/nova_scripter", type: "follow", category: "follow", isRead: true },
  ];
  for (const n of notifSpec) {
    await notificationRepository.create({ id: n.id, recipientId: n.recipient, title: n.title, message: n.message, link: n.link, type: n.type, category: n.category, ...(n.isRead ? { isRead: true } : {}) } as never);
  }

  // ---- 9. Audit -------------------------------------------------------------
  await auditRepository.record({
    id: "aud_002",
    actorId: "usr_admin_001",
    actorType: "admin",
    action: "database.seed_extra",
    targetId: "system",
    targetType: "database",
    details: { baseline: "Live-look extra seed completed" },
  });

  console.log("Extra seed completed successfully.");
}

runSeedExtra()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Extra seed error:", err);
    process.exit(1);
  });
