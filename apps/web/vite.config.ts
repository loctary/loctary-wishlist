import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";

/**
 * TanStack Start (SSR) host. It consumes the loctary-auth Module Federation
 * remote at **runtime** (`@module-federation/runtime`, client-only — see
 * `src/lib/remoteAuth.ts`), NOT via a build plugin: that keeps MF fully
 * decoupled from Start's Vite/Nitro build and avoids running the remote during
 * SSR. So there is no `@module-federation/vite` here.
 */
export default defineConfig({
  server: { port: 3000 },
  plugins: [tanstackStart(), viteReact()],
});
