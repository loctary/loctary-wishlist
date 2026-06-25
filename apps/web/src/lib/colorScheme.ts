import type { MantineColorSchemeManager, MantineColorScheme } from "@mantine/core";

/**
 * Cookie-backed color scheme manager. Stores the choice in a domain-wide `mode`
 * cookie so the theme is shared with loctary-auth and across subdomains —
 * exactly the cookie the embedded auth widget reads. Mirrors auth's
 * `cookieColorSchemeManager`.
 */
const COOKIE = "mode";
const VALID: MantineColorScheme[] = ["light", "dark", "auto"];

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]!) : undefined;
}

export function cookieColorSchemeManager(options?: {
  domain?: string;
}): MantineColorSchemeManager {
  let handler: ((event: MediaQueryListEvent) => void) | undefined;

  return {
    get(defaultValue) {
      const value = readCookie(COOKIE);
      return value && VALID.includes(value as MantineColorScheme)
        ? (value as MantineColorScheme)
        : defaultValue;
    },
    set(value) {
      if (typeof document === "undefined") return;
      const domain = options?.domain ? `; domain=${options.domain}` : "";
      const secure = location.protocol === "https:" ? "; secure" : "";
      // 1 year, shared across the site.
      document.cookie = `${COOKIE}=${encodeURIComponent(value)}; path=/${domain}; max-age=31536000; samesite=lax${secure}`;
    },
    subscribe(onUpdate) {
      if (typeof window === "undefined") return;
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      handler = (event) => {
        if (this.get("auto") === "auto") onUpdate(event.matches ? "dark" : "light");
      };
      media.addEventListener("change", handler);
    },
    unsubscribe() {
      if (typeof window === "undefined" || !handler) return;
      window
        .matchMedia("(prefers-color-scheme: dark)")
        .removeEventListener("change", handler);
    },
    clear() {
      if (typeof document === "undefined") return;
      const domain = options?.domain ? `; domain=${options.domain}` : "";
      document.cookie = `${COOKIE}=; path=/${domain}; max-age=0`;
    },
  };
}
