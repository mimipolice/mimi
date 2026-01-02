import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  // Discord
  DISCORD_TOKEN: z.string().min(1, "DISCORD_TOKEN is required"),
  CLIENT_ID: z.string().min(1, "CLIENT_ID is required"),
  DEV_GUILD_ID: z.string().optional(),

  // MimiDLC Database
  MIMIDLC_DB_HOST: z.string().min(1, "MIMIDLC_DB_HOST is required"),
  MIMIDLC_DB_PORT: z.string().transform(Number),
  MIMIDLC_DB_USER: z.string().min(1, "MIMIDLC_DB_USER is required"),
  MIMIDLC_DB_PASSWORD: z.string(),
  MIMIDLC_DB_NAME: z.string().min(1, "MIMIDLC_DB_NAME is required"),

  // Gacha Database
  GACHA_DB_HOST: z.string().min(1, "GACHA_DB_HOST is required"),
  GACHA_DB_PORT: z.string().transform(Number),
  GACHA_DB_USER: z.string().min(1, "GACHA_DB_USER is required"),
  GACHA_DB_PASSWORD: z.string(),
  GACHA_DB_NAME: z.string().min(1, "GACHA_DB_NAME is required"),

  // Redis
  REDIS_ENABLED: z
    .string()
    .transform((v) => v === "true")
    .optional(),
  REDIS_URL: z.string().optional(),
  REDIS_PASSWORD: z.string().optional(),

  // Transcript Storage
  TRANSCRIPT_PATH: z.string().optional(),
  TRANSCRIPT_BASE_URL: z.string().optional(),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_URL: z.string().optional(),

  // OpenAI
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_API_ENDPOINT: z.string().optional(),

  // Logging
  ERROR_WEBHOOK_URL: z.string().optional(),

  // Environment
  NODE_ENV: z.enum(["development", "production"]).default("production"),
});

export type Env = z.infer<typeof envSchema>;

let env: Env;

try {
  env = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    const missingVars = error.issues
      .map((e: z.ZodIssue) => `  - ${e.path.join(".")}: ${e.message}`)
      .join("\n");
    console.error("❌ Environment variable validation failed:\n" + missingVars);
    process.exit(1);
  }
  throw error;
}

export { env };
