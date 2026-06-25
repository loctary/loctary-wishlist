import type { AuthPageMountFn } from "./authTypes";

/**
 * Loads loctary-auth's federated `./mount` entry — client-only.
 *
 * loctary-auth's `remoteEntry.js` is built by `@module-federation/vite` as a
 * real **ES module** (`export { get, init }`). `@module-federation/runtime`'s
 * default loader injects it as a classic `<script>`, which can't read an ESM
 * module's exports (→ "Failed to get remoteEntry exports", RUNTIME-001). Since
 * the remote **shares nothing**, there is no shared-scope negotiation to do, so
 * we skip that loader and pull the container in with a native dynamic `import()`
 * (which parses ESM correctly), then drive the standard MF container contract
 * (`init` → `get`) ourselves.
 *
 * Cross-origin note: native module import is CORS-gated. The auth dev server
 * sets `cors: true`; in production auth's static assets (remoteEntry.js +
 * /assets/*) must send `Access-Control-Allow-Origin` for `wishlist.loctary.com`.
 */
const REMOTE_ENTRY =
  import.meta.env.VITE_AUTH_REMOTE_ENTRY ?? "http://localhost:3001/remoteEntry.js";

interface MfContainer {
  init: (shareScope?: Record<string, unknown>, initScope?: unknown[]) => unknown;
  get: (module: string) => Promise<unknown>;
}

let containerPromise: Promise<MfContainer> | null = null;

async function getContainer(): Promise<MfContainer> {
  if (!containerPromise) {
    containerPromise = (async () => {
      const container = (await import(/* @vite-ignore */ REMOTE_ENTRY)) as MfContainer;
      // Initialise with an empty share scope — the remote shares nothing.
      try {
        await container.init({});
      } catch {
        /* already initialised / nothing to share — safe to continue */
      }
      return container;
    })();
  }
  return containerPromise;
}

/** Resolve a federated module's default export (handles factory vs. value). */
async function loadDefault<T>(name: string): Promise<T> {
  if (typeof window === "undefined") {
    throw new Error("auth remote modules can only load in the browser");
  }
  const container = await getContainer();
  const factory = await container.get(name);
  const mod = (typeof factory === "function" ? await (factory as () => unknown)() : factory) as
    | { default?: T }
    | T;
  const value = (typeof mod === "function" ? mod : (mod as { default?: T })?.default) as T | undefined;
  if (!value) throw new Error(`Could not load auth remote module "${name}"`);
  return value;
}

/**
 * Load the auth remote's single-page mount (`./mountPage`) — client-only. Each
 * host auth route mounts just its own page with this; inter-page links are wired
 * to the host router so the URL reflects the current screen.
 */
export function loadAuthPageMount(): Promise<AuthPageMountFn> {
  return loadDefault<AuthPageMountFn>("./mountPage");
}
