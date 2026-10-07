import vm from "node:vm";

type ServiceWorkerListener = (event: unknown) => void;

export type ServiceWorkerRequest = {
  method: string;
  url: string;
  mode: string;
  headers: {
    get(name: string): string | null;
  };
};

type HarnessOptions = {
  cachedResponse?: unknown;
  cacheKeys?: unknown[];
  fetch?: (request: unknown) => Promise<unknown>;
};

export function makeServiceWorkerRequest(
  url: string,
  options: {
    method?: string;
    mode?: string;
    language?: string;
  } = {},
): ServiceWorkerRequest {
  const language = options.language ?? "en";

  return {
    method: options.method ?? "GET",
    url,
    mode: options.mode ?? "cors",
    headers: {
      get(name) {
        return name.toLowerCase() === "accept-language" ? language : null;
      },
    },
  };
}

export function createServiceWorkerHarness(
  source: string,
  options: HarnessOptions = {},
) {
  const listeners = new Map<string, ServiceWorkerListener>();
  const fetchCalls: unknown[] = [];
  const cachePuts: Array<{ request: unknown; response: unknown }> = [];
  const cacheDeletes: unknown[] = [];
  const cacheEntries = new Map<unknown, unknown>();
  for (const key of options.cacheKeys ?? []) cacheEntries.set(key, { cached: true });
  const notifications: Array<{
    title: string;
    options: Record<string, unknown>;
  }> = [];
  const openedWindows: string[] = [];
  const deletedCaches: string[] = [];

  const fetchImpl = async (request: unknown) => {
    fetchCalls.push(request);
    if (!options.fetch) {
      throw new Error("Unexpected service-worker fetch");
    }
    return options.fetch(request);
  };

  const caches = {
    async match() {
      return options.cachedResponse ?? null;
    },
    async open() {
      return {
        async addAll() {
          return undefined;
        },
        async match(request: unknown) {
          return options.cachedResponse ?? cacheEntries.get(request) ?? null;
        },
        async put(request: unknown, response: unknown) {
          cachePuts.push({ request, response });
          cacheEntries.set(request, response);
        },
        async keys() {
          return [...cacheEntries.keys()];
        },
        async delete(request: unknown) {
          cacheDeletes.push(request);
          return cacheEntries.delete(request);
        },
      };
    },
    async keys() {
      return [];
    },
    async delete(key: string) {
      deletedCaches.push(key);
      return true;
    },
  };

  const self = {
    location: { origin: "https://nexus.test" },
    addEventListener(type: string, listener: ServiceWorkerListener) {
      listeners.set(type, listener);
    },
    async skipWaiting() {
      return undefined;
    },
    clients: {
      async claim() {
        return undefined;
      },
      async matchAll() {
        return [];
      },
      async openWindow(url: string) {
        openedWindows.push(url);
        return { url };
      },
    },
    registration: {
      async showNotification(
        title: string,
        notificationOptions: Record<string, unknown>,
      ) {
        notifications.push({
          title,
          options: notificationOptions,
        });
      },
    },
  };

  vm.runInNewContext(source, {
    self,
    caches,
    fetch: fetchImpl,
    Response,
    URL,
    Promise,
    setTimeout,
    clearTimeout,
  });

  async function dispatchFetch(request: ServiceWorkerRequest) {
    const listener = listeners.get("fetch");
    if (!listener) throw new Error("Service worker did not register fetch");

    let responsePromise: Promise<unknown> | null = null;
    listener({
      request,
      respondWith(value: unknown) {
        responsePromise = Promise.resolve(value);
      },
    });

    return {
      intercepted: responsePromise !== null,
      response: responsePromise ? await responsePromise : null,
    };
  }

  async function dispatchPush(payload: unknown) {
    const listener = listeners.get("push");
    if (!listener) throw new Error("Service worker did not register push");

    let pending: Promise<unknown> | null = null;
    listener({
      data: {
        json() {
          return payload;
        },
      },
      waitUntil(value: unknown) {
        pending = Promise.resolve(value);
      },
    });
    if (pending) await pending;
  }

  async function dispatchNotificationClick(url: string) {
    const listener = listeners.get("notificationclick");
    if (!listener) {
      throw new Error("Service worker did not register notificationclick");
    }

    let pending: Promise<unknown> | null = null;
    listener({
      notification: {
        data: { url },
        close() {
          return undefined;
        },
      },
      waitUntil(value: unknown) {
        pending = Promise.resolve(value);
      },
    });
    if (pending) await pending;
  }

  return {
    cacheDeletes,
    cachePuts,
    deletedCaches,
    dispatchFetch,
    dispatchNotificationClick,
    dispatchPush,
    fetchCalls,
    notifications,
    openedWindows,
  };
}
