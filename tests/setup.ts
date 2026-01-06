/**
 * Vitest 全域設定檔
 *
 * 此檔案在所有測試執行前載入，用於：
 * 1. 設定全域 Mock（避免測試時連接真實資源）
 * 2. 設定測試環境變數
 * 3. 定義全域的 beforeAll/afterAll/afterEach hooks
 */

import { beforeAll, afterAll, afterEach, vi } from 'vitest';

// ============================================
// 全域 Mock：避免測試時連接真實資源
// ============================================

// Mock Redis 客戶端（預設為 null，表示未啟用）
vi.mock('../src/shared/redis.js', () => ({
  default: null,
}));

// Mock Logger（避免測試時輸出大量日誌）
vi.mock('../src/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    verbose: vi.fn(),
  },
}));

// Mock 環境配置（使用測試專用配置）
vi.mock('../src/config.js', () => ({
  default: {
    clientId: 'test-client-id',
    guildId: 'test-guild-id',
    token: 'test-token',
    discord: {
      token: 'test-token',
      clientId: 'test-client-id',
      guildId: 'test-guild-id',
    },
    gachaDatabase: {
      host: 'localhost',
      port: 5432,
      user: 'test',
      password: 'test',
      name: 'test_gacha',
    },
    mimiDLCDatabase: {
      host: 'localhost',
      port: 5432,
      user: 'test',
      password: 'test',
      name: 'test_mimidlc',
    },
    ticketDatabase: {
      host: 'localhost',
      port: 5432,
      user: 'test',
      password: 'test',
      name: 'test_mimidlc',
    },
    odogDatabase: {
      host: 'localhost',
      port: 5432,
      user: 'test',
      password: 'test',
      name: 'test_gacha',
    },
    antiSpam: {
      spamThreshold: 7,
      timeWindow: 8000,
      multiChannelSpamThreshold: 6,
      multiChannelTimeWindow: 12000,
      timeoutDuration: 86400000,
      adminChannelId: '',
      ignoredRoles: [],
      ignoredUsers: [],
      memoryCleanupInterval: 3600000,
      inactiveUserThreshold: 7200000,
    },
    resources: {
      images: {
        close: 'https://example.com/close.png',
        thumbnail: 'https://example.com/thumbnail.png',
        sandClock: 'https://example.com/sand-clock.png',
      },
      links: {
        supportServer: 'https://discord.gg/test',
      },
    },
  },
}));

// Mock database module to avoid actual database connections
vi.mock('../src/shared/database/index.js', () => ({
  gachaPool: {
    query: vi.fn(),
    connect: vi.fn(),
    end: vi.fn(),
    on: vi.fn(),
  },
  mimiDLCDb: {
    selectFrom: vi.fn().mockReturnValue({
      selectAll: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue([]),
          }),
          execute: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    insertInto: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        execute: vi.fn().mockResolvedValue({}),
      }),
    }),
    deleteFrom: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          executeTakeFirst: vi.fn().mockResolvedValue({ numDeletedRows: 1n }),
        }),
      }),
    }),
  },
  gachaDb: {
    selectFrom: vi.fn(),
    insertInto: vi.fn(),
  },
}));

// ============================================
// 環境變數設定
// ============================================

beforeAll(() => {
  // 設定測試環境
  process.env.NODE_ENV = 'test';
  process.env.REDIS_ENABLED = 'false';

  // 清除可能影響測試的環境變數
  delete process.env.DATABASE_URL;
  delete process.env.REDIS_URL;
});

// ============================================
// 每個測試後的清理
// ============================================

afterEach(() => {
  // 清除所有 Mock 的呼叫記錄
  vi.clearAllMocks();
});

// ============================================
// 所有測試完成後的清理
// ============================================

afterAll(() => {
  // 還原所有 Mock
  vi.restoreAllMocks();
});

// ============================================
// 全域測試輔助函數
// ============================================

/**
 * 等待指定毫秒數
 * 用於測試需要等待的非同步操作
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 建立一個會在指定時間後 resolve 的 Promise
 * 用於測試 timeout 相關邏輯
 */
export function createDelayedPromise<T>(value: T, delayMs: number): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), delayMs));
}
