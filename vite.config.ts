import { defineConfig, type Plugin } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Dev-only content store for the in-game editor (`?edit=1`): `POST /__content/save` with
 * `{ file, data }` writes pretty JSON under `src/content/`, nothing else, and the resulting
 * HMR reload is how the edit reaches the running game. Absent from production builds.
 */
function contentStore(): Plugin {
  return {
    name: "stargate-content-store",
    configureServer(server) {
      server.middlewares.use("/__content/save", (req, res) => {
        if (req.method !== "POST") return void ((res.statusCode = 405), res.end());
        let body = "";
        req.on("data", (c: Buffer) => (body += c));
        req.on("end", () => {
          try {
            const { file, data } = JSON.parse(body) as { file: string; data: unknown };
            if (!/^src\/content\/[a-z0-9_-]+\.json$/.test(file)) throw new Error("file must be src/content/<name>.json");
            mkdirSync(resolve(server.config.root, "src/content"), { recursive: true });
            writeFileSync(resolve(server.config.root, file), JSON.stringify(data, null, 2) + "\n");
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ ok: true, file }));
          } catch (e) {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: String((e as Error).message ?? e) }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [contentStore()],
  resolve: { alias: { "@": "/src" } },
  server: { port: 5187, strictPort: false },
  build: { target: "es2022", sourcemap: false,
    rollupOptions: { input: { game: resolve(__dirname, 'index.html'), episodeFleet: resolve(__dirname, 'episode-fleet.html'), audioPreview: resolve(__dirname, 'audio-preview.html') } },
  },
});
