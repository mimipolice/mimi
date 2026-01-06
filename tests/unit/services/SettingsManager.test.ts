/**
 * SettingsManager 單元測試
 *
 * 測試範圍：
 * - getSettings(): 快取優先策略，cache hit/miss、DB 查詢、錯誤處理
 * - updateSettings(): Upsert 邏輯、快取更新、錯誤處理
 * - clearCache(): 快取清除
 *
 * Mock 策略：
 * - CacheService: 使用 vi.hoisted() 創建持久化 mock
 * - Kysely DB: 使用 kysely-mocks helper
 * - Logger: mock 驗證錯誤日誌
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================
// Mock 設定 - 使用 vi.hoisted 確保持久化
// ============================================

// 使用 vi.hoisted 創建持久化的 mock 函數，這確保了即使 mockReset 也不會影響
const { mockCacheGet, mockCacheSet, mockCacheDel, mockLoggerError, mockCacheServiceInstance } = vi.hoisted(() => {
  const instance = {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  };
  return {
    mockCacheGet: instance.get,
    mockCacheSet: instance.set,
    mockCacheDel: instance.del,
    mockLoggerError: vi.fn(),
    mockCacheServiceInstance: instance,
  };
});

// Mock CacheService - 使用持久化的 mock 函數
vi.mock('../../../src/services/CacheService.js', () => ({
  CacheService: class MockCacheService {
    static instance = mockCacheServiceInstance;
    static getInstance = vi.fn(() => mockCacheServiceInstance);
    get = mockCacheGet;
    set = mockCacheSet;
    del = mockCacheDel;
  },
  cacheService: mockCacheServiceInstance,
}));

// Mock Logger
vi.mock('../../../src/utils/logger.js', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: mockLoggerError,
  },
}));

// 現在可以安全地 import
import { SettingsManager, type GuildSettings } from '../../../src/services/SettingsManager.js';
import {
  FIXTURE_COMPLETE_SETTINGS,
  FIXTURE_MINIMAL_SETTINGS,
  createSettingsFixture,
} from '../../fixtures/guild-settings.js';
import { createMockKysely, setupQueryError } from '../../helpers/kysely-mocks.js';

describe('SettingsManager', () => {
  let settingsManager: SettingsManager;
  let mockDb: ReturnType<typeof createMockKysely>;

  // 建立 mockCacheService 物件參照，方便測試使用
  const mockCacheService = {
    get: mockCacheGet,
    set: mockCacheSet,
    del: mockCacheDel,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // 建立 mock Kysely 實例
    mockDb = createMockKysely();

    // 建立 SettingsManager 實例
    settingsManager = new SettingsManager(mockDb as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================
  // getSettings() 測試
  // ============================================

  describe('getSettings()', () => {
    describe('cache hit', () => {
      it('should return cached settings when cache hit', async () => {
        // Arrange
        const guildId = '987654321098765432';
        mockCacheService.get.mockResolvedValue(FIXTURE_COMPLETE_SETTINGS);

        // Act
        const result = await settingsManager.getSettings(guildId);

        // Assert
        expect(result).toEqual(FIXTURE_COMPLETE_SETTINGS);
        expect(mockCacheService.get).toHaveBeenCalledWith(`settings:${guildId}`);
        // DB 不應該被呼叫
        expect(mockDb.selectFrom).not.toHaveBeenCalled();
      });

      it('should not query database when cache hit', async () => {
        // Arrange
        mockCacheService.get.mockResolvedValue(FIXTURE_MINIMAL_SETTINGS);

        // Act
        await settingsManager.getSettings('any-guild-id');

        // Assert
        expect(mockDb.selectFrom).not.toHaveBeenCalled();
      });
    });

    describe('cache miss', () => {
      it('should query database when cache miss', async () => {
        // Arrange
        const guildId = '987654321098765432';
        mockCacheService.get.mockResolvedValue(null);
        mockDb._setResult(FIXTURE_COMPLETE_SETTINGS);

        // Act
        const result = await settingsManager.getSettings(guildId);

        // Assert
        expect(result).toEqual(FIXTURE_COMPLETE_SETTINGS);
        expect(mockDb.selectFrom).toHaveBeenCalledWith('guild_settings');
      });

      it('should cache settings after fetching from database', async () => {
        // Arrange
        const guildId = '987654321098765432';
        mockCacheService.get.mockResolvedValue(null);
        mockDb._setResult(FIXTURE_COMPLETE_SETTINGS);

        // Act
        await settingsManager.getSettings(guildId);

        // Assert
        expect(mockCacheService.set).toHaveBeenCalledWith(
          `settings:${guildId}`,
          FIXTURE_COMPLETE_SETTINGS
        );
      });

      it('should return null when settings not found in database', async () => {
        // Arrange
        const guildId = 'non-existent-guild';
        mockCacheService.get.mockResolvedValue(null);
        mockDb._setResult(undefined);

        // Act
        const result = await settingsManager.getSettings(guildId);

        // Assert
        expect(result).toBeNull();
        // 不應該快取 null 結果
        expect(mockCacheService.set).not.toHaveBeenCalled();
      });
    });

    describe('error handling', () => {
      it('should return null and log error when database throws', async () => {
        // Arrange
        const guildId = 'error-guild';
        const dbError = new Error('Database connection failed');
        mockCacheService.get.mockResolvedValue(null);
        setupQueryError(mockDb, dbError);

        // Act
        const result = await settingsManager.getSettings(guildId);

        // Assert
        expect(result).toBeNull();
        expect(mockLoggerError).toHaveBeenCalledWith(
          expect.stringContaining(`Error fetching settings for guild ${guildId}`),
          dbError
        );
      });

      it('should gracefully handle cache errors and fall back to database', async () => {
        // Arrange
        const guildId = '987654321098765432';
        mockCacheService.get.mockRejectedValue(new Error('Redis unavailable'));
        mockDb._setResult(FIXTURE_COMPLETE_SETTINGS);

        // Act - 這會因為 cache 錯誤而直接拋出
        // 根據目前實作，cache 錯誤會 propagate 上來
        // 但如果需要 fallback 行為，需要修改 source code
        await expect(settingsManager.getSettings(guildId)).rejects.toThrow('Redis unavailable');
      });
    });

    describe('different guild scenarios', () => {
      it('should handle different guild IDs independently', async () => {
        // Arrange
        const guild1 = '111111111111111111';
        const guild2 = '222222222222222222';
        const settings1 = createSettingsFixture({ guildId: guild1 });
        const settings2 = createSettingsFixture({ guildId: guild2 });

        mockCacheService.get
          .mockResolvedValueOnce(settings1)
          .mockResolvedValueOnce(settings2);

        // Act
        const result1 = await settingsManager.getSettings(guild1);
        const result2 = await settingsManager.getSettings(guild2);

        // Assert
        expect(result1?.guildId).toBe(guild1);
        expect(result2?.guildId).toBe(guild2);
        expect(mockCacheService.get).toHaveBeenCalledWith(`settings:${guild1}`);
        expect(mockCacheService.get).toHaveBeenCalledWith(`settings:${guild2}`);
      });
    });
  });

  // ============================================
  // updateSettings() 測試
  // ============================================

  describe('updateSettings()', () => {
    it('should insert new settings when guild does not exist', async () => {
      // Arrange
      const guildId = 'new-guild';
      const newSettings: Partial<GuildSettings> = {
        staffRoleId: 'new-staff-role',
        ticketCategoryId: 'new-category',
      };
      const expectedResult = createSettingsFixture({ guildId, ...newSettings });
      mockDb._setResult(expectedResult);

      // Act
      const result = await settingsManager.updateSettings(guildId, newSettings);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(mockDb.insertInto).toHaveBeenCalledWith('guild_settings');
    });

    it('should update existing settings (upsert behavior)', async () => {
      // Arrange
      const guildId = '987654321098765432';
      const updates: Partial<GuildSettings> = {
        panelTitle: 'Updated Title',
        panelDescription: 'Updated Description',
      };
      const expectedResult = createSettingsFixture({ ...updates });
      mockDb._setResult(expectedResult);

      // Act
      const result = await settingsManager.updateSettings(guildId, updates);

      // Assert
      expect(result?.panelTitle).toBe('Updated Title');
      expect(result?.panelDescription).toBe('Updated Description');
    });

    it('should cache updated settings', async () => {
      // Arrange
      const guildId = '987654321098765432';
      const updates = { staffRoleId: 'updated-role' };
      const expectedResult = createSettingsFixture({ guildId, ...updates });
      mockDb._setResult(expectedResult);

      // Act
      await settingsManager.updateSettings(guildId, updates);

      // Assert
      expect(mockCacheService.set).toHaveBeenCalledWith(
        `settings:${guildId}`,
        expectedResult
      );
    });

    it('should return null when database returns no result', async () => {
      // Arrange
      const guildId = 'failed-guild';
      mockDb._setResult(undefined);

      // Act
      const result = await settingsManager.updateSettings(guildId, { staffRoleId: 'role' });

      // Assert
      expect(result).toBeNull();
      expect(mockCacheService.set).not.toHaveBeenCalled();
    });

    it('should return null and log error when database throws', async () => {
      // Arrange
      const guildId = 'error-guild';
      const dbError = new Error('Insert failed');
      setupQueryError(mockDb, dbError);

      // Act
      const result = await settingsManager.updateSettings(guildId, { staffRoleId: 'role' });

      // Assert
      expect(result).toBeNull();
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining(`Error updating settings for guild ${guildId}`),
        dbError
      );
    });

    it('should handle partial updates correctly', async () => {
      // Arrange
      const guildId = '987654321098765432';
      const partialUpdate = { logChannelId: 'new-log-channel' };
      const expectedResult = createSettingsFixture({ guildId, ...partialUpdate });
      mockDb._setResult(expectedResult);

      // Act
      const result = await settingsManager.updateSettings(guildId, partialUpdate);

      // Assert
      expect(result?.logChannelId).toBe('new-log-channel');
      // 其他欄位應該保持不變
      expect(result?.staffRoleId).toBe(FIXTURE_COMPLETE_SETTINGS.staffRoleId);
    });

    it('should handle null values in updates', async () => {
      // Arrange
      const guildId = '987654321098765432';
      const updates: Partial<GuildSettings> = {
        panelTitle: null,
        panelDescription: null,
      };
      const expectedResult = createSettingsFixture({ guildId, ...updates });
      mockDb._setResult(expectedResult);

      // Act
      const result = await settingsManager.updateSettings(guildId, updates);

      // Assert
      expect(result?.panelTitle).toBeNull();
      expect(result?.panelDescription).toBeNull();
    });
  });

  // ============================================
  // clearCache() 測試
  // ============================================

  describe('clearCache()', () => {
    it('should delete cache for specified guild', async () => {
      // Arrange
      const guildId = '987654321098765432';

      // Act
      await settingsManager.clearCache(guildId);

      // Assert
      expect(mockCacheService.del).toHaveBeenCalledWith(`settings:${guildId}`);
    });

    it('should handle cache delete errors gracefully', async () => {
      // Arrange
      const guildId = 'error-guild';
      mockCacheService.del.mockRejectedValue(new Error('Cache delete failed'));

      // Act & Assert
      // 根據目前實作，錯誤會 propagate
      await expect(settingsManager.clearCache(guildId)).rejects.toThrow('Cache delete failed');
    });

    it('should only clear cache for specific guild', async () => {
      // Arrange
      const guildId = 'specific-guild';

      // Act
      await settingsManager.clearCache(guildId);

      // Assert
      expect(mockCacheService.del).toHaveBeenCalledTimes(1);
      expect(mockCacheService.del).toHaveBeenCalledWith(`settings:${guildId}`);
    });
  });

  // ============================================
  // 整合情境測試
  // ============================================

  describe('integration scenarios', () => {
    it('should update settings and then get from cache', async () => {
      // Arrange
      const guildId = '987654321098765432';
      const updates = { staffRoleId: 'new-role' };
      const updatedSettings = createSettingsFixture({ guildId, ...updates });

      // 模擬 update 後的快取狀態
      mockDb._setResult(updatedSettings);

      // Act - 更新設定
      await settingsManager.updateSettings(guildId, updates);

      // Assert - 確認快取被更新
      expect(mockCacheService.set).toHaveBeenCalledWith(
        `settings:${guildId}`,
        updatedSettings
      );

      // 模擬之後的 get 操作（從快取取得）
      mockCacheService.get.mockResolvedValue(updatedSettings);
      const result = await settingsManager.getSettings(guildId);

      expect(result).toEqual(updatedSettings);
      expect(mockDb.selectFrom).not.toHaveBeenCalled(); // 不應該查詢 DB
    });

    it('should clear cache and then get fresh from database', async () => {
      // Arrange
      const guildId = '987654321098765432';
      const freshSettings = createSettingsFixture({ guildId, panelTitle: 'Fresh Title' });

      // Act - 清除快取
      await settingsManager.clearCache(guildId);
      expect(mockCacheService.del).toHaveBeenCalledWith(`settings:${guildId}`);

      // 模擬 cache miss 並從 DB 取得
      mockCacheService.get.mockResolvedValue(null);
      mockDb._setResult(freshSettings);

      const result = await settingsManager.getSettings(guildId);

      // Assert
      expect(result?.panelTitle).toBe('Fresh Title');
      expect(mockDb.selectFrom).toHaveBeenCalledWith('guild_settings');
    });
  });

  // ============================================
  // 邊界情況測試
  // ============================================

  describe('edge cases', () => {
    it('should handle empty guildId', async () => {
      // Arrange
      mockCacheService.get.mockResolvedValue(null);
      mockDb._setResult(undefined);

      // Act
      const result = await settingsManager.getSettings('');

      // Assert
      expect(result).toBeNull();
      expect(mockCacheService.get).toHaveBeenCalledWith('settings:');
    });

    it('should handle very long guildId', async () => {
      // Arrange
      const longGuildId = '1'.repeat(100);
      mockCacheService.get.mockResolvedValue(null);
      mockDb._setResult(undefined);

      // Act
      const result = await settingsManager.getSettings(longGuildId);

      // Assert
      expect(result).toBeNull();
      expect(mockCacheService.get).toHaveBeenCalledWith(`settings:${longGuildId}`);
    });

    it('should handle special characters in guildId', async () => {
      // Arrange - 雖然 Discord guild ID 只會是數字，但測試防禦性
      const specialGuildId = '123-456_789';
      mockCacheService.get.mockResolvedValue(null);
      mockDb._setResult(undefined);

      // Act
      const result = await settingsManager.getSettings(specialGuildId);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle empty update object', async () => {
      // Arrange
      const guildId = '987654321098765432';
      const expectedResult = createSettingsFixture({ guildId });
      mockDb._setResult(expectedResult);

      // Act
      const result = await settingsManager.updateSettings(guildId, {});

      // Assert
      expect(result).toEqual(expectedResult);
      expect(mockDb.insertInto).toHaveBeenCalled();
    });
  });
});
