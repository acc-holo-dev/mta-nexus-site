const { HTTP_DB_EXCEPTION_PATH } = require("./.dependency-cruiser.exceptions.cjs");

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular-dependencies",
      severity: "error",
      comment: "Production modules must have an acyclic dependency graph.",
      from: {},
      to: { circular: true },
    },
    {
      name: "packages-do-not-import-apps",
      severity: "error",
      // CI scenario scripts may orchestrate the app; package source must not depend on it.
      from: { path: "^(?:site/)?packages/[^/]+/src/" },
      to: { path: "^(?:apps/|site/(?!packages/))" },
    },
    {
      name: "domain-is-independent",
      severity: "error",
      from: { path: "^(?:site/)?packages/domain/" },
      to: { path: "^(?:apps/|site/(?!packages/)|(?:site/)?packages/(?!domain/))" },
    },
    {
      name: "ui-does-not-import-server-packages",
      severity: "error",
      from: { path: "^(?:site/)?packages/ui/" },
      to: { path: "^(?:site/)?packages/(db|storage|security|config)/" },
    },
    {
      name: "community-feature-public-api",
      severity: "error",
      from: { path: "^site/src/(?!features/community/)" },
      to: {
        path: "^site/src/features/community/(?!(?:discussion|topic-form|report-form|comment-actions)\\.ts$)",
      },
    },
    {
      name: "community-feature-does-not-import-routing",
      severity: "error",
      from: { path: "^site/src/features/community/" },
      to: { path: "^site/src/app/" },
    },
    {
      name: "community-client-isolation",
      severity: "error",
      from: { path: "^site/src/features/community/" },
      to: {
        path: "^(?:site/src/(?:features/community/server(?:\\.ts$|/)|lib/(?!(?:i18n(?:\\.ts$|/)|(?:community-report-contract|community-report-copy|user-platform-copy|private-api-request|user-platform-client|user-platform-contract|community-topic-intent|community-topic-submission|content-comment-client|content-comment-confirmation|content-discussion-copy|content-discussion-contract|discussion-compose-draft|discussion-workspace-copy|follow-workspace-copy|follow-workspace-contract|follow-confirmation|discussion-mutation-confirmation)\\.ts$)))|site/packages/(?:db|storage|security|config)/)",
      },
    },
    {
      name: "community-client-has-no-node-builtins",
      severity: "error",
      from: { path: "^site/src/features/community/" },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "servers-feature-public-api",
      severity: "error",
      comment:
        "Other application modules consume Servers only through explicit public entrypoints.",
      from: { path: "^site/src/(?!features/servers/)" },
      to: {
        path: "^site/src/features/servers/(?!(?:client|server|model|connect|statistics-export|statistics-view|registration|claim-controls|details-controls|review-controls|follow|visibility-batch|workspace-navigation|statistics-server|observations-server|history-server|claim-status-server|managed-card-server|content-editor-server|activity-server|publication-history-server|updates-server)\\.ts$)",
      },
    },
    {
      name: "servers-feature-does-not-import-routing",
      severity: "error",
      from: { path: "^site/src/features/servers/" },
      to: { path: "^site/src/app/" },
    },
    {
      name: "servers-client-isolation",
      severity: "error",
      comment:
        "Client components and pure models cannot reach server entrypoints, services, request locale or infrastructure packages.",
      from: {
        path: "^site/src/features/servers/(?:(?:client|connect|statistics-export|statistics-view|registration|claim-controls|details-controls|review-controls|follow|visibility-batch|workspace-navigation)\\.ts$|components/|model(?:\\.ts$|/))",
      },
      to: {
        path: "^(?:site/src/(?:features/servers/(?:server(?:\\.ts$|/)|(?:statistics|observations|history|claim-status|managed-card|content-editor|activity|publication-history|updates)-server\\.ts$)|lib/(?!(?:i18n(?:\\.ts$|/)|(?:private-api-request|server-history-window|server-statistics-contract|server-statistics-copy|server-statistics-download|server-claim-confirmation|server-claim-status-view|server-mutation-confirmation|server-mutation-errors|server-organization-options|server-workspace-nav-i18n|managed-server-copy|server-workspace-contract|server-workspace-copy|user-platform-client|user-platform-copy|user-platform-contract|follow-initial-state|follow-confirmation|follow-workspace-contract|follow-workspace-copy|content-discussion-contract|server-review-confirmation|server-review-i18n)\\.ts$)))|site/packages/(?:db|storage|security|config)/)",
      },
    },
    {
      name: "servers-model-is-pure",
      severity: "error",
      from: { path: "^site/src/features/servers/model(?:\\.ts$|/)" },
      to: {
        path: "^(?:site/src/(?!features/servers/model(?:\\.ts$|/))|site/packages/(?!domain/))",
      },
    },
    {
      name: "servers-model-has-no-framework",
      severity: "error",
      from: { path: "^site/src/features/servers/model(?:\\.ts$|/)" },
      to: { path: "(?:^|/)node_modules/(?:react|react-dom|next)(?:/|$)" },
    },
    {
      name: "servers-client-has-no-node-builtins",
      severity: "error",
      from: {
        path: "^site/src/features/servers/(?:(?:client|connect|statistics-export|statistics-view|registration|claim-controls|details-controls|review-controls|follow|visibility-batch|workspace-navigation)\\.ts$|components/|model(?:\\.ts$|/))",
      },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "resources-feature-public-api",
      severity: "error",
      comment:
        "Other application modules consume the Resources feature through view, server or model entrypoints.",
      from: { path: "^site/src/(?!features/resources/)" },
      to: {
        path: "^site/src/features/resources/(?!(?:view|detail-view|reviews-view|review-controls|compatibility-controls|variant-controls|publisher-view|publisher-navigation|create-controls|copy-controls|copy-view|author-controls|lifecycle-controls|moderation-controls|requirements-view|quarantine-controls|qa-report-actions|release-watch-batch|cart-controls|cart-view|download|release-watch|client|evidence|server|(?:detail|versions|reviews|media|build|package|requirements|review-report|delivery)-server|model)\\.ts$)",
      },
    },
    {
      name: "resources-feature-does-not-import-routing",
      severity: "error",
      from: { path: "^site/src/features/resources/" },
      to: { path: "^site/src/app/" },
    },
    {
      name: "resources-view-isolation",
      severity: "error",
      comment:
        "Shared views and pure models cannot reach server entrypoints, services, request locale or infrastructure packages.",
      from: {
        path: "^site/src/features/resources/(?:(?:view|detail-view|reviews-view|review-controls|compatibility-controls|variant-controls|publisher-view|publisher-navigation|create-controls|copy-controls|copy-view|author-controls|lifecycle-controls|moderation-controls|requirements-view|quarantine-controls|qa-report-actions|release-watch-batch|cart-controls|cart-view|download|release-watch|client|evidence)\\.ts$|components/|model(?:\\.ts$|/))",
      },
      to: {
        path: "^(?:site/src/(?:features/resources/(?:server|(?:detail|versions|reviews|media|build|package|requirements|review-report|delivery)-server)(?:\\.ts$|/)|lib/(?!(?:i18n|public-resource-attribution|product-type-labels|resource-image-url|resource-media-i18n|resource-review-i18n|resource-review-confirmation|product-dependency-resolution|reverse-dependency-summary|resource-management-i18n|resource-management-confirmation|resource-publisher-i18n|resource-publisher-query|resource-requirements-i18n|resource-publisher-nav-i18n|resource-publication-readiness-i18n|resource-copy-confirmation|resource-copy-i18n|author-resource-response|author-resource-draft|author-resource-requests|resource-commerce-i18n|resource-release-control-confirmation|resource-release-control-i18n|build-file-validation|new-resource-response|pending-resource-draft|publishing-error-message|resource-submission-intent|user-platform-client|license-model-i18n|resource-qa-i18n|resource-release-watches-i18n|resource-release-watch-batch-confirmation|community-report-copy|resource-cart-receipts-i18n|resource-cart-receipts-query|resource-cart-review-confirmation|resource-commerce-confirmation|resource-build-workspace-i18n|resource-build-workspace-response|admin-action-confirmation|build-moderation-ui|verification-workspace-copy|private-request|resource-deliveries-i18n|resource-download-client|private-api-request|build-package-i18n|mta-meta-inspector-messages|mta-version-target)\\.ts$))|site/packages/(?:db|storage|security|config)/)",
      },
    },
    {
      name: "resources-model-is-pure",
      severity: "error",
      from: { path: "^site/src/features/resources/model(?:\\.ts$|/)" },
      to: {
        path: "^(?:site/src/(?!features/resources/model(?:\\.ts$|/))|site/packages/(?!domain/))",
      },
    },
    {
      name: "resources-model-has-no-framework",
      severity: "error",
      from: { path: "^site/src/features/resources/model(?:\\.ts$|/)" },
      to: { path: "(?:^|/)node_modules/(?:react|react-dom|next)(?:/|$)" },
    },
    {
      name: "resources-view-has-no-node-builtins",
      severity: "error",
      from: {
        path: "^site/src/features/resources/(?:(?:view|detail-view|reviews-view|review-controls|compatibility-controls|variant-controls|publisher-view|publisher-navigation|create-controls|copy-controls|copy-view|author-controls|lifecycle-controls|moderation-controls|requirements-view|quarantine-controls|qa-report-actions|release-watch-batch|cart-controls|cart-view|download|release-watch|client|evidence)\\.ts$|components/|model(?:\\.ts$|/))",
      },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "http-handlers-use-services-for-db",
      severity: "error",
      comment:
        "API routes must not take a new direct @nexus/db dependency outside the documented read/health or grandfathered service-required lists in docs/ARCHITECTURE.md.",
      from: {
        path: "^(?:apps/web|site)/src/app/api/",
        pathNot: HTTP_DB_EXCEPTION_PATH,
      },
      to: { path: "^(?:site/)?packages/db/" },
    },
    {
      name: "no-unresolved-imports",
      severity: "error",
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    tsConfig: { fileName: "tsconfig.json" },
    // SWC parses source; packageExtensions still supply TypeScript 6 for
    // tsPreCompilationDeps until dependency-cruiser ships stable TypeScript 7 support.
    parser: "swc",
    tsPreCompilationDeps: true,
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(\\.test\\.tsx?$|/(?:node_modules|\\.next|dist)/)" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
    },
  },
};
