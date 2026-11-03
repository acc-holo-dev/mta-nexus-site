// Historical "one year of platform life" seed data for local UI testing.
// Append-only by design: rows here only REFERENCE baseline ids created by
// seed-data.ts (usr_admin_001, usr_dev_001, usr_server_001, usr_player_001,
// org_horizon, srv_drift_01, srv_horizon_rp, prd_inv_pro, prd_drift_physics,
// bld_inv_320, bld_drift_214, lic_user_001, cnt_art_001) and must never
// modify them. Idempotent: every insert uses onConflictDoNothing.

import { eq } from "drizzle-orm";

import { db } from "./client";
import {
  auditEvents,
  comments,
  content,
  follows,
  notifications,
  products,
  reactions,
  reports,
  resourceQaAnswers,
  resourceQaThreadFollows,
  resourceQaThreads,
  serverReviews,
  servers,
  users,
} from "./schema";

const d = (iso: string): Date => new Date(iso);

export interface HistoricalSeedOptions {
  passwordHash: string;
}

function createHistoricalSeedData({ passwordHash }: HistoricalSeedOptions) {
  const userRows = [
    {
      id: "usr_tester_01",
      email: "tester01@mta-nexus.com",
      username: "tester01",
      displayName: "Test Pilot 01",
      passwordHash,
      role: "user",
      isVerified: true,
      emailVerified: true,
      bio: "Тестирую серверы и ресурсы MTA: SA каждую неделю.",
      createdAt: d("2025-07-10T09:00:00Z"),
      updatedAt: d("2026-10-20T09:00:00Z"),
    },
    {
      id: "usr_tester_02",
      email: "tester02@mta-nexus.com",
      username: "tester02",
      displayName: "Test Pilot 02",
      passwordHash,
      role: "user",
      isVerified: true,
      emailVerified: true,
      bio: "Ищу баги в бета-ресурсах и репорчу их авторам.",
      createdAt: d("2025-09-18T14:00:00Z"),
      updatedAt: d("2026-10-22T10:00:00Z"),
    },
    {
      id: "usr_reviewer_01",
      email: "reviewer01@mta-nexus.com",
      username: "reviewer01",
      displayName: "Nexus Reviewer",
      passwordHash,
      role: "user",
      isVerified: true,
      emailVerified: true,
      bio: "Пишу обзоры ресурсов и серверов NEXUS с 2025 года.",
      createdAt: d("2025-09-01T10:00:00Z"),
      updatedAt: d("2026-10-15T10:00:00Z"),
    },
  ] satisfies (typeof users.$inferInsert)[];

  const serverRows = [
    {
      id: "srv_growth_01",
      name: "MTA Test Arena",
      slug: "mta-test-arena",
      description:
        "Открытая площадка для тестирования ресурсов и режимов MTA без риска для основного прогресса.",
      mediaUrls: [],
      language: "ru",
      region: "EU",
      gameplayTags: ["test", "sandbox", "freeroam"],
      ipAddress: "arena.mta-test.net",
      port: 22003,
      httpPort: 22005,
      gameMode: "Freeroam",
      mapName: "San Andreas",
      maxPlayers: 50,
      currentPlayers: 12,
      ownerId: "usr_server_001",
      status: "active",
      visibility: "public",
      isVerified: true,
      lastObservedAt: d("2026-10-20T21:40:00Z"),
      observationSource: "seed-historical",
      createdAt: d("2025-08-14T18:00:00Z"),
      updatedAt: d("2026-10-20T09:00:00Z"),
    },
    {
      id: "srv_growth_02",
      name: "Nexus Beta Hub",
      slug: "nexus-beta-hub",
      description:
        "Тестовый сервер сообщества NEXUS для проверки бета-функций платформы и новых ресурсов.",
      mediaUrls: [],
      language: "ru",
      region: "EU",
      gameplayTags: ["beta", "roleplay", "community"],
      ipAddress: "beta.horizon-mta.com",
      port: 22003,
      httpPort: 22005,
      gameMode: "Roleplay",
      mapName: "San Andreas",
      maxPlayers: 200,
      currentPlayers: 89,
      ownerId: "usr_dev_001",
      organizationId: "org_horizon",
      status: "active",
      visibility: "public",
      isVerified: false,
      lastObservedAt: d("2026-11-01T21:40:00Z"),
      observationSource: "seed-historical",
      createdAt: d("2025-10-02T12:00:00Z"),
      updatedAt: d("2026-11-01T21:40:00Z"),
    },
  ] satisfies (typeof servers.$inferInsert)[];

  const productRows = [
    {
      id: "prd_beta_ui",
      title: "Nexus Beta UI Kit",
      slug: "nexus-beta-ui-kit",
      description:
        "Набор интерфейсных компонентов для MTA: HUD, меню инвентаря, окна уведомлений и тёмная тема. Поставляется с конфигом и примерами подключения.",
      shortDescription: "Бета-версия UI-набора: HUD, меню и уведомления с тёмной темой.",
      type: "ui",
      status: "published",
      authorId: "usr_dev_001",
      organizationId: "org_horizon",
      price: 0,
      currency: "USD",
      licenseModel: "single_server",
      tags: ["ui", "beta", "design"],
      currentVersion: "0.9.0",
      ratingAverage: 43,
      ratingCount: 3,
      salesCount: 143,
      isFeatured: false,
      metadataReviewRequired: false,
      createdAt: d("2026-03-20T10:00:00Z"),
      updatedAt: d("2026-10-12T10:00:00Z"),
    },
  ] satisfies (typeof products.$inferInsert)[];

  const contentRows = [
    {
      id: "cnt_recap_2025",
      title: "Итоги года на NEXUS: что произошло в 2025",
      slug: "nexus-2025-recap",
      body: "2025 год стал для NEXUS годом роста. Мы запустили публичный каталог ресурсов, подключили первые организации и добавили проверку сборок сканером безопасности. За год платформа пережила три крупных миграции схемы и выдержала два пиковых дня с более чем десятью тысячами скачиваний.\n\nОсновные события года: открытие торговой витрины в марте, запуск лицензий в апреле, релиз Inventory Pro 3.2.0 в июне и Physics Pack 2.1.4 осенью. Комьюнити выросло: тестировщики и обозреватели помогли довести десятки бета-ресурсов до публикации.\n\nСпасибо всем, кто был с нами в 2025 году. Впереди — библиотека коллекций, история релизов и ещё больше инструментов для владельцев серверов.",
      excerpt: "Короткий обзор главных событий платформы за 2025 год.",
      type: "article",
      authorId: "usr_admin_001",
      status: "published",
      tags: ["news", "community"],
      viewCount: 1520,
      likeCount: 34,
      commentCount: 0,
      publishedAt: d("2025-12-20T10:00:00Z"),
      createdAt: d("2025-12-20T10:00:00Z"),
      updatedAt: d("2025-12-20T10:00:00Z"),
    },
    {
      id: "cnt_roadmap_2026",
      title: "Дорожная карта NEXUS на 2026 год",
      slug: "nexus-2026-roadmap",
      body: "В 2026 году мы сосредоточимся на четырёх направлениях: библиотека коллекций с общим доступом, прозрачная история релизов, торговая витрина с проверенными продавцами и расширенный мониторинг серверов.\n\nУже доступно: сравнение коллекций, копирование элементов и экспорт истории. До лета планируем запустить автоматические релиз-вотчи и уведомления о новых сборках.\n\nКак всегда, пишите предложения в разделе вопросов — дорожная карта обновляется каждый квартал.",
      excerpt: "Планы платформы: библиотеки, торговая площадка и мониторинг серверов.",
      type: "article",
      authorId: "usr_admin_001",
      status: "published",
      tags: ["roadmap", "news"],
      viewCount: 980,
      likeCount: 21,
      commentCount: 0,
      publishedAt: d("2026-01-10T10:00:00Z"),
      createdAt: d("2026-01-10T10:00:00Z"),
      updatedAt: d("2026-01-10T10:00:00Z"),
    },
  ] satisfies (typeof content.$inferInsert)[];

  const followRows = [
    {
      id: "flw_player_dev_01",
      followerId: "usr_player_001",
      targetType: "user",
      targetId: "usr_dev_001",
      createdAt: d("2025-08-01T12:00:00Z"),
    },
    {
      id: "flw_player_inv_01",
      followerId: "usr_player_001",
      targetType: "product",
      targetId: "prd_inv_pro",
      createdAt: d("2025-08-02T12:00:00Z"),
    },
    {
      id: "flw_player_drift_01",
      followerId: "usr_player_001",
      targetType: "product",
      targetId: "prd_drift_physics",
      createdAt: d("2025-10-20T12:00:00Z"),
    },
    {
      id: "flw_player_ui_01",
      followerId: "usr_player_001",
      targetType: "product",
      targetId: "prd_beta_ui",
      createdAt: d("2026-04-02T12:00:00Z"),
    },
    {
      id: "flw_player_driftsrv_01",
      followerId: "usr_player_001",
      targetType: "server",
      targetId: "srv_drift_01",
      createdAt: d("2025-08-05T12:00:00Z"),
    },
    {
      id: "flw_player_rpsrv_01",
      followerId: "usr_player_001",
      targetType: "server",
      targetId: "srv_horizon_rp",
      createdAt: d("2026-03-12T12:00:00Z"),
    },
    {
      id: "flw_player_arena_01",
      followerId: "usr_player_001",
      targetType: "server",
      targetId: "srv_growth_01",
      createdAt: d("2026-08-02T12:00:00Z"),
    },
    {
      id: "flw_player_art_01",
      followerId: "usr_player_001",
      targetType: "content",
      targetId: "cnt_art_001",
      createdAt: d("2025-06-01T12:00:00Z"),
    },
    {
      id: "flw_tester1_ui_01",
      followerId: "usr_tester_01",
      targetType: "product",
      targetId: "prd_beta_ui",
      createdAt: d("2026-04-05T12:00:00Z"),
    },
    {
      id: "flw_tester1_driftsrv_01",
      followerId: "usr_tester_01",
      targetType: "server",
      targetId: "srv_drift_01",
      createdAt: d("2026-01-20T12:00:00Z"),
    },
    {
      id: "flw_tester1_arena_01",
      followerId: "usr_tester_01",
      targetType: "server",
      targetId: "srv_growth_01",
      createdAt: d("2025-09-01T12:00:00Z"),
    },
    {
      id: "flw_tester1_srvuser_01",
      followerId: "usr_tester_01",
      targetType: "user",
      targetId: "usr_server_001",
      createdAt: d("2025-09-02T12:00:00Z"),
    },
    {
      id: "flw_tester1_art_01",
      followerId: "usr_tester_01",
      targetType: "content",
      targetId: "cnt_art_001",
      createdAt: d("2025-06-02T12:00:00Z"),
    },
    {
      id: "flw_tester2_inv_01",
      followerId: "usr_tester_02",
      targetType: "product",
      targetId: "prd_inv_pro",
      createdAt: d("2025-10-10T12:00:00Z"),
    },
    {
      id: "flw_tester2_rp_01",
      followerId: "usr_tester_02",
      targetType: "server",
      targetId: "srv_horizon_rp",
      createdAt: d("2026-03-15T12:00:00Z"),
    },
    {
      id: "flw_tester2_admin_01",
      followerId: "usr_tester_02",
      targetType: "user",
      targetId: "usr_admin_001",
      createdAt: d("2026-06-01T12:00:00Z"),
    },
    {
      id: "flw_reviewer_drift_01",
      followerId: "usr_reviewer_01",
      targetType: "product",
      targetId: "prd_drift_physics",
      createdAt: d("2025-11-05T12:00:00Z"),
    },
    {
      id: "flw_reviewer_driftsrv_01",
      followerId: "usr_reviewer_01",
      targetType: "server",
      targetId: "srv_drift_01",
      createdAt: d("2025-11-06T12:00:00Z"),
    },
    {
      id: "flw_reviewer_dev_01",
      followerId: "usr_reviewer_01",
      targetType: "user",
      targetId: "usr_dev_001",
      createdAt: d("2026-01-10T12:00:00Z"),
    },
    {
      id: "flw_srvowner_inv_01",
      followerId: "usr_server_001",
      targetType: "product",
      targetId: "prd_inv_pro",
      createdAt: d("2025-08-10T12:00:00Z"),
    },
    {
      id: "flw_dev_rp_01",
      followerId: "usr_dev_001",
      targetType: "server",
      targetId: "srv_horizon_rp",
      createdAt: d("2026-02-01T12:00:00Z"),
    },
  ] satisfies (typeof follows.$inferInsert)[];

  const serverReviewRows = [
    {
      id: "srev_drift_player_01",
      serverId: "srv_drift_01",
      authorId: "usr_player_001",
      text: "Лучший дрифт-сервер города: стабильные 60 тик, отзывчивая администрация и живое комьюнити.",
      rating: 5,
      interactionSource: "follow",
      createdAt: d("2025-09-10T18:00:00Z"),
    },
    {
      id: "srev_drift_tester_01",
      serverId: "srv_drift_01",
      authorId: "usr_tester_01",
      text: "Режимы меняются каждую неделю, но вечером бывает очередь на вход.",
      rating: 4,
      interactionSource: "follow",
      createdAt: d("2026-02-11T21:30:00Z"),
    },
    {
      id: "srev_rp_tester_01",
      serverId: "srv_horizon_rp",
      authorId: "usr_tester_02",
      text: "Серьёзный RP с проверкой ролей и хорошими правилами — редко такое встречаешь.",
      rating: 5,
      interactionSource: "follow",
      createdAt: d("2026-04-06T14:20:00Z"),
    },
    {
      id: "srev_rp_player_01",
      serverId: "srv_horizon_rp",
      authorId: "usr_player_001",
      text: "Хороший RP, но стартовая кривая обучения крутая: новичкам нужен наставник.",
      rating: 4,
      interactionSource: "follow",
      createdAt: d("2026-05-19T22:10:00Z"),
    },
    {
      id: "srev_arena_player_01",
      serverId: "srv_growth_01",
      authorId: "usr_player_001",
      text: "Отличная площадка для тестов: ничего не ломает основной прогресс, всё честно.",
      rating: 4,
      interactionSource: "follow",
      createdAt: d("2026-08-30T17:40:00Z"),
    },
  ] satisfies (typeof serverReviews.$inferInsert)[];

  const commentRows = [
    {
      id: "cmt_cnt_001",
      contentId: "cnt_art_001",
      authorId: "usr_tester_01",
      text: "Отличное руководство — поднял первый сервер за вечер, всё заработало с первого раза.",
      createdAt: d("2025-06-20T18:30:00Z"),
    },
    {
      id: "cmt_cnt_002",
      contentId: "cnt_art_001",
      authorId: "usr_player_001",
      text: "Добавьте, пожалуйста, раздел про проброс портов через провайдеров с CGNAT.",
      createdAt: d("2025-06-22T21:10:00Z"),
    },
    {
      id: "cmt_cnt_003",
      contentId: "cnt_art_001",
      authorId: "usr_admin_001",
      parentId: "cmt_cnt_002",
      text: "Раздел про CGNAT добавим в следующем обновлении статьи, спасибо за идею.",
      createdAt: d("2025-06-23T09:40:00Z"),
    },
    {
      id: "cmt_prd_inv_player_01",
      productId: "prd_inv_pro",
      authorId: "usr_player_001",
      text: "Инвентарь работает без сбоев после года обновлений, скины и транспорт сохраняются корректно.",
      rating: 5,
      reviewStatus: "published",
      isVerifiedPurchase: true,
      createdAt: d("2025-08-15T12:00:00Z"),
    },
    {
      id: "cmt_prd_inv_tester_01",
      productId: "prd_inv_pro",
      authorId: "usr_tester_01",
      text: "Стабильно четыре из пяти: перенос инвентаря между серверами всё ещё требует ручных скриптов.",
      rating: 4,
      reviewStatus: "published",
      isVerifiedPurchase: false,
      createdAt: d("2026-03-14T15:00:00Z"),
    },
    {
      id: "cmt_prd_inv_reviewer_01",
      productId: "prd_inv_pro",
      authorId: "usr_reviewer_01",
      text: "Лучший инвентарный ресурс для MTA: документация, поддержка и обновления на высоте.",
      rating: 5,
      reviewStatus: "published",
      isVerifiedPurchase: false,
      createdAt: d("2026-06-02T11:20:00Z"),
    },
    {
      id: "cmt_prd_drift_player_01",
      productId: "prd_drift_physics",
      authorId: "usr_player_001",
      text: "Физика дрифта заметно живее стоковой, но на очень высоких скоростях есть мелкие рывки.",
      rating: 4,
      reviewStatus: "published",
      isVerifiedPurchase: true,
      createdAt: d("2025-11-20T19:00:00Z"),
    },
    {
      id: "cmt_prd_drift_tester_01",
      productId: "prd_drift_physics",
      authorId: "usr_tester_02",
      text: "После v2.1.4 управление стало предсказуемым, рывки ушли почти полностью.",
      rating: 5,
      reviewStatus: "published",
      isVerifiedPurchase: false,
      createdAt: d("2026-01-25T13:30:00Z"),
    },
    {
      id: "cmt_prd_ui_tester_01",
      productId: "prd_beta_ui",
      authorId: "usr_tester_01",
      text: "Хороший старт для беты: компоненты аккуратные, но не хватает документации по конфигам.",
      rating: 4,
      reviewStatus: "published",
      isVerifiedPurchase: false,
      createdAt: d("2026-07-12T16:45:00Z"),
    },
    {
      id: "cmt_prd_ui_reviewer_01",
      productId: "prd_beta_ui",
      authorId: "usr_reviewer_01",
      text: "Один из самых чистых UI-китов для MTA, тёмная тема работает из коробки.",
      rating: 5,
      reviewStatus: "published",
      isVerifiedPurchase: false,
      createdAt: d("2026-08-20T10:15:00Z"),
    },
    {
      id: "cmt_prd_ui_player_01",
      productId: "prd_beta_ui",
      authorId: "usr_player_001",
      text: "Ставится за пару минут, но на слабых клиентах перерисовка HUD заметно подтормаживает.",
      rating: 4,
      reviewStatus: "published",
      isVerifiedPurchase: false,
      createdAt: d("2026-09-18T20:05:00Z"),
    },
  ] satisfies (typeof comments.$inferInsert)[];

  const qaThreadRows = [
    {
      id: "qa_thr_001",
      productId: "prd_inv_pro",
      authorId: "usr_player_001",
      body: "Подскажите, как перенести инвентарь игроков между серверами без потери скинов?",
      status: "open",
      buildId: "bld_inv_320",
      buildVersionLabel: "v3.2.0",
      createdAt: d("2026-05-12T12:00:00Z"),
    },
    {
      id: "qa_thr_002",
      productId: "prd_drift_physics",
      authorId: "usr_tester_02",
      body: "Физика машин иногда дёргается на высоких скоростях — это известная проблема?",
      status: "open",
      createdAt: d("2026-09-03T12:00:00Z"),
    },
    {
      // Inserted as "open": resolved_answer_id carries a non-deferrable FK to
      // resource_qa_answers, so the resolved state is applied with an UPDATE
      // after the answer rows exist (see seedHistorical).
      id: "qa_thr_003",
      productId: "prd_beta_ui",
      authorId: "usr_tester_01",
      body: "Работает ли UI Kit с тёмной темой интерфейса MTA 1.6?",
      status: "open",
      buildVersionLabel: "0.9.0",
      createdAt: d("2026-08-10T12:00:00Z"),
    },
  ] satisfies (typeof resourceQaThreads.$inferInsert)[];

  const qaAnswerRows = [
    {
      id: "qa_ans_001",
      threadId: "qa_thr_001",
      authorId: "usr_dev_001",
      body: "Используйте экспорт и импорт через встроенный менеджер инвентаря — скины сохраняются в профиле игрока.",
      createdAt: d("2026-05-13T09:00:00Z"),
    },
    {
      id: "qa_ans_002",
      threadId: "qa_thr_002",
      authorId: "usr_dev_001",
      body: "Да, в v2.1.4 дёрганье уже уменьшили; если повторяется — снизьте интервал синхронизации до 50 мс.",
      createdAt: d("2026-09-04T10:00:00Z"),
    },
    {
      id: "qa_ans_003",
      threadId: "qa_thr_003",
      authorId: "usr_dev_001",
      body: "Да, kit поддерживает тёмную тему — включите параметр dark_mode в конфиге ресурса.",
      createdAt: d("2026-08-14T09:00:00Z"),
    },
  ] satisfies (typeof resourceQaAnswers.$inferInsert)[];

  const qaFollowRows = [
    { userId: "usr_player_001", threadId: "qa_thr_001", updatedAt: d("2026-05-12T12:05:00Z") },
    { userId: "usr_dev_001", threadId: "qa_thr_001", updatedAt: d("2026-05-13T09:05:00Z") },
    { userId: "usr_tester_02", threadId: "qa_thr_002", updatedAt: d("2026-09-03T12:05:00Z") },
    { userId: "usr_tester_01", threadId: "qa_thr_003", updatedAt: d("2026-08-10T12:05:00Z") },
    { userId: "usr_dev_001", threadId: "qa_thr_003", updatedAt: d("2026-08-14T09:05:00Z") },
  ] satisfies (typeof resourceQaThreadFollows.$inferInsert)[];

  const reactionRows = [
    {
      id: "rct_player_inv_fire",
      userId: "usr_player_001",
      targetType: "product",
      targetId: "prd_inv_pro",
      emoji: "🔥",
      createdAt: d("2026-06-02T12:10:00Z"),
    },
    {
      id: "rct_tester1_ui_heart",
      userId: "usr_tester_01",
      targetType: "product",
      targetId: "prd_beta_ui",
      emoji: "❤️",
      createdAt: d("2026-07-12T16:50:00Z"),
    },
    {
      id: "rct_tester2_art_thumb",
      userId: "usr_tester_02",
      targetType: "content",
      targetId: "cnt_art_001",
      emoji: "👍",
      createdAt: d("2026-02-14T10:00:00Z"),
    },
    {
      id: "rct_reviewer_inv_party",
      userId: "usr_reviewer_01",
      targetType: "product",
      targetId: "prd_inv_pro",
      emoji: "🎉",
      createdAt: d("2026-06-02T11:25:00Z"),
    },
    {
      id: "rct_owner_dev_handshake",
      userId: "usr_server_001",
      targetType: "user",
      targetId: "usr_dev_001",
      emoji: "🤝",
      createdAt: d("2025-10-05T12:00:00Z"),
    },
    {
      id: "rct_player_reply_smile",
      userId: "usr_player_001",
      targetType: "comment",
      targetId: "cmt_cnt_003",
      emoji: "😄",
      createdAt: d("2025-06-23T10:00:00Z"),
    },
  ] satisfies (typeof reactions.$inferInsert)[];

  const notificationRows = [
    {
      id: "ntf_admin_report_01",
      recipientId: "usr_admin_001",
      title: "Новая жалоба на обзор",
      message: "speed_cj подал жалобу на обзор ресурса Inventory Pro.",
      link: "/admin/reports",
      type: "moderation",
      category: "reports",
      isRead: false,
      createdAt: d("2026-10-28T09:16:00Z"),
    },
    {
      id: "ntf_admin_report_02",
      recipientId: "usr_admin_001",
      title: "Жалоба на сервер Nexus Beta Hub",
      message: "reviewer01 сообщает о завышенном числе слотов в описании сервера.",
      link: "/admin/reports",
      type: "moderation",
      category: "reports",
      isRead: false,
      createdAt: d("2026-10-30T15:21:00Z"),
    },
    {
      id: "ntf_admin_resource_01",
      recipientId: "usr_admin_001",
      title: "Ресурс требует проверки",
      message: "Nexus Beta UI Kit опубликован и попал в очередь проверки метаданных.",
      link: "/admin/resources",
      type: "system",
      category: "resources",
      isRead: true,
      createdAt: d("2026-09-15T10:00:00Z"),
    },
    {
      id: "ntf_dev_review_01",
      recipientId: "usr_dev_001",
      title: "Новый обзор на Inventory Pro",
      message: "reviewer01 оставил пятизвёздочный обзор вашего ресурса.",
      type: "interaction",
      category: "reviews",
      isRead: true,
      createdAt: d("2026-06-02T11:25:00Z"),
    },
    {
      id: "ntf_dev_qa_01",
      recipientId: "usr_dev_001",
      title: "Новый вопрос по Physics Pack",
      message: "tester02 спросил про рывки физики на высоких скоростях.",
      type: "interaction",
      category: "qa",
      isRead: false,
      createdAt: d("2026-09-03T12:05:00Z"),
    },
    {
      id: "ntf_player_license_01",
      recipientId: "usr_player_001",
      title: "Лицензия истекает через 14 дней",
      message: "Продлите лицензию на Inventory Pro, чтобы сохранить доступ к обновлениям.",
      link: "/library",
      type: "system",
      category: "commerce",
      isRead: false,
      createdAt: d("2026-10-20T09:00:00Z"),
    },
    {
      id: "ntf_player_reply_01",
      recipientId: "usr_player_001",
      title: "Ответ на ваш комментарий",
      message: "Администрация ответила на ваше предложение в обсуждении руководства.",
      type: "interaction",
      category: "content",
      isRead: true,
      createdAt: d("2025-06-23T09:41:00Z"),
    },
    {
      id: "ntf_tester_welcome_01",
      recipientId: "usr_tester_01",
      title: "Добро пожаловать в NEXUS",
      message:
        "Заполните профиль и следите за серверами, чтобы получать персональные рекомендации.",
      type: "system",
      category: "system",
      isRead: true,
      createdAt: d("2025-07-10T09:05:00Z"),
    },
  ] satisfies (typeof notifications.$inferInsert)[];

  const auditEventRows = [
    {
      id: "aev_hist_2025_01",
      actorId: "system",
      actorType: "system",
      action: "database.migrated",
      targetId: "schema",
      targetType: "database",
      details: { note: "Initial production schema migration" },
      createdAt: d("2025-01-15T12:00:00Z"),
    },
    {
      id: "aev_hist_2025_02",
      actorId: "usr_server_001",
      action: "server.registered",
      targetId: "srv_drift_01",
      targetType: "server",
      details: { endpoint: "play.sadrift.com:22003" },
      createdAt: d("2025-02-15T12:00:00Z"),
    },
    {
      id: "aev_hist_2025_03",
      actorId: "usr_dev_001",
      action: "product.published",
      targetId: "prd_inv_pro",
      targetType: "product",
      details: { version: "2.1.0" },
      createdAt: d("2025-03-15T12:00:00Z"),
    },
    {
      id: "aev_hist_2025_04",
      actorId: "system",
      actorType: "system",
      action: "license.issued",
      targetId: "lic_user_001",
      targetType: "license",
      details: { userId: "usr_player_001" },
      createdAt: d("2025-04-15T12:00:00Z"),
    },
    {
      id: "aev_hist_2025_05",
      actorId: "usr_admin_001",
      action: "content.published",
      targetId: "cnt_art_001",
      targetType: "content",
      details: { note: "First public guide" },
      createdAt: d("2025-05-15T12:00:00Z"),
    },
    {
      id: "aev_hist_2025_06",
      actorId: "usr_dev_001",
      action: "build.released",
      targetId: "bld_inv_320",
      targetType: "build",
      details: { version: "3.2.0" },
      createdAt: d("2025-06-15T12:00:00Z"),
    },
    {
      id: "aev_hist_2025_07",
      actorId: "usr_player_001",
      action: "user.registered",
      targetId: "usr_player_001",
      targetType: "user",
      details: {},
      createdAt: d("2025-07-15T12:00:00Z"),
    },
    {
      id: "aev_hist_2025_08",
      actorId: "usr_player_001",
      action: "review.submitted",
      targetId: "cmt_prd_inv_player_01",
      targetType: "review",
      details: { rating: 5, productId: "prd_inv_pro" },
      createdAt: d("2025-08-15T12:00:00Z"),
    },
    {
      id: "aev_hist_2025_09",
      actorId: "usr_server_001",
      action: "server.updated",
      targetId: "srv_drift_01",
      targetType: "server",
      details: { currentPlayers: 342 },
      createdAt: d("2025-09-15T12:00:00Z"),
    },
    {
      id: "aev_hist_2025_10",
      actorId: "usr_dev_001",
      action: "product.updated",
      targetId: "prd_drift_physics",
      targetType: "product",
      details: { version: "2.1.4" },
      createdAt: d("2025-10-15T12:00:00Z"),
    },
    {
      id: "aev_hist_2025_11",
      actorId: "usr_dev_001",
      action: "build.released",
      targetId: "bld_drift_214",
      targetType: "build",
      details: { version: "2.1.4" },
      createdAt: d("2025-11-15T12:00:00Z"),
    },
    {
      id: "aev_hist_2025_12",
      actorId: "system",
      actorType: "system",
      action: "database.seeded",
      targetId: "baseline:v1",
      targetType: "database",
      details: { note: "Year-end demo refresh" },
      createdAt: d("2025-12-15T12:00:00Z"),
    },
    {
      id: "aev_hist_2026_01",
      actorId: "system",
      actorType: "system",
      action: "server.heartbeat",
      targetId: "srv_drift_01",
      targetType: "server",
      details: { currentPlayers: 482 },
      createdAt: d("2026-01-15T12:00:00Z"),
    },
    {
      id: "aev_hist_2026_02",
      actorId: "usr_admin_001",
      action: "product.featured",
      targetId: "prd_inv_pro",
      targetType: "product",
      details: {},
      createdAt: d("2026-02-15T12:00:00Z"),
    },
    {
      id: "aev_hist_2026_03",
      actorId: "usr_tester_01",
      action: "review.submitted",
      targetId: "cmt_prd_inv_tester_01",
      targetType: "review",
      details: { rating: 4, productId: "prd_inv_pro" },
      createdAt: d("2026-03-15T12:00:00Z"),
    },
    {
      id: "aev_hist_2026_04",
      actorId: "usr_player_001",
      action: "license.renewed",
      targetId: "lic_user_001",
      targetType: "license",
      details: { termMonths: 6 },
      createdAt: d("2026-04-15T12:00:00Z"),
    },
    {
      id: "aev_hist_2026_05",
      actorId: "usr_admin_001",
      action: "content.updated",
      targetId: "cnt_art_001",
      targetType: "content",
      details: { note: "Expanded hosting section" },
      createdAt: d("2026-05-15T12:00:00Z"),
    },
    {
      id: "aev_hist_2026_06",
      actorId: "usr_dev_001",
      action: "build.patched",
      targetId: "bld_inv_320",
      targetType: "build",
      details: { version: "3.2.1", note: "Hotfix: inventory sync race" },
      createdAt: d("2026-06-15T12:00:00Z"),
    },
    {
      id: "aev_dl_inv_01",
      actorId: "usr_player_001",
      action: "product.download_started",
      targetId: "prd_inv_pro",
      targetType: "product",
      details: { version: "3.2.1" },
      createdAt: d("2026-07-02T10:15:00Z"),
    },
    {
      id: "aev_dl_inv_02",
      actorId: "usr_tester_01",
      action: "product.download_started",
      targetId: "prd_inv_pro",
      targetType: "product",
      details: { version: "3.2.1" },
      createdAt: d("2026-08-09T11:30:00Z"),
    },
    {
      id: "aev_dl_inv_03",
      actorId: "usr_tester_02",
      action: "product.download_started",
      targetId: "prd_inv_pro",
      targetType: "product",
      details: { version: "3.2.1" },
      createdAt: d("2026-09-14T09:45:00Z"),
    },
    {
      id: "aev_dl_inv_04",
      actorId: "usr_player_001",
      action: "product.download_started",
      targetId: "prd_inv_pro",
      targetType: "product",
      details: { version: "3.2.1" },
      createdAt: d("2026-10-01T14:20:00Z"),
    },
    {
      id: "aev_dl_inv_05",
      actorId: "usr_reviewer_01",
      action: "product.download_started",
      targetId: "prd_inv_pro",
      targetType: "product",
      details: { version: "3.2.1" },
      createdAt: d("2026-10-25T10:50:00Z"),
    },
    {
      id: "aev_dl_drift_01",
      actorId: "usr_tester_02",
      action: "product.download_started",
      targetId: "prd_drift_physics",
      targetType: "product",
      details: { version: "2.1.4" },
      createdAt: d("2026-07-20T12:00:00Z"),
    },
    {
      id: "aev_dl_drift_02",
      actorId: "usr_player_001",
      action: "product.download_started",
      targetId: "prd_drift_physics",
      targetType: "product",
      details: { version: "2.1.4" },
      createdAt: d("2026-09-11T18:40:00Z"),
    },
    {
      id: "aev_dl_drift_03",
      actorId: "usr_tester_01",
      action: "product.download_started",
      targetId: "prd_drift_physics",
      targetType: "product",
      details: { version: "2.1.4" },
      createdAt: d("2026-10-18T20:10:00Z"),
    },
    {
      id: "aev_dl_drift_04",
      actorId: "usr_player_001",
      action: "product.download_started",
      targetId: "prd_drift_physics",
      targetType: "product",
      details: { version: "2.1.4" },
      createdAt: d("2026-10-27T21:35:00Z"),
    },
    {
      id: "aev_dl_ui_01",
      actorId: "usr_tester_01",
      action: "product.download_started",
      targetId: "prd_beta_ui",
      targetType: "product",
      details: { version: "0.9.0" },
      createdAt: d("2026-06-25T13:00:00Z"),
    },
    {
      id: "aev_dl_ui_02",
      actorId: "usr_tester_02",
      action: "product.download_started",
      targetId: "prd_beta_ui",
      targetType: "product",
      details: { version: "0.9.0" },
      createdAt: d("2026-08-30T15:25:00Z"),
    },
    {
      id: "aev_dl_ui_03",
      actorId: "usr_reviewer_01",
      action: "product.download_started",
      targetId: "prd_beta_ui",
      targetType: "product",
      details: { version: "0.9.0" },
      createdAt: d("2026-10-12T19:05:00Z"),
    },
    {
      id: "aev_login_admin_01",
      actorId: "usr_admin_001",
      action: "auth.login",
      targetId: "usr_admin_001",
      targetType: "user",
      details: { method: "password" },
      createdAt: d("2026-09-01T08:10:00Z"),
    },
    {
      id: "aev_login_admin_02",
      actorId: "usr_admin_001",
      action: "auth.login",
      targetId: "usr_admin_001",
      targetType: "user",
      details: { method: "password" },
      createdAt: d("2026-10-15T08:05:00Z"),
    },
    {
      id: "aev_login_tester_01",
      actorId: "usr_tester_01",
      action: "auth.login",
      targetId: "usr_tester_01",
      targetType: "user",
      details: { method: "password" },
      createdAt: d("2026-10-20T19:30:00Z"),
    },
    {
      id: "aev_login_dev_01",
      actorId: "usr_dev_001",
      action: "auth.login",
      targetId: "usr_dev_001",
      targetType: "user",
      details: { method: "password" },
      createdAt: d("2026-10-22T10:40:00Z"),
    },
  ] satisfies (typeof auditEvents.$inferInsert)[];

  const reportRows = [
    {
      id: "rpt_2026_001",
      reporterId: "usr_player_001",
      targetType: "review",
      targetId: "cmt_prd_inv_tester_01",
      type: "review",
      reason:
        "Обзор не отражает работу ресурса после патча 3.2.1: заявленные проблемы уже исправлены.",
      createdAt: d("2026-10-28T09:15:00Z"),
    },
    {
      id: "rpt_2026_002",
      reporterId: "usr_tester_02",
      targetType: "comment",
      targetId: "cmt_cnt_002",
      type: "spam",
      reason: "Похоже на рекламу стороннего форума в комментарии к статье.",
      createdAt: d("2026-10-29T11:40:00Z"),
    },
    {
      id: "rpt_2026_003",
      reporterId: "usr_reviewer_01",
      targetType: "server",
      targetId: "srv_growth_02",
      type: "misleading",
      reason: "В описании заявлено 200 слотов, но сервер стабильно держит около 120.",
      createdAt: d("2026-10-30T15:20:00Z"),
    },
    {
      id: "rpt_2026_004",
      reporterId: "usr_tester_01",
      targetType: "product",
      targetId: "prd_beta_ui",
      type: "copyright",
      reason: "Часть элементов интерфейса напоминает закрытый ресурс другого автора.",
      status: "resolved",
      moderatorNotes: "Проверено: элементы входят в открытый набор NEXUS UI, заимствования нет.",
      resolvedAt: d("2026-10-05T12:00:00Z"),
      createdAt: d("2026-10-02T10:00:00Z"),
    },
  ] satisfies (typeof reports.$inferInsert)[];

  return {
    users: userRows,
    servers: serverRows,
    products: productRows,
    content: contentRows,
    follows: followRows,
    serverReviews: serverReviewRows,
    comments: commentRows,
    resourceQaThreads: qaThreadRows,
    resourceQaAnswers: qaAnswerRows,
    resourceQaThreadFollows: qaFollowRows,
    reactions: reactionRows,
    notifications: notificationRows,
    auditEvents: auditEventRows,
    reports: reportRows,
  };
}

