/**
 * env 環境變數驗證單元測試
 *
 * 測試範圍：
 * - envSchema: Zod schema 驗證
 * - 必要環境變數的驗證
 * - 可選環境變數的處理
 * - 類型轉換（port numbers, booleans）
 *
 * 測試策略：
 * - 直接測試 Zod schema 而非匯出的 env 物件
 * - 因為 env.ts 在 import 時會立即執行驗證並可能 exit
 * - 我們需要隔離測試 schema 本身的行為
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// ============================================
// 重新定義 envSchema 以便測試
// （因為原始模組會在 import 時執行 process.exit）
// ============================================

const envSchema = z.object({
  // Discord
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN is required'),
  CLIENT_ID: z.string().min(1, 'CLIENT_ID is required'),
  DEV_GUILD_ID: z.string().optional(),

  // MimiDLC Database
  MIMIDLC_DB_HOST: z.string().min(1, 'MIMIDLC_DB_HOST is required'),
  MIMIDLC_DB_PORT: z.string().transform(Number),
  MIMIDLC_DB_USER: z.string().min(1, 'MIMIDLC_DB_USER is required'),
  MIMIDLC_DB_PASSWORD: z.string(),
  MIMIDLC_DB_NAME: z.string().min(1, 'MIMIDLC_DB_NAME is required'),

  // Gacha Database
  GACHA_DB_HOST: z.string().min(1, 'GACHA_DB_HOST is required'),
  GACHA_DB_PORT: z.string().transform(Number),
  GACHA_DB_USER: z.string().min(1, 'GACHA_DB_USER is required'),
  GACHA_DB_PASSWORD: z.string(),
  GACHA_DB_NAME: z.string().min(1, 'GACHA_DB_NAME is required'),

  // Redis
  REDIS_ENABLED: z
    .string()
    .transform((v) => v === 'true')
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
  NODE_ENV: z.enum(['development', 'production']).default('production'),
});

// ============================================
// 測試輔助函數
// ============================================

function createValidEnv(): Record<string, string> {
  return {
    // Discord (required)
    DISCORD_TOKEN: 'test-token-123',
    CLIENT_ID: 'client-id-456',

    // MimiDLC Database (required)
    MIMIDLC_DB_HOST: 'localhost',
    MIMIDLC_DB_PORT: '5432',
    MIMIDLC_DB_USER: 'postgres',
    MIMIDLC_DB_PASSWORD: 'password',
    MIMIDLC_DB_NAME: 'mimidlc',

    // Gacha Database (required)
    GACHA_DB_HOST: 'localhost',
    GACHA_DB_PORT: '5433',
    GACHA_DB_USER: 'postgres',
    GACHA_DB_PASSWORD: 'password',
    GACHA_DB_NAME: 'gacha',
  };
}

describe('env validation schema', () => {
  // ============================================
  // 基本驗證測試
  // ============================================

  describe('basic validation', () => {
    it('should validate with all required fields', () => {
      // Arrange
      const env = createValidEnv();

      // Act
      const result = envSchema.safeParse(env);

      // Assert
      expect(result.success).toBe(true);
    });

    it('should set default NODE_ENV to production', () => {
      // Arrange
      const env = createValidEnv();
      // Don't set NODE_ENV

      // Act
      const result = envSchema.parse(env);

      // Assert
      expect(result.NODE_ENV).toBe('production');
    });

    it('should accept development as NODE_ENV', () => {
      // Arrange
      const env = { ...createValidEnv(), NODE_ENV: 'development' };

      // Act
      const result = envSchema.parse(env);

      // Assert
      expect(result.NODE_ENV).toBe('development');
    });

    it('should reject invalid NODE_ENV', () => {
      // Arrange
      const env = { ...createValidEnv(), NODE_ENV: 'staging' };

      // Act
      const result = envSchema.safeParse(env);

      // Assert
      expect(result.success).toBe(false);
    });
  });

  // ============================================
  // Discord 設定測試
  // ============================================

  describe('Discord configuration', () => {
    it('should require DISCORD_TOKEN', () => {
      // Arrange
      const env = createValidEnv();
      delete (env as any).DISCORD_TOKEN;

      // Act
      const result = envSchema.safeParse(env);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('DISCORD_TOKEN');
      }
    });

    it('should reject empty DISCORD_TOKEN', () => {
      // Arrange
      const env = { ...createValidEnv(), DISCORD_TOKEN: '' };

      // Act
      const result = envSchema.safeParse(env);

      // Assert
      expect(result.success).toBe(false);
    });

    it('should require CLIENT_ID', () => {
      // Arrange
      const env = createValidEnv();
      delete (env as any).CLIENT_ID;

      // Act
      const result = envSchema.safeParse(env);

      // Assert
      expect(result.success).toBe(false);
    });

    it('should allow optional DEV_GUILD_ID', () => {
      // Arrange
      const env = createValidEnv();
      // DEV_GUILD_ID is not set

      // Act
      const result = envSchema.safeParse(env);

      // Assert
      expect(result.success).toBe(true);
    });

    it('should accept DEV_GUILD_ID when provided', () => {
      // Arrange
      const env = { ...createValidEnv(), DEV_GUILD_ID: 'guild-123' };

      // Act
      const result = envSchema.parse(env);

      // Assert
      expect(result.DEV_GUILD_ID).toBe('guild-123');
    });
  });

  // ============================================
  // 資料庫設定測試
  // ============================================

  describe('database configuration', () => {
    it('should transform port string to number', () => {
      // Arrange
      const env = createValidEnv();

      // Act
      const result = envSchema.parse(env);

      // Assert
      expect(result.MIMIDLC_DB_PORT).toBe(5432);
      expect(typeof result.MIMIDLC_DB_PORT).toBe('number');
      expect(result.GACHA_DB_PORT).toBe(5433);
      expect(typeof result.GACHA_DB_PORT).toBe('number');
    });

    it('should require all MimiDLC database fields', () => {
      // Arrange
      const env = createValidEnv();
      delete (env as any).MIMIDLC_DB_HOST;

      // Act
      const result = envSchema.safeParse(env);

      // Assert
      expect(result.success).toBe(false);
    });

    it('should require all Gacha database fields', () => {
      // Arrange
      const env = createValidEnv();
      delete (env as any).GACHA_DB_NAME;

      // Act
      const result = envSchema.safeParse(env);

      // Assert
      expect(result.success).toBe(false);
    });

    it('should allow empty password', () => {
      // Arrange
      const env = { ...createValidEnv(), MIMIDLC_DB_PASSWORD: '' };

      // Act
      const result = envSchema.safeParse(env);

      // Assert
      expect(result.success).toBe(true);
    });
  });

  // ============================================
  // Redis 設定測試
  // ============================================

  describe('Redis configuration', () => {
    it('should allow optional Redis settings', () => {
      // Arrange
      const env = createValidEnv();
      // No Redis settings

      // Act
      const result = envSchema.safeParse(env);

      // Assert
      expect(result.success).toBe(true);
    });

    it('should transform REDIS_ENABLED "true" to boolean true', () => {
      // Arrange
      const env = { ...createValidEnv(), REDIS_ENABLED: 'true' };

      // Act
      const result = envSchema.parse(env);

      // Assert
      expect(result.REDIS_ENABLED).toBe(true);
    });

    it('should transform REDIS_ENABLED "false" to boolean false', () => {
      // Arrange
      const env = { ...createValidEnv(), REDIS_ENABLED: 'false' };

      // Act
      const result = envSchema.parse(env);

      // Assert
      expect(result.REDIS_ENABLED).toBe(false);
    });

    it('should transform any non-"true" value to false', () => {
      // Arrange
      const env = { ...createValidEnv(), REDIS_ENABLED: 'yes' };

      // Act
      const result = envSchema.parse(env);

      // Assert
      expect(result.REDIS_ENABLED).toBe(false);
    });

    it('should accept Redis URL and password', () => {
      // Arrange
      const env = {
        ...createValidEnv(),
        REDIS_ENABLED: 'true',
        REDIS_URL: 'redis://localhost:6379',
        REDIS_PASSWORD: 'secret',
      };

      // Act
      const result = envSchema.parse(env);

      // Assert
      expect(result.REDIS_URL).toBe('redis://localhost:6379');
      expect(result.REDIS_PASSWORD).toBe('secret');
    });
  });

  // ============================================
  // R2 儲存設定測試
  // ============================================

  describe('R2 storage configuration', () => {
    it('should allow optional R2 settings', () => {
      // Arrange
      const env = createValidEnv();

      // Act
      const result = envSchema.safeParse(env);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.R2_BUCKET_NAME).toBeUndefined();
      }
    });

    it('should accept all R2 settings when provided', () => {
      // Arrange
      const env = {
        ...createValidEnv(),
        R2_ACCOUNT_ID: 'account-123',
        R2_ACCESS_KEY_ID: 'access-key',
        R2_SECRET_ACCESS_KEY: 'secret-key',
        R2_BUCKET_NAME: 'my-bucket',
        R2_PUBLIC_URL: 'https://cdn.example.com',
      };

      // Act
      const result = envSchema.parse(env);

      // Assert
      expect(result.R2_ACCOUNT_ID).toBe('account-123');
      expect(result.R2_BUCKET_NAME).toBe('my-bucket');
    });

    it('should accept transcript path settings', () => {
      // Arrange
      const env = {
        ...createValidEnv(),
        TRANSCRIPT_PATH: '/var/transcripts',
        TRANSCRIPT_BASE_URL: 'https://transcripts.example.com',
      };

      // Act
      const result = envSchema.parse(env);

      // Assert
      expect(result.TRANSCRIPT_PATH).toBe('/var/transcripts');
      expect(result.TRANSCRIPT_BASE_URL).toBe('https://transcripts.example.com');
    });
  });

  // ============================================
  // OpenAI 設定測試
  // ============================================

  describe('OpenAI configuration', () => {
    it('should allow optional OpenAI settings', () => {
      // Arrange
      const env = createValidEnv();

      // Act
      const result = envSchema.safeParse(env);

      // Assert
      expect(result.success).toBe(true);
    });

    it('should accept OpenAI API key and endpoint', () => {
      // Arrange
      const env = {
        ...createValidEnv(),
        OPENAI_API_KEY: 'sk-test-123',
        OPENAI_API_ENDPOINT: 'https://api.openai.com/v1',
      };

      // Act
      const result = envSchema.parse(env);

      // Assert
      expect(result.OPENAI_API_KEY).toBe('sk-test-123');
      expect(result.OPENAI_API_ENDPOINT).toBe('https://api.openai.com/v1');
    });
  });

  // ============================================
  // 錯誤訊息測試
  // ============================================

  describe('error messages', () => {
    it('should provide descriptive error for missing required field', () => {
      // Arrange
      const env = createValidEnv();
      delete (env as any).DISCORD_TOKEN;

      // Act
      const result = envSchema.safeParse(env);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        const tokenError = result.error.issues.find(
          (issue) => issue.path.includes('DISCORD_TOKEN')
        );
        expect(tokenError).toBeDefined();
        // Zod default message for missing field is about type mismatch
        expect(tokenError?.message).toBeDefined();
      }
    });

    it('should collect multiple validation errors', () => {
      // Arrange
      const env = {
        // Missing most required fields
        NODE_ENV: 'production',
      };

      // Act
      const result = envSchema.safeParse(env);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        // Should have multiple errors for missing fields
        expect(result.error.issues.length).toBeGreaterThan(1);
      }
    });
  });

  // ============================================
  // 邊界情況測試
  // ============================================

  describe('edge cases', () => {
    it('should handle whitespace-only strings as valid (non-empty)', () => {
      // Arrange
      const env = { ...createValidEnv(), DISCORD_TOKEN: '   ' };

      // Act
      const result = envSchema.safeParse(env);

      // Assert
      // Whitespace is still a string with length > 0
      expect(result.success).toBe(true);
    });

    it('should handle very long strings', () => {
      // Arrange
      const env = { ...createValidEnv(), DISCORD_TOKEN: 'a'.repeat(10000) };

      // Act
      const result = envSchema.safeParse(env);

      // Assert
      expect(result.success).toBe(true);
    });

    it('should handle special characters in values', () => {
      // Arrange
      const env = {
        ...createValidEnv(),
        MIMIDLC_DB_PASSWORD: 'p@$$w0rd!#$%^&*()',
      };

      // Act
      const result = envSchema.parse(env);

      // Assert
      expect(result.MIMIDLC_DB_PASSWORD).toBe('p@$$w0rd!#$%^&*()');
    });

    it('should handle NaN for port transformation', () => {
      // Arrange
      const env = { ...createValidEnv(), MIMIDLC_DB_PORT: 'not-a-number' };

      // Act
      const result = envSchema.parse(env);

      // Assert
      expect(result.MIMIDLC_DB_PORT).toBeNaN();
    });
  });
});
