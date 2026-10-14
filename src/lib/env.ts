import { z } from "zod";

/**
 * Server-side environment validation.
 *
 * Secrets live here only. This module must never be imported from a Client
 * Component — the `server-only` guard below enforces that at build time.
 */
import "server-only";

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),
  AUTH_URL: z.string().url().optional(),
  // Optional: used only when an email provider is configured in the future.
  AUTH_TRUST_HOST: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

function formatIssues(error: z.ZodError): string {
  return error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
}

let cached: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid server environment variables:\n${formatIssues(parsed.error)}\n` +
        `Copy .env.example to .env and fill in the values.`,
    );
  }
  cached = parsed.data;
  return cached;
}
