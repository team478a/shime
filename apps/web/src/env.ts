import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url().startsWith("postgresql://"),
  SESSION_PEPPER: z.string().min(32),
  PASSWORD_PEPPER: z.string().min(32),
  LINK_TOKEN_PEPPER: z.string().min(32),
  QR_TOKEN_PEPPER: z.string().min(32),
  APP_URL: z.string().url(),
  APP_ENV: z.enum(["development", "staging", "production", "test"]),
});

export type AppEnv = z.infer<typeof schema>;

let cached: AppEnv | undefined;
export function getEnv(): AppEnv {
  cached ??= schema.parse(process.env);
  return cached;
}
