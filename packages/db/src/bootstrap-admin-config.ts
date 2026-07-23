import { z } from "zod";

const environmentSchema = z
  .object({
    APP_ENV: z.enum(["development", "staging", "production", "test"]),
    DATABASE_MIGRATION_URL: z.string().startsWith("postgresql://").optional(),
    DATABASE_URL: z.string().startsWith("postgresql://").optional(),
    PASSWORD_PEPPER: z.string().min(32),
    BOOTSTRAP_TENANT_CODE: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .regex(/^[a-z0-9][a-z0-9-]*$/)
      .default("shime"),
    BOOTSTRAP_TENANT_NAME: z.string().trim().min(1).max(200).default("SHIME"),
    BOOTSTRAP_ADMIN_LOGIN_ID: z
      .string()
      .trim()
      .min(3)
      .max(255)
      .regex(/^[a-z0-9][a-z0-9._-]*$/)
      .default("admin"),
    BOOTSTRAP_ADMIN_DISPLAY_NAME: z.string().trim().min(1).max(120).default("SHIME administrator"),
    BOOTSTRAP_ADMIN_PASSWORD: z.string().min(12).max(128).optional(),
    SEED_ADMIN_PASSWORD: z.string().min(12).max(128).optional(),
    BOOTSTRAP_ROTATE_PASSWORD: z.enum(["true", "false"]).default("false"),
    BOOTSTRAP_CONFIRM_PRODUCTION: z.string().optional(),
  })
  .superRefine((env, context) => {
    if (!env.DATABASE_MIGRATION_URL && !env.DATABASE_URL) {
      context.addIssue({ code: "custom", message: "DATABASE_MIGRATION_URL or DATABASE_URL is required" });
    }
    if (!env.BOOTSTRAP_ADMIN_PASSWORD && !env.SEED_ADMIN_PASSWORD) {
      context.addIssue({ code: "custom", message: "BOOTSTRAP_ADMIN_PASSWORD or SEED_ADMIN_PASSWORD is required" });
    }
    if (env.APP_ENV === "production" && env.BOOTSTRAP_CONFIRM_PRODUCTION !== env.BOOTSTRAP_TENANT_CODE) {
      context.addIssue({
        code: "custom",
        message: "Production bootstrap requires BOOTSTRAP_CONFIRM_PRODUCTION to equal BOOTSTRAP_TENANT_CODE",
      });
    }
  });

export type AdminBootstrapConfig = {
  databaseUrl: string;
  passwordPepper: string;
  tenantCode: string;
  tenantName: string;
  loginId: string;
  displayName: string;
  password: string;
  rotatePassword: boolean;
};

export function parseAdminBootstrapConfig(input: Record<string, string | undefined>): AdminBootstrapConfig {
  const env = environmentSchema.parse(input);
  return {
    databaseUrl: env.DATABASE_MIGRATION_URL ?? env.DATABASE_URL!,
    passwordPepper: env.PASSWORD_PEPPER,
    tenantCode: env.BOOTSTRAP_TENANT_CODE,
    tenantName: env.BOOTSTRAP_TENANT_NAME,
    loginId: env.BOOTSTRAP_ADMIN_LOGIN_ID.toLowerCase(),
    displayName: env.BOOTSTRAP_ADMIN_DISPLAY_NAME,
    password: env.BOOTSTRAP_ADMIN_PASSWORD ?? env.SEED_ADMIN_PASSWORD!,
    rotatePassword: env.BOOTSTRAP_ROTATE_PASSWORD === "true",
  };
}
