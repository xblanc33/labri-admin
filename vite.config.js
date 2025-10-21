import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  root: "frontend",
  plugins: [vue()],
  server: {
    port: 5173,
    open: true,
  },
  preview: {
    port: 4173,
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
});
