import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

// Bağımsız Vitest yapılandırması — Tauri runtime'ı gerektirmeyen saf
// fonksiyon testleri için. `node` ortamı yeterli; jsdom'a gerek yok çünkü
// test edilen mantık (sentinel → typed Error eşlemesi) DOM kullanmaz.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(here, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
