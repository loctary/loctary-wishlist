/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AUTH_API_URL?: string;
  readonly VITE_AUTH_REMOTE_NAME?: string;
  readonly VITE_AUTH_REMOTE_ENTRY?: string;
  readonly VITE_WISHLIST_API_URL?: string;
  readonly VITE_COOKIE_DOMAIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
