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
      name: "support-feature-public-api",
      severity: "error",
      from: { path: "^site/src/(?!features/support/)" },
      to: {
        path: "^site/src/features/support/(?!(?:center|download-help|messages-server|page-server|thread)\\.ts$)",
      },
    },
    {
      name: "support-feature-does-not-import-routing",
      severity: "error",
      from: { path: "^site/src/features/support/" },
      to: { path: "^site/src/app/" },
    },
    {
      name: "support-client-isolation",
      severity: "error",
      from: {
        path: "^site/src/features/support/(?:(?:center|download-help|thread)\\.ts$|components/)",
      },
      to: {
        path: "^(?:site/src/(?:features/(?!support/|shell/(?:locale|session|auth-return|guest-auth|session-error|modal-dialog|home-personal|pwa-service-worker|confirm-action|action-confirm-checkbox)\\.ts$)|features/support/(?:server/|(?:messages-server|page-server)\\.ts$)|lib/(?!(?:i18n(?:\\.ts$|/)|(?:support-response|support-retry|private-api-request|support-workspace-contract|support-workspace-copy|user-platform-client|user-platform-contract|user-platform-copy|support-message-discovery-copy|support-message-discovery-contract|private-change-history-query)\\.ts$)))|site/packages/(?:db|storage|security|config)/)",
      },
    },
    {
      name: "support-client-has-no-node-builtins",
      severity: "error",
      from: {
        path: "^site/src/features/support/(?:(?:center|download-help|thread)\\.ts$|components/)",
      },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "trust-feature-public-api",
      severity: "error",
      from: { path: "^site/src/(?!features/trust/)" },
      to: {
        path: "^site/src/features/trust/(?!(?:public-user-trust|public-context-trust-page)\\.ts$)",
      },
    },
    {
      name: "trust-feature-does-not-import-routing",
      severity: "error",
      from: { path: "^site/src/features/trust/" },
      to: { path: "^site/src/app/" },
    },
    {
      name: "trust-client-isolation",
      severity: "error",
      from: {
        path: "^site/src/features/trust/(?:(?:public-user-trust)\\.ts$|components/)",
      },
      to: {
        path: "^(?:site/src/(?:features/trust/(?:server/)|lib/(?!(?:i18n(?:\\.ts$|/)|(?:public-user-trust-contract|public-user-trust-copy|public-verification-history-copy|user-platform-copy)\\.ts$)))|site/packages/(?:db|storage|security|config)/)",
      },
    },
    {
      name: "trust-client-has-no-node-builtins",
      severity: "error",
      from: {
        path: "^site/src/features/trust/(?:(?:public-user-trust)\\.ts$|components/)",
      },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "moderation-feature-public-api",
      severity: "error",
      from: { path: "^site/src/(?!features/moderation/)" },
      to: {
        path: "^site/src/features/moderation/(?!(?:object-report|report-controls|reports-server|verification-amend|verification-controls|verification-workspace|admin-home|storage-maintenance|admin-status-labels|verification-moderation)\\.ts$)",
      },
    },
    {
      name: "moderation-feature-does-not-import-routing",
      severity: "error",
      from: { path: "^site/src/features/moderation/" },
      to: { path: "^site/src/app/" },
    },
    {
      name: "moderation-client-isolation",
      severity: "error",
      from: {
        path: "^site/src/features/moderation/(?:(?:object-report|report-controls|verification-amend|verification-controls|verification-workspace|storage-maintenance|admin-status-labels|verification-moderation)\\.ts$|components/)",
      },
      to: {
        path: "^(?:site/src/(?:features/(?!moderation/|community/report-evidence-links\\.ts$|resources/(?:qa-report-actions|quarantine-controls)\\.ts$|shell/(?:locale|session|auth-return|guest-auth|session-error|modal-dialog|home-personal|pwa-service-worker|confirm-action|action-confirm-checkbox)\\.ts$)|features/moderation/(?:server/|(?:reports-server)\\.ts$)|lib/(?!(?:i18n(?:\\.ts$|/)|(?:platform-report-i18n|private-api-request|admin-action-confirmation|community-report-copy|order-case-i18n|resource-review-i18n|storage-maintenance-i18n|user-platform-copy|user-platform-client|user-platform-contract|verification-applications-contract|content-discussion-contract|verification-workspace-contract|verification-applications-copy|verification-workspace-copy)\\.ts$)))|site/packages/(?:db|storage|security|config)/)",
      },
    },
    {
      name: "moderation-client-has-no-node-builtins",
      severity: "error",
      from: {
        path: "^site/src/features/moderation/(?:(?:object-report|report-controls|verification-amend|verification-controls|verification-workspace|storage-maintenance|admin-status-labels|verification-moderation)\\.ts$|components/)",
      },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "accounts-feature-public-api",
      severity: "error",
      from: { path: "^site/src/(?!features/accounts/)" },
      to: {
        path: "^site/src/features/accounts/(?!(?:auth|controls|settings|context|profile|change-history|profile-change-history|profile-pagination|developer-experience|settings-client-api|public-profile-activity-server|ad-preference)\\.ts$)",
      },
    },
    {
      name: "accounts-feature-does-not-import-routing",
      severity: "error",
      from: { path: "^site/src/features/accounts/" },
      to: { path: "^site/src/app/" },
    },
    {
      name: "accounts-client-isolation",
      severity: "error",
      from: {
        path: "^site/src/features/accounts/(?:(?:auth|controls|settings|context|profile|change-history|profile-change-history|profile-pagination|developer-experience|ad-preference|settings-client-api)\\.ts$|components/)",
      },
      to: {
        path: "^(?:site/src/(?:features/(?!accounts/|notifications/preferences\\.ts$|shell/(?:locale|session|auth-return|guest-auth|session-error|modal-dialog|home-personal|pwa-service-worker|confirm-action|action-confirm-checkbox)\\.ts$)|features/accounts/(?:server/)|lib/(?!(?:i18n(?:\\.ts$|/)|(?:notification-preferences-confirmation|notification-inbox-copy|feature-flags|profile-privacy-copy|profile-privacy-contract|private-change-history-copy|private-change-history-query|profile-change-history-contract|user-platform-client|private-api-request|user-platform-contract|user-platform-copy|verification-workspace-contract|verification-workspace-copy)\\.ts$)))|site/packages/(?:db|storage|security|config)/)",
      },
    },
    {
      name: "accounts-client-has-no-node-builtins",
      severity: "error",
      from: {
        path: "^site/src/features/accounts/(?:(?:auth|controls|settings|context|profile|change-history|profile-change-history|profile-pagination|developer-experience|ad-preference|settings-client-api)\\.ts$|components/)",
      },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "shell-feature-public-api",
      severity: "error",
      from: { path: "^site/src/(?!features/shell/)" },
      to: {
        path: "^site/src/features/shell/(?!(?:shell|navbar|footer|sidebar|locale|session|auth-session|auth-return|guest-auth|session-error|modal-dialog|home-personal|pwa-service-worker|legal-document|copyable-plain-code-block|confirm-action|action-confirm-checkbox|theme-preference|home-personal-preference)\\.ts$)",
      },
    },
    {
      name: "shell-feature-does-not-import-routing",
      severity: "error",
      from: { path: "^site/src/features/shell/" },
      to: { path: "^site/src/app/" },
    },
    {
      name: "shell-client-isolation",
      severity: "error",
      from: {
        path: "^site/src/features/shell/(?:(?:shell|navbar|footer|sidebar|locale|session|auth-session|auth-return|guest-auth|session-error|modal-dialog|home-personal|pwa-service-worker|legal-document|copyable-plain-code-block|confirm-action|action-confirm-checkbox|theme-preference|home-personal-preference)\\.ts$|components/)",
      },
      to: {
        path: "^(?:site/src/(?:features/(?!shell/|accounts/controls\\.ts$|notifications/bell\\.ts$)|features/shell/(?:server/)|lib/(?!(?:i18n(?:\\.ts$|/)|(?:managed-server-view|managed-server-copy|publication-feed-copy|organization-workspace-copy|organization-batch-copy|user-platform-copy|community-report-copy|content-reaction-copy|content-discussion-copy|discussion-workspace-copy|platform-report-i18n|verification-workspace-copy|license-maintenance-i18n|notification-copy|notification-inbox-copy|private-api-request|resource-release-watches-i18n|home-personal-changes-types)\\.ts$)))|site/packages/(?:db|storage|security|config)/)",
      },
    },
    {
      name: "shell-client-has-no-node-builtins",
      severity: "error",
      from: {
        path: "^site/src/features/shell/(?:(?:shell|navbar|footer|sidebar|locale|session|auth-session|auth-return|guest-auth|session-error|modal-dialog|home-personal|pwa-service-worker|legal-document|copyable-plain-code-block|confirm-action|action-confirm-checkbox|theme-preference|home-personal-preference)\\.ts$|components/)",
      },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "discovery-feature-public-api",
      severity: "error",
      from: { path: "^site/src/(?!features/discovery/)" },
      to: { path: "^site/src/features/discovery/(?!(?:directory-server)\\.ts$)" },
    },
    {
      name: "discovery-feature-does-not-import-routing",
      severity: "error",
      from: { path: "^site/src/features/discovery/" },
      to: { path: "^site/src/app/" },
    },
    {
      name: "library-feature-public-api",
      severity: "error",
      from: { path: "^site/src/(?!features/library/)" },
      to: {
        path: "^site/src/features/library/(?!(?:collection-command|collection-batch|collection-item-copy|collection-import|collection-restore|membership-batch|release-follow|release-selection|library-release-request|library-membership-batch-confirmation|library-selection-batches-confirmation|library-membership-batches-i18n|library-selection-batches-i18n|release-comparison-server|release-history-server|collection-releases-server|collection-requirements-server|collections-server|membership-history-server|selection-batch-server|collection-import-page-server|collection-reconcile-page-server|collection-compare-page-server|collection-receipt-page-server|collection-history-page-server|collection-inventory-page-server|resource-collections-page-server)\\.ts$)",
      },
    },
    {
      name: "library-feature-does-not-import-routing",
      severity: "error",
      from: { path: "^site/src/features/library/" },
      to: { path: "^site/src/app/" },
    },
    {
      name: "library-client-isolation",
      severity: "error",
      from: {
        path: "^site/src/features/library/(?:(?:collection-command|collection-batch|collection-item-copy|collection-import|collection-restore|membership-batch|release-follow|release-selection|library-release-request|library-membership-batch-confirmation|library-selection-batches-confirmation|library-membership-batches-i18n|library-selection-batches-i18n)\\.ts$|components/)",
      },
      to: {
        path: "^(?:site/src/(?:features/(?!library/|shell/(?:locale|session|auth-return|guest-auth|session-error|modal-dialog|home-personal|pwa-service-worker|confirm-action|action-confirm-checkbox)\\.ts$)|features/library/(?:server/|(?:collections|membership-history|selection-batch|release-comparison|release-history|collection-releases|collection-requirements|collection-import-page|collection-reconcile-page|collection-compare-page|collection-receipt-page|collection-history-page|collection-inventory-page|resource-collections-page)-server\\.ts$)|lib/(?!(?:i18n(?:\\.ts$|/)|(?:library-collection-receipts-i18n|library-collections-confirmation|library-collections-i18n|library-collections-query|private-api-request|library-collection-manifests-i18n|library-membership-history-i18n|library-membership-history-query|library-release-comparison-i18n|resource-release-control-i18n|resource-release-control-confirmation)\\.ts$)))|site/packages/(?:db|storage|security|config)/)",
      },
    },
    {
      name: "library-client-has-no-node-builtins",
      severity: "error",
      from: {
        path: "^site/src/features/library/(?:(?:collection-command|collection-batch|collection-item-copy|collection-import|collection-restore|membership-batch|release-follow|release-selection|library-release-request|library-membership-batch-confirmation|library-selection-batches-confirmation|library-membership-batches-i18n|library-selection-batches-i18n)\\.ts$|components/)",
      },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "notifications-feature-public-api",
      severity: "error",
      from: { path: "^site/src/(?!features/notifications/)" },
      to: {
        path: "^site/src/features/notifications/(?!(?:bell|preferences|center-server|notification-inbox-events|visible-polling|notification-inbox-export-client)\\.ts$)",
      },
    },
    {
      name: "notifications-feature-does-not-import-routing",
      severity: "error",
      from: { path: "^site/src/features/notifications/" },
      to: { path: "^site/src/app/" },
    },
    {
      name: "notifications-client-isolation",
      severity: "error",
      from: {
        path: "^site/src/features/notifications/(?:(?:bell|preferences|notification-inbox-events|visible-polling|notification-inbox-export-client)\\.ts$|components/)",
      },
      to: {
        path: "^(?:site/src/(?:features/(?!notifications/|shell/(?:locale|session|auth-return|guest-auth|session-error|modal-dialog|home-personal|pwa-service-worker|confirm-action|action-confirm-checkbox)\\.ts$)|features/notifications/(?:server/|center-server\\.ts$)|lib/(?!(?:i18n(?:\\.ts$|/)|(?:notification-copy|license-maintenance-i18n|resource-release-watches-i18n|notification-inbox-copy|private-api-request|notification-inbox-contract|content-discussion-contract|notification-preferences-confirmation)\\.ts$)))|site/packages/(?:db|storage|security|config)/)",
      },
    },
    {
      name: "notifications-client-has-no-node-builtins",
      severity: "error",
      from: {
        path: "^site/src/features/notifications/(?:(?:bell|preferences|notification-inbox-events|visible-polling|notification-inbox-export-client)\\.ts$|components/)",
      },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "organizations-feature-public-api",
      severity: "error",
      from: { path: "^site/src/(?!features/organizations/)" },
      to: {
        path: "^site/src/features/organizations/(?!(?:workspace|team|profile|history-view|organization-member-confirmation|content-editor-server|publication-history-server|directory-page-server|workspace-page-server|team-page-server|activity-page-server|content-page-server|public-directory-server|public-profile-server|public-activity-server|public-trust-server)\\.ts$)",
      },
    },
    {
      name: "organizations-feature-does-not-import-routing",
      severity: "error",
      from: { path: "^site/src/features/organizations/" },
      to: { path: "^site/src/app/" },
    },
    {
      name: "organizations-client-isolation",
      severity: "error",
      from: {
        path: "^site/src/features/organizations/(?:(?:workspace|team|profile|history-view|organization-member-confirmation)\\.ts$|components/)",
      },
      to: {
        path: "^(?:site/src/(?:features/(?!organizations/|accounts/change-history\\.ts$|shell/(?:locale|session|auth-return|guest-auth|session-error|modal-dialog|home-personal|pwa-service-worker|confirm-action|action-confirm-checkbox)\\.ts$)|features/organizations/(?:server/|(?:content-editor|publication-history|directory-page|workspace-page|team-page|activity-page|content-page|public-directory|public-profile|public-activity|public-trust)-server\\.ts$)|lib/(?!(?:i18n(?:\\.ts$|/)|(?:organization-governance-contract|organization-workspace-contract|user-platform-contract|private-change-history-query|organization-governance-copy|organization-workspace-copy|organization-batch-copy|user-platform-copy|private-change-history-copy|organization-workspace-client|user-platform-client|private-api-request|organization-team-contract|content-discussion-contract|organization-team-copy|organization-batch-contract|organization-content-copy)\\.ts$)))|site/packages/(?:db|storage|security|config)/)",
      },
    },
    {
      name: "organizations-client-has-no-node-builtins",
      severity: "error",
      from: {
        path: "^site/src/features/organizations/(?:(?:workspace|team|profile|history-view|organization-member-confirmation)\\.ts$|components/)",
      },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "community-feature-public-api",
      severity: "error",
      from: { path: "^site/src/(?!features/community/)" },
      to: {
        path: "^site/src/features/community/(?!(?:discussion|topic-form|report-form|report-evidence-links|own-discussion|article-view|publication-feed|author-content-form|author-publication-restore|catalog-controls|reactions|reaction-removal|content-moderation|object-mute-controls|follow|discussion-mutation-confirmation|follow-confirmation|reports-server|report-history-server|report-groups-server|moderation-server|moderated-discussion-server|discussion-reports-server|publication-reports-server|publication-feed-loading-server|context-history-server|community-page-server|new-topic-page-server|articles-page-server|article-page-server|own-discussions-page-server|own-discussion-page-server|author-desk-page-server|author-create-page-server|author-edit-page-server|author-history-page-server|following-feed-page-server)\\.ts$)",
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
      from: {
        path: "^site/src/features/community/(?:(?:discussion|topic-form|report-form|report-evidence-links|own-discussion|article-view|publication-feed|author-content-form|author-publication-restore|catalog-controls|reactions|reaction-removal|content-moderation|object-mute-controls|follow|discussion-mutation-confirmation|follow-confirmation)\\.ts$|components/)",
      },
      to: {
        path: "^(?:site/src/(?:features/community/(?:server(?:\\.ts$|/)|(?:reports|report-history|report-groups|moderation|moderated-discussion|discussion-reports|publication-reports|publication-feed-loading|context-history|community-page|new-topic-page|articles-page|article-page|own-discussions-page|own-discussion-page|author-desk-page|author-create-page|author-edit-page|author-history-page|following-feed-page)-server\\.ts$)|lib/(?!(?:i18n(?:\\.ts$|/)|(?:community-report-contract|community-report-copy|user-platform-copy|private-api-request|user-platform-client|user-platform-contract|community-topic-intent|community-topic-submission|content-comment-client|content-comment-confirmation|content-discussion-copy|content-discussion-contract|discussion-compose-draft|discussion-workspace-copy|follow-workspace-copy|follow-workspace-contract|community-report-groups-copy|community-report-history-copy|discussion-reports-copy|community-report-groups-contract|community-report-history-contract|private-change-history-query|private-change-history-copy|community-moderation-contract|community-moderation-copy|moderated-discussion-contract|moderated-discussion-copy|discussion-reports-contract|report-batch-contract|report-batch-copy|discussion-workspace-contract|publication-feed-contract|publication-feed-copy|author-publication-desk-copy|author-publication-desk-contract|organization-content-copy|server-content-copy|support-workspace-contract|organization-publication-history-contract|organization-publication-history-copy|server-publication-history-contract|server-publication-history-copy|admin-action-confirmation|content-reaction-contract|content-reaction-copy)\\.ts$)))|site/packages/(?:db|storage|security|config)/)",
      },
    },
    {
      name: "community-client-has-no-node-builtins",
      severity: "error",
      from: {
        path: "^site/src/features/community/(?:(?:discussion|topic-form|report-form|report-evidence-links|own-discussion|article-view|publication-feed|author-content-form|author-publication-restore|catalog-controls|reactions|reaction-removal|content-moderation|object-mute-controls|follow|discussion-mutation-confirmation|follow-confirmation)\\.ts$|components/)",
      },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "commerce-feature-public-api",
      severity: "error",
      from: { path: "^site/src/(?!features/commerce/)" },
      to: {
        path: "^site/src/features/commerce/(?!(?:workspace-history|license-controls|license-archive|license-detail|license-runtime-response|order-case-response|plan-review-confirmation|license-control-confirmation|subscription-confirmation|license-history-server|subscription-controls|subscription-workspace|order-cancellation|order-case-forms|order-terms|order-case-server|commercial-plans|plan-reviews|plan-reviews-workspace|plan-review-detail|seller-sales)\\.ts$)",
      },
    },
    {
      name: "commerce-feature-does-not-import-routing",
      severity: "error",
      from: { path: "^site/src/features/commerce/" },
      to: { path: "^site/src/app/" },
    },
    {
      name: "commerce-client-isolation",
      severity: "error",
      from: {
        path: "^site/src/features/commerce/(?:(?:workspace-history|license-controls|subscription-controls|order-cancellation|order-case-forms|commercial-plans|plan-reviews|license-runtime-response|order-case-response|plan-review-confirmation|license-control-confirmation|subscription-confirmation)\\.ts$|components/)",
      },
      to: {
        path: "^(?:site/src/(?:features/(?!commerce/|shell/(?:locale|confirm-action|action-confirm-checkbox)\\.ts$)|lib/(?!(?:i18n(?:\\.ts$|/)|(?:commerce-history-format|commerce-history-i18n|commercial-confirmation|commercial-i18n|license-control-i18n|order-case-i18n|plan-reviews-i18n|plan-reviews-query|private-api-request|subscriptions-i18n|subscriptions-query|support-retry)\\.ts$)))|site/packages/(?:db|storage|security|config)/)",
      },
    },
    {
      name: "commerce-client-has-no-node-builtins",
      severity: "error",
      from: {
        path: "^site/src/features/commerce/(?:(?:workspace-history|license-controls|subscription-controls|order-cancellation|order-case-forms|commercial-plans|plan-reviews|license-runtime-response|order-case-response|plan-review-confirmation|license-control-confirmation|subscription-confirmation)\\.ts$|components/)",
      },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "servers-feature-public-api",
      severity: "error",
      comment:
        "Other application modules consume Servers only through explicit public entrypoints.",
      from: { path: "^site/src/(?!features/servers/)" },
      to: {
        path: "^site/src/features/servers/(?!(?:client|server|model|connect|statistics-export|statistics-view|registration|claim-controls|details-controls|review-controls|follow|visibility-batch|workspace-navigation|server-organization-options|statistics-server|observations-server|history-server|claim-status-server|managed-card-server|content-editor-server|activity-server|publication-history-server|updates-server)\\.ts$)",
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
        path: "^site/src/features/servers/(?:(?:client|connect|statistics-export|statistics-view|registration|claim-controls|details-controls|review-controls|follow|visibility-batch|workspace-navigation|server-organization-options)\\.ts$|components/|model(?:\\.ts$|/))",
      },
      to: {
        path: "^(?:site/src/(?:features/servers/(?:server(?:\\.ts$|/)|(?:statistics|observations|history|claim-status|managed-card|content-editor|activity|publication-history|updates)-server\\.ts$)|lib/(?!(?:i18n(?:\\.ts$|/)|(?:private-api-request|server-history-window|server-statistics-contract|server-statistics-copy|server-statistics-download|server-claim-confirmation|server-claim-status-view|server-mutation-confirmation|server-mutation-errors|server-workspace-nav-i18n|managed-server-copy|server-workspace-contract|server-workspace-copy|user-platform-client|user-platform-copy|user-platform-contract|follow-initial-state|follow-confirmation|follow-workspace-contract|follow-workspace-copy|content-discussion-contract|server-review-confirmation|server-review-i18n)\\.ts$)))|site/packages/(?:db|storage|security|config)/)",
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
        path: "^site/src/features/servers/(?:(?:client|connect|statistics-export|statistics-view|registration|claim-controls|details-controls|review-controls|follow|visibility-batch|workspace-navigation|server-organization-options)\\.ts$|components/|model(?:\\.ts$|/))",
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
        path: "^site/src/features/resources/(?!(?:view|detail-view|reviews-view|review-controls|compatibility-controls|variant-controls|publisher-view|publisher-navigation|create-controls|copy-controls|copy-view|author-controls|lifecycle-controls|moderation-controls|requirements-view|quarantine-controls|qa-report-actions|release-watch-batch|cart-controls|cart-view|download|release-watch|client|evidence|resource-submission-intent|mta-version-target|build-moderation-ui|new-resource-response|pending-resource-draft|resource-build-workspace-response|resource-copy-confirmation|resource-review-confirmation|author-resource-response|resource-management-confirmation|resource-publication-readiness-i18n|resource-release-watch-batch-confirmation|publishing-error-message|server|(?:detail|versions|reviews|media|build|package|requirements|review-report|delivery)-server|model)\\.ts$)",
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
        path: "^site/src/features/resources/(?:(?:view|detail-view|reviews-view|review-controls|compatibility-controls|variant-controls|publisher-view|publisher-navigation|create-controls|copy-controls|copy-view|author-controls|lifecycle-controls|moderation-controls|requirements-view|quarantine-controls|qa-report-actions|release-watch-batch|cart-controls|cart-view|download|release-watch|client|evidence|resource-submission-intent|mta-version-target|build-moderation-ui|new-resource-response|pending-resource-draft|resource-build-workspace-response|resource-copy-confirmation|resource-review-confirmation|author-resource-response|resource-management-confirmation|resource-publication-readiness-i18n|resource-release-watch-batch-confirmation|publishing-error-message)\\.ts$|components/|model(?:\\.ts$|/))",
      },
      to: {
        path: "^(?:site/src/(?:features/resources/(?:server|(?:detail|versions|reviews|media|build|package|requirements|review-report|delivery)-server)(?:\\.ts$|/)|lib/(?!(?:i18n|public-resource-attribution|product-type-labels|resource-image-url|resource-media-i18n|resource-review-i18n|product-dependency-resolution|reverse-dependency-summary|resource-management-i18n|resource-publisher-i18n|resource-publisher-query|resource-requirements-i18n|resource-publisher-nav-i18n|resource-copy-i18n|author-resource-draft|author-resource-requests|resource-commerce-i18n|resource-release-control-confirmation|resource-release-control-i18n|build-file-validation|user-platform-client|license-model-i18n|resource-qa-i18n|resource-release-watches-i18n|community-report-copy|resource-cart-receipts-i18n|resource-cart-receipts-query|resource-cart-review-confirmation|resource-commerce-confirmation|resource-build-workspace-i18n|admin-action-confirmation|verification-workspace-copy|private-request|resource-deliveries-i18n|resource-download-client|private-api-request|build-package-i18n|mta-meta-inspector-messages)\\.ts$))|site/packages/(?:db|storage|security|config)/)",
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
        path: "^site/src/features/resources/(?:(?:view|detail-view|reviews-view|review-controls|compatibility-controls|variant-controls|publisher-view|publisher-navigation|create-controls|copy-controls|copy-view|author-controls|lifecycle-controls|moderation-controls|requirements-view|quarantine-controls|qa-report-actions|release-watch-batch|cart-controls|cart-view|download|release-watch|client|evidence|resource-submission-intent|mta-version-target|build-moderation-ui|new-resource-response|pending-resource-draft|resource-build-workspace-response|resource-copy-confirmation|resource-review-confirmation|author-resource-response|resource-management-confirmation|resource-publication-readiness-i18n|resource-release-watch-batch-confirmation|publishing-error-message)\\.ts$|components/|model(?:\\.ts$|/))",
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
