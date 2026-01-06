/**
 * AntiSpamSettingsManager 單元測試
 *
 * 測試範圍：
 * - constructor: 初始化及依賴注入
 * - getAntiSpamSettings(): 快取優先、資料庫回退、錯誤處理
 * - updateAntiSpamSettings(): 更新設定並同步快取
 * - clearCache(): 清除指定 guild 的快取
 *
 * Mock 策略：
 * - Kysely db: mock selectFrom/updateTable chains
 * - CacheService: mock get/set/del
 * - logger: mock error
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================
// Mock 設定 - 使用 vi.hoisted 確保持久化
// ============================================

const {
  mockCacheGet,
  mockCacheSet,
  mockCacheDel,
  mockLoggerError,
  mockDbSelectFrom,
  mockDbUpdateTable,
  mockCacheServiceInstance,
} = vi.hoisted(() => {
  const cacheInstance = {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  };
  return {
    mockCacheGet: cacheInstance.get,
    mockCacheSet: cacheInstance.set,
    mockCacheDel: cacheInstance.del,
    mockLoggerError: vi.fn(),
    mockDbSelectFrom: vi.fn(),
    mockDbUpdateTable: vi.fn(),
    mockCacheServiceInstance: cacheInstance,
  };
});

// Mock CacheService
vi.mock('../../../src/services/CacheService', () => ({
  CacheService: class MockCacheService {
    static instance = mockCacheServiceInstance;
    static getInstance = vi.fn(() => mockCacheServiceInstance);
    get = mockCacheGet;
    set = mockCacheSet;
    del = mockCacheDel;
    constructor() {}
  },
  cacheService: mockCacheServiceInstance,
}));

// Mock logger
vi.mock('../../../src/utils/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: mockLoggerError,
  },
}));

// ============================================
// Import after mocks
// ============================================

import { AntiSpamSettingsManager } from '../../../src/services/AntiSpamSettingsManager.js';

// ============================================
// Test Helpers
// ============================================

// Keep track of mock functions that need to be configured per test
const mockExecuteTakeFirst = vi.fn();
const mockExecute = vi.fn();

function createMockDb() {
  const mockWhereForSelect = vi.fn().mockReturnValue({
    executeTakeFirst: mockExecuteTakeFirst,
  });

  const mockWhereForUpdate = vi.fn().mockReturnValue({
    execute: mockExecute,
  });

  const mockSelect = vi.fn().mockReturnValue({
    where: mockWhereForSelect,
  });

  const mockSet = vi.fn().mockReturnValue({
    where: mockWhereForUpdate,
  });

  mockDbSelectFrom.mockReturnValue({
    select: mockSelect,
  });

  mockDbUpdateTable.mockReturnValue({
    set: mockSet,
  });

  return {
    selectFrom: mockDbSelectFrom,
    updateTable: mockDbUpdateTable,
    _mocks: {
      executeTakeFirst: mockExecuteTakeFirst,
      execute: mockExecute,
      select: mockSelect,
      set: mockSet,
    },
  };
}

describe('AntiSpamSettingsManager', () => {
  let manager: AntiSpamSettingsManager;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockCacheGet.mockResolvedValue(null);
    mockCacheSet.mockResolvedValue(undefined);
    mockCacheDel.mockResolvedValue(undefined);
    mockExecuteTakeFirst.mockResolvedValue(null);
    mockExecute.mockResolvedValue(undefined);

    manager = new AntiSpamSettingsManager(mockDb as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================
  // Constructor 測試
  // ============================================

  describe('constructor', () => {
    it('should initialize with database dependency', () => {
      expect(manager).toBeDefined();
    });

    it('should create CacheService instance', () => {
      // The CacheService is created internally
      // We verify by calling a method that uses it
      expect(mockCacheGet).not.toHaveBeenCalled(); // Not called yet
    });
  });

  // ============================================
  // getAntiSpamSettings() 測試
  // ============================================

  describe('getAntiSpamSettings()', () => {
    const testGuildId = 'guild-123456';

    describe('cache hit', () => {
      it('should return cached settings when available', async () => {
        // Arrange
        const cachedSettings = { log_channel_id: 'channel-123' };
        mockCacheGet.mockResolvedValueOnce(cachedSettings);

        // Act
        const result = await manager.getAntiSpamSettings(testGuildId);

        // Assert
        expect(result).toEqual(cachedSettings);
        expect(mockCacheGet).toHaveBeenCalledWith(`antispam:settings:${testGuildId}`);
        expect(mockDbSelectFrom).not.toHaveBeenCalled();
      });

      it('should use correct cache key format', async () => {
        // Arrange
        mockCacheGet.mockResolvedValueOnce({ log_channel_id: 'ch-1' });

        // Act
        await manager.getAntiSpamSettings('my-guild-id');

        // Assert
        expect(mockCacheGet).toHaveBeenCalledWith('antispam:settings:my-guild-id');
      });
    });

    describe('cache miss - database query', () => {
      it('should query database when cache miss', async () => {
        // Arrange
        mockCacheGet.mockResolvedValueOnce(null);
        const dbSettings = { log_channel_id: 'channel-456' };
        mockExecuteTakeFirst.mockResolvedValueOnce(dbSettings);

        // Act
        const result = await manager.getAntiSpamSettings(testGuildId);

        // Assert
        expect(result).toEqual(dbSettings);
        expect(mockDbSelectFrom).toHaveBeenCalledWith('anti_spam_logs');
      });

      it('should cache database result on success', async () => {
        // Arrange
        mockCacheGet.mockResolvedValueOnce(null);
        const dbSettings = { log_channel_id: 'channel-789' };
        mockExecuteTakeFirst.mockResolvedValueOnce(dbSettings);

        // Act
        await manager.getAntiSpamSettings(testGuildId);

        // Assert
        expect(mockCacheSet).toHaveBeenCalledWith(
          `antispam:settings:${testGuildId}`,
          dbSettings
        );
      });

      it('should return null when no settings found in database', async () => {
        // Arrange
        mockCacheGet.mockResolvedValueOnce(null);
        mockExecuteTakeFirst.mockResolvedValueOnce(null);

        // Act
        const result = await manager.getAntiSpamSettings(testGuildId);

        // Assert
        expect(result).toBeNull();
        expect(mockCacheSet).not.toHaveBeenCalled();
      });

      it('should not cache null results', async () => {
        // Arrange
        mockCacheGet.mockResolvedValueOnce(null);
        mockExecuteTakeFirst.mockResolvedValueOnce(null);

        // Act
        await manager.getAntiSpamSettings(testGuildId);

        // Assert
        expect(mockCacheSet).not.toHaveBeenCalled();
      });
    });

    describe('error handling', () => {
      it('should return null and log error on database failure', async () => {
        // Arrange
        mockCacheGet.mockResolvedValueOnce(null);
        mockExecuteTakeFirst.mockRejectedValueOnce(new Error('DB connection failed'));

        // Act
        const result = await manager.getAntiSpamSettings(testGuildId);

        // Assert
        expect(result).toBeNull();
        expect(mockLoggerError).toHaveBeenCalledWith(
          `Error fetching anti-spam settings for guild ${testGuildId}:`,
          expect.any(Error)
        );
      });

      it('should continue working after database error', async () => {
        // Arrange - first call fails
        mockCacheGet.mockResolvedValueOnce(null);
        mockExecuteTakeFirst.mockRejectedValueOnce(new Error('Transient error'));

        // First call - should fail gracefully
        const result1 = await manager.getAntiSpamSettings(testGuildId);
        expect(result1).toBeNull();

        // Second call - should work if cache has value
        mockCacheGet.mockResolvedValueOnce({ log_channel_id: 'recovered' });
        const result2 = await manager.getAntiSpamSettings(testGuildId);
        expect(result2).toEqual({ log_channel_id: 'recovered' });
      });
    });
  });

  // ============================================
  // updateAntiSpamSettings() 測試
  // ============================================

  describe('updateAntiSpamSettings()', () => {
    const testGuildId = 'guild-update-123';
    const newSettings = { log_channel_id: 'new-channel-id' };

    it('should update database with new settings', async () => {
      // Act
      await manager.updateAntiSpamSettings(testGuildId, newSettings);

      // Assert
      expect(mockDbUpdateTable).toHaveBeenCalledWith('anti_spam_logs');
    });

    it('should update cache after successful database update', async () => {
      // Act
      await manager.updateAntiSpamSettings(testGuildId, newSettings);

      // Assert
      expect(mockCacheSet).toHaveBeenCalledWith(
        `antispam:settings:${testGuildId}`,
        newSettings
      );
    });

    it('should log error on database failure', async () => {
      // Arrange
      mockExecute.mockRejectedValueOnce(new Error('Update failed'));

      // Act
      await manager.updateAntiSpamSettings(testGuildId, newSettings);

      // Assert
      expect(mockLoggerError).toHaveBeenCalledWith(
        `Error updating anti-spam settings for guild ${testGuildId}:`,
        expect.any(Error)
      );
    });

    it('should not update cache on database failure', async () => {
      // Arrange
      mockExecute.mockRejectedValueOnce(new Error('Update failed'));

      // Act
      await manager.updateAntiSpamSettings(testGuildId, newSettings);

      // Assert
      expect(mockCacheSet).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // clearCache() 測試
  // ============================================

  describe('clearCache()', () => {
    it('should delete cache for specified guild', async () => {
      // Act
      await manager.clearCache('guild-to-clear');

      // Assert
      expect(mockCacheDel).toHaveBeenCalledWith('antispam:settings:guild-to-clear');
    });

    it('should use correct cache key format', async () => {
      // Act
      await manager.clearCache('another-guild');

      // Assert
      expect(mockCacheDel).toHaveBeenCalledWith('antispam:settings:another-guild');
    });
  });

  // ============================================
  // AntiSpamSettings interface 測試
  // ============================================

  describe('AntiSpamSettings interface', () => {
    it('should have correct shape', () => {
      const settings = {
        log_channel_id: '1234567890',
      };

      expect(settings.log_channel_id).toBe('1234567890');
    });

    it('should validate channel ID format (Discord snowflake)', () => {
      const isValidSnowflake = (id: string) => /^\d{17,19}$/.test(id);

      expect(isValidSnowflake('123456789012345678')).toBe(true);
      expect(isValidSnowflake('1234567890123456789')).toBe(true);
      expect(isValidSnowflake('123')).toBe(false);
      expect(isValidSnowflake('invalid')).toBe(false);
    });
  });

  // ============================================
  // Cache key patterns 測試
  // ============================================

  describe('cache key patterns', () => {
    it('should use antispam:settings prefix', async () => {
      mockCacheGet.mockResolvedValueOnce({ log_channel_id: 'test' });

      await manager.getAntiSpamSettings('test-guild');

      expect(mockCacheGet).toHaveBeenCalledWith(
        expect.stringMatching(/^antispam:settings:/)
      );
    });

    it('should handle different guild IDs correctly', async () => {
      const guildIds = ['123', '456789', 'abc-def-ghi'];

      for (const guildId of guildIds) {
        mockCacheGet.mockResolvedValueOnce(null);
        mockExecuteTakeFirst.mockResolvedValueOnce(null);

        await manager.getAntiSpamSettings(guildId);

        expect(mockCacheGet).toHaveBeenCalledWith(`antispam:settings:${guildId}`);
      }
    });
  });
});
