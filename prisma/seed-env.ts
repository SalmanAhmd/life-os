/**
 * Environment bootstrap for the demo seeder.
 *
 * Why this is a separate module with a side effect
 * -------------------------------------------------
 * `@prisma/client` eagerly loads `.env` the moment it is imported, and
 * `@next/env` never overrides a variable already present in `process.env`.
 * Because ES module imports are hoisted, a `loadEnvConfig()` call placed inside
 * `seed.ts` runs *after* Prisma has already read `.env` — so `.env.local` could
 * never win, and the seeder would silently target a different database than
 * `next dev`.
 *
 * Importing this module first (before `@prisma/client`) lets it load the `.env*`
 * files exactly like `next dev` (development mode) *before* Prisma gets a chance
 * to read `.env`, keeping the seeder and the app on the same database.
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd(), /* dev */ true);
