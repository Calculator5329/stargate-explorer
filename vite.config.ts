import { defineConfig } from "vite";

export default defineConfig({
  resolve: { alias: { "@": "/src" } },
  server: { port: 5187, strictPort: false },
  build: { target: "es2022", sourcemap: false },
});
