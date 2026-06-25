import type { AuthMountFn } from "./authTypes";

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

/** Load the auth widget's imperative mount function (client-only). */
export async function loadAuthMount(): Promise<AuthMountFn> {
  if (typeof window === "undefined") {
    throw new Error("loadAuthMount must run in the browser");
  }
  const container = await getContainer();
  const factory = await container.get("./mount");
  const mod = (typeof factory === "function" ? await (factory as () => unknown)() : factory) as
    | { default?: AuthMountFn }
    | AuthMountFn;
  const mount = (typeof mod === "function" ? mod : mod?.default) as AuthMountFn | undefined;
  if (!mount) throw new Error("Could not load the auth widget mount");
  return mount;
}
