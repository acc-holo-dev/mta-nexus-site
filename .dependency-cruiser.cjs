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
      name: "servers-feature-public-api",
      severity: "error",
      comment:
        "Other application modules consume the Servers pilot through client, server or model entrypoints.",
      from: { path: "^site/src/(?!features/servers/)" },
      to: { path: "^site/src/features/servers/(?!(?:client|server|model)\\.ts$)" },
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
      from: { path: "^site/src/features/servers/(?:client\\.ts$|components/|model(?:\\.ts$|/))" },
      to: {
        path: "^(?:site/src/(?:features/servers/server(?:\\.ts$|/)|lib/(?!i18n(?:\\.ts$|/)))|site/packages/(?:db|storage|security|config)/)",
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
      from: { path: "^site/src/features/servers/(?:client\\.ts$|components/|model(?:\\.ts$|/))" },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "resources-feature-public-api",
      severity: "error",
      comment:
        "Other application modules consume the Resources feature through view, server or model entrypoints.",
      from: { path: "^site/src/(?!features/resources/)" },
      to: {
        path: "^site/src/features/resources/(?!(?:view|client|evidence|server|(?:detail|versions|reviews)-server|model)\\.ts$)",
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
        path: "^site/src/features/resources/(?:(?:view|client|evidence)\\.ts$|components/|model(?:\\.ts$|/))",
      },
      to: {
        path: "^(?:site/src/(?:features/resources/(?:server|(?:detail|versions|reviews)-server)(?:\\.ts$|/)|lib/(?!(?:i18n|public-resource-attribution|product-type-labels|resource-image-url|resource-media-i18n|build-package-i18n|mta-meta-inspector-messages)\\.ts$))|site/packages/(?:db|storage|security|config)/)",
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
        path: "^site/src/features/resources/(?:(?:view|client|evidence)\\.ts$|components/|model(?:\\.ts$|/))",
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
