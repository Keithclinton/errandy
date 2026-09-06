import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Errandspot",
        short_name: "Errandspot",
        description: "Post errands, bid on them, and get things done.",
        theme_color: "#0284c7",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Precache static assets only — HTML is handled by the runtimeCaching rule below,
        // not precached, so a deploy is never masked by a stale cached page shell.
        globPatterns: ["**/*.{js,css,svg,png,ico}"],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        // vite-plugin-pwa defaults to a precache-first NavigationRoute bound to index.html,
        // registered *before* the runtimeCaching rule below. Since index.html is deliberately
        // excluded from the precache manifest above, binding a route to it throws at SW
        // startup (an unhandled rejection that silently aborts every registerRoute call after
        // it — including the NetworkFirst rule below, which never actually gets registered).
        // Disabling the fallback outright, rather than denylisting it, avoids constructing it
        // at all and leaves NetworkFirst as the only navigation handler.
        navigateFallback: null,
        runtimeCaching: [
          {
            // Page navigations always try the network first (so you get the deploy you
            // just shipped), falling back to the last cached page only if that's slow/offline.
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "pages",
              networkTimeoutSeconds: 3,
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
  },
});
