import { useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { loadAuthStore } from "./remoteAuth";
import type { AuthMeState, AuthStore, AuthUser } from "./authTypes";

/**
 * Session for the host. loctary-auth owns identity and exposes a federated
 * `authStore` singleton around `GET /auth/me`; wishlist mirrors that store with
 * its own React instance, then invalidates wishlist data when identity changes.
 */
const AUTH_API = (import.meta.env.VITE_AUTH_API_URL ?? "http://localhost:3002").replace(/\/$/, "");

export type SessionUser = AuthUser;

const serverSnapshot: AuthMeState = { user: null, loading: true };
let state: AuthMeState = serverSnapshot;
const listeners = new Set<() => void>();

let store: AuthStore | null = null;
let storePromise: Promise<AuthStore> | null = null;
let unsubscribeStore: (() => void) | null = null;

function emit() {
  listeners.forEach((listener) => listener());
}

function setState(next: AuthMeState) {
  state = next;
  emit();
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Could not load auth state";
}

function mirrorStore(nextStore: AuthStore) {
  setState(nextStore.getSnapshot());
  if (!unsubscribeStore) {
    unsubscribeStore = nextStore.subscribe(() => setState(nextStore.getSnapshot()));
  }
}

async function ensureAuthStore(): Promise<AuthStore> {
  if (store) return store;
  storePromise ??= loadAuthStore()
    .then((nextStore) => {
      store = nextStore;
      mirrorStore(nextStore);
      return nextStore;
    })
    .catch((error: unknown) => {
      storePromise = null;
      setState({ user: null, loading: false, error: errorMessage(error) });
      throw error;
    });
  return storePromise;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  void ensureAuthStore();
  return () => {
    listeners.delete(listener);
  };
}

export async function fetchSession(): Promise<SessionUser | null> {
  try {
    const authStore = await ensureAuthStore();
    return authStore.invalidate();
  } catch {
    return null;
  }
}

export function setSessionUser(user: SessionUser | null) {
  if (store) {
    store.set(user);
  } else {
    setState({ user, loading: false });
  }
}

export function useSession() {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => serverSnapshot);
  return {
    data: snapshot.user,
    isLoading: snapshot.loading,
    error: snapshot.error,
    refetch: fetchSession,
  };
}

export function useLogout() {
  const qc = useQueryClient();
  return async () => {
    try {
      await fetch(`${AUTH_API}/auth/logout`, { method: "POST", credentials: "include" });
    } catch {
      /* ignore - we clear local state regardless */
    }
    setSessionUser(null);
    // The session changed -> every cached response (lists, item detail, the
    // per-item `viewer` flags) was computed for the now-logged-out user.
    // Invalidate the whole cache so it all refetches anonymously.
    await qc.invalidateQueries();
  };
}