export async function seedHistorical(options: HistoricalSeedOptions) {
  const data = createHistoricalSeedData(options);

  return db.transaction(async (tx) => {
    const counts = {
      users: 0,
      servers: 0,
      products: 0,
      content: 0,
      follows: 0,
      serverReviews: 0,
      comments: 0,
      resourceQaThreads: 0,
      resourceQaAnswers: 0,
      resourceQaThreadFollows: 0,
      reactions: 0,
      notifications: 0,
      auditEvents: 0,
      reports: 0,
    };

    counts.users = (
      await tx.insert(users).values(data.users).onConflictDoNothing().returning({ id: users.id })
    ).length;
    counts.servers = (
      await tx
        .insert(servers)
        .values(data.servers)
        .onConflictDoNothing()
        .returning({ id: servers.id })
    ).length;
    counts.products = (
      await tx
        .insert(products)
        .values(data.products)
        .onConflictDoNothing()
        .returning({ id: products.id })
    ).length;
    counts.content = (
      await tx
        .insert(content)
        .values(data.content)
        .onConflictDoNothing()
        .returning({ id: content.id })
    ).length;
    counts.follows = (
      await tx
        .insert(follows)
        .values(data.follows)
        .onConflictDoNothing()
        .returning({ id: follows.id })
    ).length;
    counts.serverReviews = (
      await tx
        .insert(serverReviews)
        .values(data.serverReviews)
        .onConflictDoNothing()
        .returning({ id: serverReviews.id })
    ).length;
    counts.comments = (
      await tx
        .insert(comments)
        .values(data.comments)
        .onConflictDoNothing()
        .returning({ id: comments.id })
    ).length;
    counts.resourceQaThreads = (
      await tx
        .insert(resourceQaThreads)
        .values(data.resourceQaThreads)
        .onConflictDoNothing()
        .returning({ id: resourceQaThreads.id })
    ).length;
    counts.resourceQaAnswers = (
      await tx
        .insert(resourceQaAnswers)
        .values(data.resourceQaAnswers)
        .onConflictDoNothing()
        .returning({ id: resourceQaAnswers.id })
    ).length;

    // Apply the resolved state for qa_thr_003 only after its answer exists
    // (resource_qa_threads.resolved_answer_id has a non-deferrable FK to
    // resource_qa_answers, so the thread must first be inserted as open).
    await tx
      .update(resourceQaThreads)
      .set({
        status: "resolved",
        resolvedAnswerId: "qa_ans_003",
        resolvedAt: d("2026-08-15T09:00:00Z"),
        resolvedBy: "usr_dev_001",
        updatedAt: d("2026-08-15T09:00:00Z"),
      })
      .where(eq(resourceQaThreads.id, "qa_thr_003"));
    counts.resourceQaThreadFollows = (
      await tx
        .insert(resourceQaThreadFollows)
        .values(data.resourceQaThreadFollows)
        .onConflictDoNothing()
        .returning({ userId: resourceQaThreadFollows.userId })
    ).length;
    counts.reactions = (
      await tx
        .insert(reactions)
        .values(data.reactions)
        .onConflictDoNothing()
        .returning({ id: reactions.id })
    ).length;
    counts.notifications = (
      await tx
        .insert(notifications)
        .values(data.notifications)
        .onConflictDoNothing()
        .returning({ id: notifications.id })
    ).length;
    counts.auditEvents = (
      await tx
        .insert(auditEvents)
        .values(data.auditEvents)
        .onConflictDoNothing()
        .returning({ id: auditEvents.id })
    ).length;
    counts.reports = (
      await tx
        .insert(reports)
        .values(data.reports)
        .onConflictDoNothing()
        .returning({ id: reports.id })
    ).length;

    return counts;
  });
}
