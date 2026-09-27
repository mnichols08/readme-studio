import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
  worker: { format: "es" },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/highlight.js/"))
            return "syntax-highlighting";
        },
      },
    },
  },
  test: { environment: "jsdom", include: ["tests/**/*.test.js"] },
});
