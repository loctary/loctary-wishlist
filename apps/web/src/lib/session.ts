import { useSyncExternalStore } from "react";
import { loadAuthStore, type RemoteAuthState, type RemoteAuthStore } from "./remoteAuth";
import type { AuthUser } from "./authTypes";

/**
 * Session for the host — wraps the auth remote's federated `./authStore`.
 *
 * The auth remote is the source of truth for "who is signed in": its
 * `authStore` reads the shared `/auth/me` and is mutated in place by the
 * embedded profile widget (name/avatar/providers), so subscribing here means
 * the header / every consumer re-renders automatically on profile edits — no
 * `/wishlist/me` round-trip, no React-Query invalidate dance.
 *
 * The wishlist backend still owns authorization (ownership checks on every
 * mutation); we only needed `/wishlist/me` for the host's UI, and the auth
 * uuid is enough for that — every gate left in the UI is ownership-based.
 *
 * Client-only: the auth remote loads over MF in the browser, so SSR always
 * returns `{ user: null, loading: true }`. On the client we kick off the
 * remote import on first `subscribe` and attach a single forwarding
 * subscription that mirrors the store's snapshot into our local listener set.
 * That keeps `useSyncExternalStore` happy with a stable `subscribe`/`getSnapshot`
 * pair even though the underlying store loads asynchronously.
 */
const AUTH_API = (import.meta.env.VITE_AUTH_API_URL ?? "http://localhost:3002").replace(/\/$/, "");

const SSR_STATE: RemoteAuthState = { user: null, loading: true };

const listeners = new Set<() => void>();
let cachedStore: RemoteAuthStore | null = null;
let storeLoading = false;
let currentSnapshot: RemoteAuthState = SSR_STATE;

function notify() {
  listeners.forEach((l) => l());
}

function attach(store: RemoteAuthStore) {
  cachedStore = store;
  currentSnapshot = store.getSnapshot();
  store.subscribe(() => {
    currentSnapshot = store.getSnapshot();
    notify();
  });
  notify();
}

function ensureStore() {
  if (typeof window === "undefined") return;
  if (cachedStore || storeLoading) return;
  storeLoading = true;
  loadAuthStore()
    .then(attach)
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : "auth remote unavailable";
      currentSnapshot = { user: null, loading: false, error: message };
      notify();
    });
}

function subscribe(listener: () => void): () => void {
  ensureStore();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): RemoteAuthState {
  return currentSnapshot;
}

function getServerSnapshot(): RemoteAuthState {
  return SSR_STATE;
}

export interface UseSessionResult {
  user: AuthUser | null;
  loading: boolean;
  error?: string;
}

export function useSession(): UseSessionResult {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useLogout() {
  return async () => {
    try {
      await fetch(`${AUTH_API}/auth/logout`, { method: "POST", credentials: "include" });
    } catch {
      /* ignore — we clear local state regardless */
    }
    const store = await loadAuthStore().catch(() => null);
    if (store) {
      store.set(null);
      void store.refresh();
    }
  };
}
