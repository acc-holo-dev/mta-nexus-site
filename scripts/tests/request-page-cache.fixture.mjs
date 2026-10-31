// Isolated RSC process: actual page/locale source, synthetic repositories and UI.
import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { readdirSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseSync, transformSync } from "@swc/core";
import React from "react";
import renderer from "next/dist/compiled/react-server-dom-webpack/server.node.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sourceRoot = resolve(root, "apps/web/src");
const requests = new AsyncLocalStorage();
const routes = [
  ["developers/[username]", "username", "user"],
  ["users/[username]", "username", "user"],
  ["organizations/[slug]", "slug", "organization"],
  ["servers/[slug]", "slug", "server"],
];
function collectTsFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectTsFiles(absolute));
    else if (entry.isFile() && absolute.endsWith(".ts")) files.push(absolute);
  }
  return files;
}
const sourceFiles = new Set([
  ...routes.map(([route]) => resolve(sourceRoot, "app", route, "page.tsx")),
  ...[
    "i18n.ts",
    "i18n-server.ts",
    "profile-pagination.ts",
    "public-user-trust-copy.ts",
    "public-context-trust-copy.ts",
    "publication-feed-copy.ts",
    "verification-workspace-copy.ts",
    "server-statistics-copy.ts",
  ].map((file) => resolve(sourceRoot, "lib", file)),
  ...collectTsFiles(resolve(sourceRoot, "lib/i18n")),
]);
const emptyPage = async () => ({
  products: [],
  servers: [],
  items: [],
  total: 0,
  page: 1,
  totalPages: 1,
});
const read = async (kind, key) => {
  const request = requests.getStore();
  const counter = `${kind}:${key}`;
  request.reads.set(counter, (request.reads.get(counter) ?? 0) + 1);
  // Yield so metadata and page can share an in-flight read.
  await Promise.resolve();
  return request.missing
    ? null
    : {
        id: key,
        username: key,
        slug: key,
        name: request.name,
        displayName: request.name,
        role: "developer",
        visibility: "public",
        status: "active",
        bio: "Synthetic profile",
        description: "Synthetic description",
        createdAt: new Date("2026-10-01"),
        gameplayTags: [],
        mediaUrls: [],
        ipAddress: "203.0.113.50",
        port: 22003,
        maxPlayers: 64,
      };
};
const nothing = () => null;
const mocks = {
  "@nexus/db": {
    userRepository: { findByUsername: (key) => read("user", key) },
    organizationRepository: { findBySlug: (key) => read("organization", key) },
    productRepository: {
      pagePublishedFreeByAuthor: emptyPage,
      pagePublishedFreeByOrganization: emptyPage,
    },
    serverRepository: { pageActivePublicByOwner: emptyPage },
    contentRepository: { pagePublishedEditorialByOrganization: emptyPage },
  },
  "auth-service": { authService: { getUserByUsername: (key) => read("user", key) } },
  "verification-workspace-service": {
    verificationWorkspaceService: {
      publicProfile: async () => ({
        specialties: ["scripting"],
        githubUrl: null,
        discordTag: null,
        verifiedDeveloper: false,
      }),
    },
  },
  "profile-privacy-service": {
    profilePrivacyService: {
      visibility: async () => ({
        showActivity: true,
        showProfessionalContacts: true,
      }),
    },
  },
  "server-service": { serverService: { getServerBySlug: (key) => read("server", key) } },
  "server-review-service": {
    serverReviewService: {
      publicPage: async () => ({
        reviews: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      }),
    },
  },
  "mta-master-directory-service": {
    mtaMasterDirectoryService: { getDirectory: async () => null },
    indexMtaObservations: () => nothing,
    matchesMtaEndpoint: () => false,
    mtaLiveStatus: () => "unknown",
  },
  "server-history-service": { serverHistoryService: { getHistoryForServer: async () => null } },
  "content-service": { contentService: { listServerUpdates: async () => [] } },
  "@nexus/validation": { safeExternalWebUrl: (value) => value || undefined },
  "next/navigation": {
    notFound: () => {
      throw new Error("NOT_FOUND");
    },
  },
  "next/headers": {
    cookies: async () => {
      const request = requests.getStore();
      request.cookieReads++;
      return { get: () => ({ value: request.locale }) };
    },
  },
};
globalThis.__nexusRscMocks = mocks;
const virtualSources = new Map();
function mockModule(specifier, names) {
  const id = specifier.split("/").at(-1);
  const key = mocks[specifier] ? specifier : mocks[id] ? id : null;
  const url = `nexus-rsc-fixture:${encodeURIComponent(specifier + JSON.stringify(names))}`;
  if (!virtualSources.has(url)) {
    const exports = names
      .map(([local, exported]) => {
        const value = key
          ? `globalThis.__nexusRscMocks[${JSON.stringify(key)}][${JSON.stringify(exported)}]`
          : "() => null";
        return exported === "default"
          ? `export default ${value};`
          : `export const ${local} = ${value};`;
      })
      .join("\n");
    virtualSources.set(url, exports);
  }
  return url;
}
const importsByFile = new Map(
  [...sourceFiles].map((file) => {
    const ast = parseSync(readFileSync(file, "utf8"), {
      syntax: "typescript",
      tsx: file.endsWith(".tsx"),
    });
    return [
      file,
      new Map(
        ast.body
          .filter((node) => node.type === "ImportDeclaration" && !node.typeOnly)
          .map((node) => [
            node.source.value,
            node.specifiers
              .filter((specifier) => !specifier.isTypeOnly)
              .map((specifier) => [
                specifier.local.value,
                specifier.type === "ImportDefaultSpecifier"
                  ? "default"
                  : (specifier.imported?.value ?? specifier.local.value),
              ]),
          ]),
      ),
    ];
  }),
);
registerHooks({
  resolve(specifier, context, nextResolve) {
    const parent = context.parentURL?.startsWith("file:") ? fileURLToPath(context.parentURL) : null;
    if (sourceFiles.has(parent) && !specifier.startsWith("react")) {
      const target = specifier.startsWith(".") ? resolve(dirname(parent), specifier) : null;
      const source =
        target &&
        [
          target,
          `${target}.ts`,
          `${target}.tsx`,
          join(target, "index.ts"),
          join(target, "index.tsx"),
        ].find((file) => sourceFiles.has(file));
      if (source) return { url: pathToFileURL(source).href, shortCircuit: true };
      return {
        url: mockModule(specifier, importsByFile.get(parent).get(specifier) ?? []),
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (virtualSources.has(url))
      return { format: "module", source: virtualSources.get(url), shortCircuit: true };
    if (url.startsWith("file:") && sourceFiles.has(fileURLToPath(url))) {
      const file = fileURLToPath(url);
      const { code } = transformSync(readFileSync(file, "utf8"), {
        filename: file,
        jsc: {
          parser: { syntax: "typescript", tsx: file.endsWith(".tsx") },
          target: "es2022",
          transform: { react: { runtime: "automatic" } },
        },
        module: { type: "es6" },
      });
      return { format: "module", source: code, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

const { getRequestLocale } = await import(pathToFileURL(resolve(sourceRoot, "lib/i18n-server.ts")));
async function render(route, key, request) {
  const [name, parameter, kind] = route;
  const { default: Page, generateMetadata } = await import(
    pathToFileURL(resolve(sourceRoot, "app", name, "page.tsx"))
  );
  // Fixture closes over ALS request context; not a production component factory.
  // biome-ignore lint/correctness/noComponentHookFactories: request-scoped RSC fixture
  async function Tree() {
    // Root metadata/layout also consume the locale in a normal app render.
    const input = { params: Promise.resolve({ [parameter]: key }) };
    const [locale, metadata, page] = await Promise.all([
      getRequestLocale(),
      generateMetadata(input),
      Page(input).catch((error) => {
        if (request.missing && error.message === "NOT_FOUND") return null;
        throw error;
      }),
    ]);
    assert.equal(locale, request.locale);
    if (!request.missing) assert.ok(String(metadata.title).includes(request.name));
    return React.createElement(React.Fragment, null, page);
  }
  return requests.run(request, async () => {
    const errors = [];
    const stream = await renderer.renderToReadableStream(
      React.createElement(Tree),
      {},
      {
        onError: (error) => {
          errors.push(error);
        },
      },
    );
    const flight = await new Response(stream).text();
    assert.deepEqual(errors, []);
    if (!request.missing)
      assert.ok(flight.includes(request.name), `${name}: page should show its own request data`);
    assert.equal(
      request.reads.get(`${kind}:${key}`),
      1,
      `${name}: metadata/page should share one read`,
    );
    assert.equal(request.cookieReads, 1, `${name}: locale should share one cookie read`);
  });
}
const context = (locale, name, missing = false) => ({
  locale,
  name,
  missing,
  reads: new Map(),
  cookieReads: 0,
});
for (const route of routes) {
  await Promise.all([
    render(route, "same-key", context("ru", "First request")),
    render(route, "same-key", context("en", "Second request")),
  ]);
  await render(route, "same-key", context("en", "Fresh request"));
  await render(route, "missing-key", context("ru", "Missing", true));
  await render(route, "missing-key", context("en", "Created after missing"));
}
console.log(
  JSON.stringify({
    routes: routes.length,
    renders: routes.length * 5,
    singleReadPerRender: true,
    requestIsolation: true,
  }),
);
