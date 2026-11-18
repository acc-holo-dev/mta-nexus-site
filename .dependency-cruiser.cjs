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
        path: "^site/src/features/support/(?!(?:center|download-help|messages-server|page-server|thread|support-message-discovery-copy|support-response|support-workspace-copy|support-retry|support-workspace-contract|support-message-discovery-contract|support-http|support-idempotency)\\.ts$)",
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
        path: "^site/src/features/support/(?:(?:center|download-help|thread|support-message-discovery-copy|support-response|support-workspace-copy|support-retry|support-workspace-contract|support-message-discovery-contract)\\.ts$|components/)",
      },
      to: {
        path: "^(?:site/src/(?:features/(?!support/resources/resource-attachment-filename.ts$|resources/resource-download-client.ts$|resources/download-web-stream.ts$|resources/resource-delivery-stream.ts$|servers/managed-server-view.ts$|shell/offline-cache-policy.ts$|servers/server-content-api.ts$|servers/server-statistics-export.ts$|resources/resource-activity-csv.ts$|community/publication-feed-view.ts$|library/library-view.ts$|notifications/web-push-subscription.ts$|trust/verification-workspace-api.ts$|shell/request-client-ip.ts$|accounts/user-platform-api.ts$|shell/public-platform-api.ts$|servers/server-statistics-http.ts$|servers/server-observation-browser-http.ts$|accounts/private-change-history-download.ts$|organizations/organization-workspace-api.ts$|organizations/organization-content-api.ts$|community/moderated-discussion-api.ts$|community/community-report-history-http.ts$|community/community-report-api.ts$|commerce/license-runtime-http.ts$|commerce/commercial-public-http.ts$|resources/resource-media-upload-http.ts$|resources/resource-media-image-http.ts$|resources/resource-commerce-http.ts$|resources/build-package-report-http.ts$|resources/build-package-files-http.ts$|community/user-platform-client.ts$|community/user-platform-contract.ts$|community/user-platform-copy.ts$|servers/managed-server-copy.ts$|library/user-library.ts$|accounts/security-activity.ts$|accounts/retention-activation-windows.ts$|shell/session-policy.ts$|resources/resource-release-watches-i18n.ts$|resources/public-resource-attribution.ts$|accounts/private-change-history-copy.ts$|accounts/private-change-history-query.ts$|community/community-report-contract.ts$|moderation/community-moderation-contract.ts$|community/publication-feed-contract.ts$|community/content-discussion-contract.ts$|trust/verification-workspace-contract.ts$|trust/public-verification-history-contract.ts$|trust/verification-applications-contract.ts$|trust/public-user-trust-contract.ts$|trust/public-context-trust-contract.ts$|servers/server-observation-browser-contract.ts$|servers/server-statistics-contract.ts$|servers/server-history-window.ts$|servers/server-workspace-contract.ts$|resources/mta-meta-inspector.ts$|resources/build-package-query.ts$|resources/reverse-dependency-summary.ts$|resources/resource-copy-query.ts$|resources/product-dependency-resolution.ts$|organizations/organization-workspace-contract.ts$|organizations/organization-team-contract.ts$|organizations/organization-governance-contract.ts$|organizations/organization-batch-contract.ts$|notifications/notification-inbox-contract.ts$|notifications/notification-copy.ts$|moderation/report-batch-contract.ts$|library/library-release-history-query.ts$|library/library-collections-query.ts$|discovery/discover-query.ts$|discovery/discovery-stream-contract.ts$|community/moderated-discussion-contract.ts$|community/community-report-history-contract.ts$|community/follow-workspace-contract.ts$|community/discussion-workspace-contract.ts$|community/discussion-reports-contract.ts$|community/content-reaction-contract.ts$|community/community-report-groups-contract.ts$|community/author-publication-desk-contract.ts$|commerce/subscriptions-query.ts$|commerce/seller-sales-query.ts$|commerce/plan-reviews-query.ts$|commerce/order-terms-query.ts$|accounts/profile-privacy-contract.ts$|accounts/profile-change-history-contract.ts$|shell/home-personal-changes-types.ts$|moderation/platform-report-i18n.ts$|community/publication-feed-copy.ts$|community/discussion-workspace-copy.ts$|community/content-reaction-copy.ts$|community/community-report-copy.ts$|moderation/admin-action-confirmation.ts$|community/follow-initial-state.ts$|notifications/notification-preferences-confirmation.ts$|servers/server-statistics-export.ts$|servers/server-publication-history-copy.ts$|servers/server-content-copy.ts$|library/resource-release-control-confirmation.ts$|library/resource-release-control-i18n.ts$|resources/resource-release-watch-history-query.ts$|resources/resource-review-i18n.ts$|resources/resource-requirements-query.ts$|resources/resource-requirements-i18n.ts$|trust/verification-workspace-copy.ts$|trust/verification-workspace-api.ts$|trust/public-context-trust-copy.ts$|organizations/organization-workspace-copy.ts$|organizations/organization-publication-history-copy.ts$|organizations/organization-content-copy.ts$|commerce/order-case-i18n.ts$|commerce/license-model-i18n.ts$|commerce/commerce-history-format.ts$|discovery/discovery-copy.ts$|discovery/discovery-stream-copy.ts$||shell/(?:locale|session|auth-return|guest-auth|session-error|modal-dialog|home-personal|pwa-service-worker|confirm-action|action-confirm-checkbox)\\.ts$)|features/support/(?:server/|(?:messages-server|page-server)\\.ts$)|lib/(?!(?:(?:i18n(?:\\.ts$|/))|(?:support-response|http/private-api-request|support-idempotency)\\.ts$)))|site/packages/(?:db|storage|security|config)/)",
      },
    },
    {
      name: "support-client-has-no-node-builtins",
      severity: "error",
      from: {
        path: "^site/src/features/support/(?:(?:center|download-help|thread|support-message-discovery-copy|support-response|support-workspace-copy|support-retry|support-workspace-contract|support-message-discovery-contract)\\.ts$|components/)",
      },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "trust-feature-public-api",
      severity: "error",
      from: { path: "^site/src/(?!features/trust/)" },
      to: {
        path: "^site/src/features/trust/(?!(?:public-user-trust|public-context-trust-page|public-user-trust-copy|public-verification-history-copy|public-context-trust-copy|verification-workspace-copy|public-context-trust-contract|public-user-trust-contract|verification-applications-contract|public-verification-history-contract|verification-workspace-contract|verification-workspace-api)\\.ts$)",
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
        path: "^site/src/features/trust/(?:(?:public-user-trust|public-user-trust-copy|public-verification-history-copy|public-context-trust-copy|verification-workspace-copy|public-context-trust-contract|public-user-trust-contract|verification-applications-contract|public-verification-history-contract|verification-workspace-contract)\\.ts$|components/)",
      },
      to: {
        path: "^(?:site/src/(?:features/trust/(?:server/)|lib/(?!(?:(?:i18n(?:\\.ts$|/))|(?:content-discussion-contract|public-user-trust-contract)\\.ts$)))|site/packages/(?:db|storage|security|config)/)",
      },
    },
    {
      name: "trust-client-has-no-node-builtins",
      severity: "error",
      from: {
        path: "^site/src/features/trust/(?:(?:public-user-trust|public-user-trust-copy|public-verification-history-copy|public-context-trust-copy|verification-workspace-copy|public-context-trust-contract|public-user-trust-contract|verification-applications-contract|public-verification-history-contract|verification-workspace-contract)\\.ts$|components/)",
      },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "moderation-feature-public-api",
      severity: "error",
      from: { path: "^site/src/(?!features/moderation/)" },
      to: {
        path: "^site/src/features/moderation/(?!(?:object-report|report-controls|reports-server|verification-amend|verification-controls|verification-workspace|admin-home|storage-maintenance|admin-status-labels|storage-maintenance-i18n|verification-applications-copy|storage-maintenance-query|admin-action-confirmation|platform-report-i18n|report-batch-contract|community-moderation-contract|verification-moderation|reports-api-copy)\\.ts$)",
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
        path: "^site/src/features/moderation/(?:(?:object-report|report-controls|verification-amend|verification-controls|verification-workspace|storage-maintenance|admin-status-labels|verification-moderation|storage-maintenance-i18n|verification-applications-copy|storage-maintenance-query|admin-action-confirmation|platform-report-i18n|report-batch-contract|community-moderation-contract|reports-api-copy)\\.ts$|components/)",
      },
      to: {
        path: "^(?:site/src/(?:features/(?!moderation/trust/verification-applications-contract\\.ts$|trust/verification-workspace-contract\\.ts$||community/report-evidence-links\\.ts$|resources/download-web-stream\\.ts$|servers/managed-server-view\\.ts$|support/support-idempotency\\.ts$|servers/server-content-api\\.ts$|library/library-view\\.ts$|shell/request-client-ip\\.ts$|accounts/user-platform-api\\.ts$|support/support-http\\.ts$|servers/server-statistics-http\\.ts$|community/community-report-api\\.ts$|commerce/license-runtime-http\\.ts$|community/user-platform-client\\.ts$|community/user-platform-contract\\.ts$|community/user-platform-copy\\.ts$|servers/managed-server-copy\\.ts$|library/user-library\\.ts$|accounts/security-activity\\.ts$|shell/session-policy\\.ts$|accounts/private-change-history-query\\.ts$|support/support-message-discovery-contract\\.ts$|servers/server-history-window\\.ts$|resources/mta-meta-inspector\\.ts$|resources/build-package-query\\.ts$|resources/resource-copy-query\\.ts$|discovery/discover-query\\.ts$|commerce/subscriptions-query\\.ts$|commerce/seller-sales-query\\.ts$|commerce/plan-reviews-query\\.ts$|commerce/order-terms-query\\.ts$|moderation/platform-report-i18n\\.ts$|moderation/admin-action-confirmation\\.ts$|trust/verification-workspace-copy\\.ts$|community/community-report-copy\\.ts$|community/follow-initial-state\\.ts$|support/support-workspace-contract\\.ts$|support/support-retry\\.ts$|servers/server-content-copy\\.ts$|resources/resource-review-i18n\\.ts$|commerce/order-case-i18n\\.ts$|commerce/license-model-i18n\\.ts$|discovery/discovery-copy\\.ts$|resources/(?:qa-report-actions|quarantine-controls)\\.ts$|shell/(?:locale|session|auth-return|guest-auth|session-error|modal-dialog|home-personal|pwa-service-worker|confirm-action|action-confirm-checkbox)\\.ts$)|features/moderation/(?:server/|(?:reports-server)\\.ts$)|lib/(?!(?:(?:i18n(?:\\.ts$|/))|(?:platform-report-i18n|community-report-contract|http/private-api-request|verification-applications-contract|content-discussion-contract|verification-workspace-contract)\\.ts$)))|site/packages/(?:db|storage|security|config)/)",
      },
    },
    {
      name: "moderation-client-has-no-node-builtins",
      severity: "error",
      from: {
        path: "^site/src/features/moderation/(?:(?:object-report|report-controls|verification-amend|verification-controls|verification-workspace|storage-maintenance|admin-status-labels|verification-moderation|storage-maintenance-i18n|verification-applications-copy|storage-maintenance-query|admin-action-confirmation|platform-report-i18n|report-batch-contract|community-moderation-contract|reports-api-copy)\\.ts$|components/)",
      },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "accounts-feature-public-api",
      severity: "error",
      from: { path: "^site/src/(?!features/accounts/)" },
      to: {
        path: "^site/src/features/accounts/(?!(?:auth|controls|settings|context|profile|change-history|profile-change-history|profile-pagination|developer-experience|settings-client-api|feature-flags|profile-privacy-copy|auth-password-api-copy|auth-session-api-copy|auth-sessions-api-copy|auth-login-api-copy|auth-password-reset-api-copy|auth-register-api-copy|auth-context-api-copy|auth-email-verification-api-copy|session-revocation|account-recovery-request-policy|account-recovery-browser|session-cookie|profile-change-history-contract|profile-privacy-contract|private-change-history-query|private-change-history-copy|retention-activation-windows|security-activity|private-change-history-download|user-platform-api|public-profile-activity-server|ad-preference)\\.ts$)",
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
        path: "^site/src/features/accounts/(?:(?:auth|controls|settings|context|profile|change-history|profile-change-history|profile-pagination|developer-experience|ad-preference|settings-client-api|feature-flags|profile-privacy-copy|session-revocation|account-recovery-request-policy|account-recovery-browser|session-cookie|profile-change-history-contract|profile-privacy-contract|private-change-history-query|private-change-history-copy|retention-activation-windows|security-activity)\\.ts$|components/)",
      },
      to: {
        path: "^(?:site/src/(?:features/(?!accounts/support/support-idempotency.ts$|support/support-http.ts$|community/user-platform-client.ts$|community/user-platform-contract.ts$|community/user-platform-copy.ts$|community/publication-feed-copy\\.ts$|notifications/notification-preferences-confirmation\\.ts$|trust/verification-workspace-copy\\.ts$|support/support-retry.ts$||notifications/preferences\\.ts$|shell/(?:locale|session|auth-return|guest-auth|session-error|modal-dialog|home-personal|pwa-service-worker|confirm-action|action-confirm-checkbox)\\.ts$)|features/accounts/(?:server/)|lib/(?!(?:(?:i18n(?:\\.ts$|/))|(?:notification-preferences-confirmation|notification-inbox-copy|http/private-api-request|verification-workspace-contract)\\.ts$)))|site/packages/(?:db|storage|security|config)/)",
      },
    },
    {
      name: "accounts-client-has-no-node-builtins",
      severity: "error",
      from: {
        path: "^site/src/features/accounts/(?:(?:auth|controls|settings|context|profile|change-history|profile-change-history|profile-pagination|developer-experience|ad-preference|settings-client-api|feature-flags|profile-privacy-copy|session-revocation|account-recovery-request-policy|account-recovery-browser|session-cookie|profile-change-history-contract|profile-privacy-contract|private-change-history-query|private-change-history-copy|retention-activation-windows|security-activity)\\.ts$|components/)",
      },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "shell-feature-public-api",
      severity: "error",
      from: { path: "^site/src/(?!features/shell/)" },
      to: {
        path: "^site/src/features/shell/(?!(?:shell|navbar|footer|sidebar|locale|session|auth-session|auth-return|guest-auth|session-error|modal-dialog|home-personal|pwa-service-worker|legal-document|copyable-plain-code-block|confirm-action|action-confirm-checkbox|safe-public-error-reference|home-personal-changes-types|home-personal-changes-server|session-policy|request-client-ip|theme-preference|home-personal-preference|global-error-copy|offline-cache-policy|offline-document-copy|honest-loading)\\.ts$)",
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
        path: "^site/src/features/shell/(?:(?:shell|navbar|footer|sidebar|locale|session|auth-session|auth-return|guest-auth|session-error|modal-dialog|home-personal|pwa-service-worker|legal-document|copyable-plain-code-block|confirm-action|action-confirm-checkbox|theme-preference|home-personal-preference|global-error-copy|offline-cache-policy|honest-loading|safe-public-error-reference|home-personal-changes-types|session-policy)\\.ts$|components/)",
      },
      to: {
        path: "^(?:site/src/(?:features/(?!shell/|accounts/controls\\.ts$|notifications/bell\\.ts$|servers/managed-server-view\\.ts$|servers/managed-server-copy\\.ts$|community/user-platform-copy\\.ts$|organizations/organization-workspace-copy\\.ts$|trust/verification-workspace-copy\\.ts$|moderation/platform-report-i18n\\.ts$|community/publication-feed-copy\\.ts$|community/discussion-workspace-copy\\.ts$|community/content-reaction-copy\\.ts$|community/community-report-copy\\.ts$)|features/shell/(?:server/|home-personal-changes-server\\.ts$)|lib/(?!(?:(?:i18n(?:\\.ts$|/))|(?:managed-server-view|organization-batch-copy|notification-copy|http/private-api-request|resource-release-watches-i18n)\\.ts$)))|site/packages/(?:db|storage|security|config)/)",
      },
    },
    {
      name: "shell-client-has-no-node-builtins",
      severity: "error",
      from: {
        path: "^site/src/features/shell/(?:(?:shell|navbar|footer|sidebar|locale|session|auth-session|auth-return|guest-auth|session-error|modal-dialog|home-personal|pwa-service-worker|legal-document|copyable-plain-code-block|confirm-action|action-confirm-checkbox|theme-preference|home-personal-preference|global-error-copy|offline-cache-policy|honest-loading|safe-public-error-reference|home-personal-changes-types|session-policy)\\.ts$|components/)",
      },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "discovery-feature-public-api",
      severity: "error",
      from: { path: "^site/src/(?!features/discovery/)" },
      to: {
        path: "^site/src/features/discovery/(?!(?:discovery-search-api-copy|discovery-stream-copy|discovery-copy|discovery-stream-contract|discover-query|directory-server)\\.ts$)",
      },
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
        path: "^site/src/features/library/(?!(?:collection-command|collection-batch|collection-item-copy|collection-import|collection-restore|membership-batch|release-follow|release-selection|library-release-request|library-membership-batch-confirmation|library-selection-batches-confirmation|library-membership-batches-i18n|library-selection-batches-i18n|collection-requirements-i18n|library-collection-receipts-i18n|library-collections-confirmation|library-collection-manifests-i18n|library-collection-comparison-query|library-release-history-i18n|collection-releases-query|library-release-comparison-query|library-collection-history-query|collection-releases-i18n|library-collection-comparison-i18n|library-collection-inventory-i18n|library-release-comparison-i18n|library-collection-inventory-query|library-membership-history-query|library-collection-history-i18n|library-membership-history-i18n|library-collections-i18n|resource-release-control-i18n|resource-release-control-confirmation|library-collections-query|library-release-history-query|user-library|library-view|release-comparison-server|release-history-server|collection-releases-server|collection-requirements-server|collections-server|membership-history-server|selection-batch-server|collection-import-page-server|collection-reconcile-page-server|collection-compare-page-server|collection-receipt-page-server|collection-history-page-server|collection-inventory-page-server|resource-collections-page-server)\\.ts$)",
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
        path: "^site/src/features/library/(?:(?:collection-command|collection-batch|collection-item-copy|collection-import|collection-restore|membership-batch|release-follow|release-selection|library-release-request|library-membership-batch-confirmation|library-selection-batches-confirmation|library-membership-batches-i18n|library-selection-batches-i18n|collection-requirements-i18n|library-collection-receipts-i18n|library-collections-confirmation|library-collection-manifests-i18n|library-collection-comparison-query|library-release-history-i18n|collection-releases-query|library-release-comparison-query|library-collection-history-query|collection-releases-i18n|library-collection-comparison-i18n|library-collection-inventory-i18n|library-release-comparison-i18n|library-collection-inventory-query|library-membership-history-query|library-collection-history-i18n|library-membership-history-i18n|library-collections-i18n|resource-release-control-i18n|resource-release-control-confirmation|library-collections-query|library-release-history-query|user-library)\\.ts$|components/)",
      },
      to: {
        path: "^(?:site/src/(?:features/(?!library/resources/resource-release-watches-i18n\\.ts$|resources/resource-requirements-i18n\\.ts$||shell/(?:locale|session|auth-return|guest-auth|session-error|modal-dialog|home-personal|pwa-service-worker|confirm-action|action-confirm-checkbox)\\.ts$)|features/library/(?:server/|(?:collections|membership-history|selection-batch|release-comparison|release-history|collection-releases|collection-requirements|collection-import-page|collection-reconcile-page|collection-compare-page|collection-receipt-page|collection-history-page|collection-inventory-page|resource-collections-page)-server\\.ts$)|lib/(?!(?:(?:i18n(?:\\.ts$|/))|(?:library-collection-receipts-i18n|http/private-api-request)\\.ts$)))|site/packages/(?:db|storage|security|config)/)",
      },
    },
    {
      name: "library-client-has-no-node-builtins",
      severity: "error",
      from: {
        path: "^site/src/features/library/(?:(?:collection-command|collection-batch|collection-item-copy|collection-import|collection-restore|membership-batch|release-follow|release-selection|library-release-request|library-membership-batch-confirmation|library-selection-batches-confirmation|library-membership-batches-i18n|library-selection-batches-i18n|collection-requirements-i18n|library-collection-receipts-i18n|library-collections-confirmation|library-collection-manifests-i18n|library-collection-comparison-query|library-release-history-i18n|collection-releases-query|library-release-comparison-query|library-collection-history-query|collection-releases-i18n|library-collection-comparison-i18n|library-collection-inventory-i18n|library-release-comparison-i18n|library-collection-inventory-query|library-membership-history-query|library-collection-history-i18n|library-membership-history-i18n|library-collections-i18n|resource-release-control-i18n|resource-release-control-confirmation|library-collections-query|library-release-history-query|user-library)\\.ts$|components/)",
      },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "notifications-feature-public-api",
      severity: "error",
      from: { path: "^site/src/(?!features/notifications/)" },
      to: {
        path: "^site/src/features/notifications/(?!(?:bell|preferences|center-server|notification-inbox-events|visible-polling|notification-inbox-copy|notification-read|notification-preferences-confirmation|notification-copy|notification-inbox-contract|web-push-subscription|notification-inbox-export-client)\\.ts$)",
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
        path: "^site/src/features/notifications/(?:(?:bell|preferences|notification-inbox-events|visible-polling|notification-inbox-export-client|notification-inbox-copy|notification-read|notification-preferences-confirmation|notification-copy|notification-inbox-contract)\\.ts$|components/)",
      },
      to: {
        path: "^(?:site/src/(?:features/(?!notifications/resources/resource-release-watches-i18n\\.ts$|servers/server-statistics-export.ts$|resources/resource-activity-csv.ts$|community/publication-feed-view.ts$|trust/verification-workspace-api.ts$|commerce/commercial-public-http.ts$|resources/resource-commerce-http.ts$|trust/public-user-trust-contract.ts$|servers/server-workspace-contract.ts$|moderation/report-batch-contract.ts$|library/library-collections-query.ts$|accounts/profile-privacy-contract.ts$|shell/home-personal-changes-types.ts$|moderation/platform-report-i18n.ts$|community/publication-feed-copy.ts$|community/content-reaction-copy.ts$|community/community-report-copy.ts$|servers/server-statistics-export.ts$|trust/verification-workspace-copy.ts$|trust/verification-workspace-api.ts$|trust/public-context-trust-copy.ts$|commerce/commerce-history-format.ts$|discovery/discovery-stream-copy.ts$||shell/(?:locale|session|auth-return|guest-auth|session-error|modal-dialog|home-personal|pwa-service-worker|confirm-action|action-confirm-checkbox)\\.ts$)|features/notifications/(?:server/|center-server\\.ts$)|lib/(?!(?:(?:i18n(?:\\.ts$|/))|(?:notification-copy|license-maintenance-i18n|http/private-api-request|content-discussion-contract)\\.ts$)))|site/packages/(?:db|storage|security|config)/)",
      },
    },
    {
      name: "notifications-client-has-no-node-builtins",
      severity: "error",
      from: {
        path: "^site/src/features/notifications/(?:(?:bell|preferences|notification-inbox-events|visible-polling|notification-inbox-export-client|notification-inbox-copy|notification-read|notification-preferences-confirmation|notification-copy|notification-inbox-contract)\\.ts$|components/)",
      },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "organizations-feature-public-api",
      severity: "error",
      from: { path: "^site/src/(?!features/organizations/)" },
      to: {
        path: "^site/src/features/organizations/(?!(?:workspace|team|profile|history-view|organization-member-confirmation|organization-workspace-client|organization-team-copy|organization-governance-copy|organization-batch-copy|organization-content-copy|organization-publication-history-copy|organization-workspace-copy|organization-batch-contract|organization-governance-contract|organization-team-contract|organization-workspace-contract|organization-content-api|organization-workspace-api|content-editor-server|publication-history-server|directory-page-server|workspace-page-server|team-page-server|activity-page-server|content-page-server|public-directory-server|public-profile-server|public-activity-server|public-trust-server)\\.ts$)",
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
        path: "^site/src/features/organizations/(?:(?:workspace|team|profile|history-view|organization-member-confirmation|organization-workspace-client|organization-team-copy|organization-governance-copy|organization-batch-copy|organization-content-copy|organization-publication-history-copy|organization-workspace-copy|organization-batch-contract|organization-governance-contract|organization-team-contract|organization-workspace-contract)\\.ts$|components/)",
      },
      to: {
        path: "^(?:site/src/(?:features/(?!organizations/notifications/notification-copy.ts$|community/author-publication-desk-copy\\.ts$||accounts/change-history\\.ts$|shell/(?:locale|session|auth-return|guest-auth|session-error|modal-dialog|home-personal|pwa-service-worker|confirm-action|action-confirm-checkbox)\\.ts$)|features/organizations/(?:server/|(?:content-editor|publication-history|directory-page|workspace-page|team-page|activity-page|content-page|public-directory|public-profile|public-activity|public-trust)-server\\.ts$)|lib/(?!(?:(?:i18n(?:\\.ts$|/))|(?:organization-governance-contract|user-platform-contract|private-change-history-query|user-platform-copy|private-change-history-copy|user-platform-client|http/private-api-request|content-discussion-contract)\\.ts$)))|site/packages/(?:db|storage|security|config)/)",
      },
    },
    {
      name: "organizations-client-has-no-node-builtins",
      severity: "error",
      from: {
        path: "^site/src/features/organizations/(?:(?:workspace|team|profile|history-view|organization-member-confirmation|organization-workspace-client|organization-team-copy|organization-governance-copy|organization-batch-copy|organization-content-copy|organization-publication-history-copy|organization-workspace-copy|organization-batch-contract|organization-governance-contract|organization-team-contract|organization-workspace-contract)\\.ts$|components/)",
      },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "community-feature-public-api",
      severity: "error",
      from: { path: "^site/src/(?!features/community/)" },
      to: {
        path: "^site/src/features/community/(?!(?:discussion|topic-form|report-form|report-evidence-links|own-discussion|article-view|publication-feed|author-content-form|author-publication-restore|catalog-controls|reactions|reaction-removal|content-moderation|object-mute-controls|follow|discussion-mutation-confirmation|follow-confirmation|server-publication-history-contract|discussion-compose-draft|community-topic-intent|discussion-reports-copy|community-topic-submission|organization-publication-history-contract|content-comment-client|community-report-groups-copy|content-comment-confirmation|report-batch-copy|follow-workspace-copy|community-moderation-copy|moderated-discussion-copy|community-report-history-copy|author-publication-desk-copy|content-discussion-copy|follow-initial-state|community-report-copy|content-reaction-copy|discussion-workspace-copy|publication-feed-copy|author-publication-desk-contract|community-report-groups-contract|content-reaction-contract|discussion-reports-contract|discussion-workspace-contract|follow-workspace-contract|community-report-history-contract|moderated-discussion-contract|content-discussion-contract|publication-feed-contract|community-report-contract|user-platform-copy|user-platform-contract|user-platform-client|community-report-api|community-report-history-http|moderated-discussion-api|publication-feed-view|reports-server|report-history-server|report-groups-server|moderation-server|moderated-discussion-server|discussion-reports-server|publication-reports-server|publication-feed-loading-server|context-history-server|community-page-server|new-topic-page-server|articles-page-server|article-page-server|own-discussions-page-server|own-discussion-page-server|author-desk-page-server|author-create-page-server|author-edit-page-server|author-history-page-server|following-feed-page-server)\\.ts$)",
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
        path: "^site/src/features/community/(?:(?:discussion|topic-form|report-form|report-evidence-links|own-discussion|article-view|publication-feed|author-content-form|author-publication-restore|catalog-controls|reactions|reaction-removal|content-moderation|object-mute-controls|follow|discussion-mutation-confirmation|follow-confirmation|server-publication-history-contract|discussion-compose-draft|community-topic-intent|discussion-reports-copy|community-topic-submission|organization-publication-history-contract|content-comment-client|community-report-groups-copy|content-comment-confirmation|report-batch-copy|follow-workspace-copy|community-moderation-copy|moderated-discussion-copy|community-report-history-copy|author-publication-desk-copy|content-discussion-copy|follow-initial-state|community-report-copy|content-reaction-copy|discussion-workspace-copy|publication-feed-copy|author-publication-desk-contract|community-report-groups-contract|content-reaction-contract|discussion-reports-contract|discussion-workspace-contract|follow-workspace-contract|community-report-history-contract|moderated-discussion-contract|content-discussion-contract|publication-feed-contract|community-report-contract|user-platform-copy|user-platform-contract|user-platform-client)\\.ts$|components/)",
      },
      to: {
        path: "^(?:site/src/(?:features/community/(?:server(?:\\.ts$|/)|(?:reports|report-history|report-groups|moderation|moderated-discussion|discussion-reports|publication-reports|publication-feed-loading|context-history|community-page|new-topic-page|articles-page|article-page|own-discussions-page|own-discussion-page|author-desk-page|author-create-page|author-edit-page|author-history-page|following-feed-page)-server\\.ts$)|lib/(?!(?:(?:i18n(?:\\.ts$|/))|(?:community-report-contract|http/private-api-request|private-change-history-query|private-change-history-copy|community-moderation-contract|report-batch-contract)\\.ts$)))|site/packages/(?:db|storage|security|config)/)",
      },
    },
    {
      name: "community-client-has-no-node-builtins",
      severity: "error",
      from: {
        path: "^site/src/features/community/(?:(?:discussion|topic-form|report-form|report-evidence-links|own-discussion|article-view|publication-feed|author-content-form|author-publication-restore|catalog-controls|reactions|reaction-removal|content-moderation|object-mute-controls|follow|discussion-mutation-confirmation|follow-confirmation|server-publication-history-contract|discussion-compose-draft|community-topic-intent|discussion-reports-copy|community-topic-submission|organization-publication-history-contract|content-comment-client|community-report-groups-copy|content-comment-confirmation|report-batch-copy|follow-workspace-copy|community-moderation-copy|moderated-discussion-copy|community-report-history-copy|author-publication-desk-copy|content-discussion-copy|follow-initial-state|community-report-copy|content-reaction-copy|discussion-workspace-copy|publication-feed-copy|author-publication-desk-contract|community-report-groups-contract|content-reaction-contract|discussion-reports-contract|discussion-workspace-contract|follow-workspace-contract|community-report-history-contract|moderated-discussion-contract|content-discussion-contract|publication-feed-contract|community-report-contract|user-platform-copy|user-platform-contract|user-platform-client)\\.ts$|components/)",
      },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "commerce-feature-public-api",
      severity: "error",
      from: { path: "^site/src/(?!features/commerce/)" },
      to: {
        path: "^site/src/features/commerce/(?!(?:workspace-history|license-controls|license-archive|license-detail|license-runtime-response|order-case-response|plan-review-confirmation|license-control-confirmation|subscription-confirmation|license-archive-query|order-case-query|license-runtime-query|commercial-confirmation|order-terms-i18n|seller-sales-i18n|plan-reviews-i18n|subscriptions-i18n|license-control-i18n|financial-i18n|license-archive-csv|subscription-time|seller-sales-csv|commercial-plan-query|financial-query|commercial-i18n|commerce-history-i18n|license-maintenance-i18n|commerce-history-format|license-model-i18n|order-case-i18n|order-terms-query|plan-reviews-query|seller-sales-query|subscriptions-query|commercial-public-http|license-runtime-http|license-history-server|subscription-controls|subscription-workspace|order-cancellation|order-case-forms|order-terms|order-case-server|commercial-plans|plan-reviews|plan-reviews-workspace|plan-review-detail|seller-sales)\\.ts$)",
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
        path: "^site/src/features/commerce/(?:(?:workspace-history|license-controls|subscription-controls|order-cancellation|order-case-forms|commercial-plans|plan-reviews|license-runtime-response|order-case-response|plan-review-confirmation|license-control-confirmation|subscription-confirmation|license-archive-query|order-case-query|license-runtime-query|commercial-confirmation|order-terms-i18n|seller-sales-i18n|plan-reviews-i18n|subscriptions-i18n|license-control-i18n|financial-i18n|license-archive-csv|subscription-time|seller-sales-csv|commercial-plan-query|financial-query|commercial-i18n|commerce-history-i18n|license-maintenance-i18n|commerce-history-format|license-model-i18n|order-case-i18n|order-terms-query|plan-reviews-query|seller-sales-query|subscriptions-query)\\.ts$|components/)",
      },
      to: {
        path: "^(?:site/src/(?:features/(?!commerce/|support/support-retry\\.ts$||shell/(?:locale|confirm-action|action-confirm-checkbox)\\.ts$)|lib/(?!(?:(?:i18n(?:\\.ts$|/))|(?:commerce-history-format|http/private-api-request)\\.ts$)))|site/packages/(?:db|storage|security|config)/)",
      },
    },
    {
      name: "commerce-client-has-no-node-builtins",
      severity: "error",
      from: {
        path: "^site/src/features/commerce/(?:(?:workspace-history|license-controls|subscription-controls|order-cancellation|order-case-forms|commercial-plans|plan-reviews|license-runtime-response|order-case-response|plan-review-confirmation|license-control-confirmation|subscription-confirmation|license-archive-query|order-case-query|license-runtime-query|commercial-confirmation|order-terms-i18n|seller-sales-i18n|plan-reviews-i18n|subscriptions-i18n|license-control-i18n|financial-i18n|license-archive-csv|subscription-time|seller-sales-csv|commercial-plan-query|financial-query|commercial-i18n|commerce-history-i18n|license-maintenance-i18n|commerce-history-format|license-model-i18n|order-case-i18n|order-terms-query|plan-reviews-query|seller-sales-query|subscriptions-query)\\.ts$|components/)",
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
        path: "^site/src/features/servers/(?!(?:client|server|model|connect|statistics-export|statistics-view|registration|claim-controls|details-controls|review-controls|follow|visibility-batch|workspace-navigation|server-organization-options|server-claim-confirmation|server-history-presentation|server-mutation-confirmation|server-review-confirmation|server-statistics-download|server-workspace-nav-i18n|server-claim-status-view|server-activity-view|server-review-i18n|server-mutation-errors|server-workspace-copy|server-review-query|server-follow-notifications|server-statistics-copy|server-observation-browser-copy|server-content-copy|server-publication-history-copy|server-workspace-contract|server-history-window|server-statistics-contract|server-observation-browser-contract|managed-server-copy|servers-directory-api-copy|server-observation-browser-http|server-statistics-http|server-statistics-export|server-content-api|managed-server-view|statistics-server|observations-server|history-server|claim-status-server|managed-card-server|content-editor-server|activity-server|publication-history-server|updates-server)\\.ts$)",
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
        path: "^site/src/features/servers/(?:(?:client|connect|statistics-export|statistics-view|registration|claim-controls|details-controls|review-controls|follow|visibility-batch|workspace-navigation|server-organization-options|server-claim-confirmation|server-history-presentation|server-mutation-confirmation|server-review-confirmation|server-statistics-download|server-workspace-nav-i18n|server-claim-status-view|server-activity-view|server-review-i18n|server-mutation-errors|server-workspace-copy|server-review-query|server-follow-notifications|server-statistics-copy|server-observation-browser-copy|server-content-copy|server-publication-history-copy|server-workspace-contract|server-history-window|server-statistics-contract|server-observation-browser-contract|managed-server-copy|servers-directory-api-copy)\\.ts$|components/|model(?:\\.ts$|/))",
      },
      to: {
        path: "^(?:site/src/(?:features/servers/(?:server(?:\\.ts$|/)|(?:statistics|observations|history|claim-status|managed-card|content-editor|activity|publication-history|updates)-server\\.ts$)|lib/(?!(?:(?:i18n(?:\\.ts$|/))|(?:http/private-api-request|user-platform-client|user-platform-copy|user-platform-contract|follow-initial-state|follow-confirmation|follow-workspace-contract|follow-workspace-copy|content-discussion-contract)\\.ts$)))|site/packages/(?:db|storage|security|config)/)",
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
        path: "^site/src/features/servers/(?:(?:client|connect|statistics-export|statistics-view|registration|claim-controls|details-controls|review-controls|follow|visibility-batch|workspace-navigation|server-organization-options|server-claim-confirmation|server-history-presentation|server-mutation-confirmation|server-review-confirmation|server-statistics-download|server-workspace-nav-i18n|server-claim-status-view|server-activity-view|server-review-i18n|server-mutation-errors|server-workspace-copy|server-review-query|server-follow-notifications|server-statistics-copy|server-observation-browser-copy|server-content-copy|server-publication-history-copy|server-workspace-contract|server-history-window|server-statistics-contract|server-observation-browser-contract|managed-server-copy|servers-directory-api-copy)\\.ts$|components/|model(?:\\.ts$|/))",
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
        path: "^site/src/features/resources/(?!(?:view|detail-view|reviews-view|review-controls|compatibility-controls|variant-controls|publisher-view|publisher-navigation|create-controls|copy-controls|copy-view|author-controls|lifecycle-controls|moderation-controls|requirements-view|quarantine-controls|qa-report-actions|release-watch-batch|cart-controls|cart-view|download|release-watch|client|evidence|resource-submission-intent|mta-version-target|build-moderation-ui|new-resource-response|pending-resource-draft|resource-build-workspace-response|resource-copy-confirmation|resource-review-confirmation|author-resource-response|resource-management-confirmation|resource-publication-readiness-i18n|resource-release-watch-batch-confirmation|publishing-error-message|resource-publisher-nav-i18n|author-resource-requests|resource-cart-review-confirmation|mta-meta-inspector-messages|resource-image-url|private-request|author-resource-draft|build-file-validation|resource-commerce-confirmation|public-release-history|resource-cart-receipts-query|resource-publisher-query|resource-review-query|product-type-labels|resource-deliveries-i18n|resource-qa-i18n|resource-cart-receipts-i18n|build-package-i18n|resource-copy-i18n|resource-publisher-i18n|resource-build-workspace-i18n|resource-qa-query|resource-cart-receipts-csv|build-download-metadata|resource-deliveries-csv|resource-download-policy|resource-activity-view|resource-activity-query|resource-release-watch-history-i18n|resource-activity-i18n|resource-release-watches-query|resource-deliveries-query|resource-media-i18n|resource-management-i18n|resource-download-sha256|build-download-selection|resource-release-control-query|resource-commerce-i18n|resource-claim-api-copy|resource-requirements-i18n|resource-requirements-query|resource-review-i18n|resource-release-watch-history-query|product-dependency-resolution|resource-copy-query|reverse-dependency-summary|build-package-query|mta-meta-inspector|public-resource-attribution|resource-release-watches-i18n|build-package-files-http|build-package-report-http|resource-commerce-http|resource-media-image-http|resource-media-upload-http|resource-activity-csv|resource-delivery-stream|download-web-stream|resource-download-client|resource-attachment-filename|server|(?:detail|versions|reviews|media|build|package|requirements|review-report|delivery)-server|model)\\.ts$)",
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
        path: "^site/src/features/resources/(?:(?:view|detail-view|reviews-view|review-controls|compatibility-controls|variant-controls|publisher-view|publisher-navigation|create-controls|copy-controls|copy-view|author-controls|lifecycle-controls|moderation-controls|requirements-view|quarantine-controls|qa-report-actions|release-watch-batch|cart-controls|cart-view|download|release-watch|client|evidence|resource-submission-intent|mta-version-target|build-moderation-ui|new-resource-response|pending-resource-draft|resource-build-workspace-response|resource-copy-confirmation|resource-review-confirmation|author-resource-response|resource-management-confirmation|resource-publication-readiness-i18n|resource-release-watch-batch-confirmation|publishing-error-message|resource-publisher-nav-i18n|author-resource-requests|resource-cart-review-confirmation|mta-meta-inspector-messages|resource-image-url|private-request|author-resource-draft|build-file-validation|resource-commerce-confirmation|public-release-history|resource-cart-receipts-query|resource-publisher-query|resource-review-query|product-type-labels|resource-deliveries-i18n|resource-qa-i18n|resource-cart-receipts-i18n|build-package-i18n|resource-copy-i18n|resource-publisher-i18n|resource-build-workspace-i18n|resource-qa-query|resource-cart-receipts-csv|build-download-metadata|resource-deliveries-csv|resource-download-policy|resource-activity-view|resource-activity-query|resource-release-watch-history-i18n|resource-activity-i18n|resource-release-watches-query|resource-deliveries-query|resource-media-i18n|resource-management-i18n|resource-download-sha256|build-download-selection|resource-release-control-query|resource-commerce-i18n|resource-claim-api-copy|resource-requirements-i18n|resource-requirements-query|resource-review-i18n|resource-release-watch-history-query|product-dependency-resolution|resource-copy-query|reverse-dependency-summary|build-package-query|mta-meta-inspector|public-resource-attribution|resource-release-watches-i18n)\\.ts$|components/|model(?:\\.ts$|/))",
      },
      to: {
        path: "^(?:site/src/(?:features/resources/(?:server|(?:detail|versions|reviews|media|build|package|requirements|review-report|delivery)-server)(?:\\.ts$|/)|lib/(?!(?:(?:i18n(?:\\.ts$|/))|(?:user-platform-client|library-release-history-query|http/private-api-request|resource-download-client|resource-attachment-filename)\\.ts$)))|site/packages/(?:db|storage|security|config)/)",
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
        path: "^site/src/features/resources/(?:(?:view|detail-view|reviews-view|review-controls|compatibility-controls|variant-controls|publisher-view|publisher-navigation|create-controls|copy-controls|copy-view|author-controls|lifecycle-controls|moderation-controls|requirements-view|quarantine-controls|qa-report-actions|release-watch-batch|cart-controls|cart-view|download|release-watch|client|evidence|resource-submission-intent|mta-version-target|build-moderation-ui|new-resource-response|pending-resource-draft|resource-build-workspace-response|resource-copy-confirmation|resource-review-confirmation|author-resource-response|resource-management-confirmation|resource-publication-readiness-i18n|resource-release-watch-batch-confirmation|publishing-error-message|resource-publisher-nav-i18n|author-resource-requests|resource-cart-review-confirmation|mta-meta-inspector-messages|resource-image-url|private-request|author-resource-draft|build-file-validation|resource-commerce-confirmation|public-release-history|resource-cart-receipts-query|resource-publisher-query|resource-review-query|product-type-labels|resource-deliveries-i18n|resource-qa-i18n|resource-cart-receipts-i18n|build-package-i18n|resource-copy-i18n|resource-publisher-i18n|resource-build-workspace-i18n|resource-qa-query|resource-cart-receipts-csv|build-download-metadata|resource-deliveries-csv|resource-download-policy|resource-activity-view|resource-activity-query|resource-release-watch-history-i18n|resource-activity-i18n|resource-release-watches-query|resource-deliveries-query|resource-media-i18n|resource-management-i18n|resource-download-sha256|build-download-selection|resource-release-control-query|resource-commerce-i18n|resource-claim-api-copy|resource-requirements-i18n|resource-requirements-query|resource-review-i18n|resource-release-watch-history-query|product-dependency-resolution|resource-copy-query|reverse-dependency-summary|build-package-query|mta-meta-inspector|public-resource-attribution|resource-release-watches-i18n)\\.ts$|components/|model(?:\\.ts$|/))",
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
