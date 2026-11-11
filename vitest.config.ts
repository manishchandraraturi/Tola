import { defineConfig } from "vitest/config";
import path from "path";

// Unit tests cover the pure domain logic in src/lib/tola.ts only.
// The Prisma handle is swapped for a stub so no test touches the database —
// routes are covered separately by scripts/check-routes.sh.
export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@\/lib\/db$/,
        replacement: path.resolve(process.cwd(), "tests/helpers/db-stub.ts"),
      },
      { find: "@", replacement: path.resolve(process.cwd(), "src") },
    ],
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
