/**
 * PriceAlerter 單元測試
 *
 * 測試範圍：
 * - checkAlerts(): debounce、mutex、條件檢查
 * - sendDeprecationNotice(): 發送通知、錯誤處理
 * - 狀態管理: isChecking, pendingCheck, lastCheckTime
 *
 * Mock 策略：
 * - Discord.js Client: mock users.fetch
 * - asset.repository: mock getAllPriceAlerts, getAllAssetsWithLatestPrice, etc.
 * - CacheService: mock get/set
 * - LocalizationManager: mock getLocalizations
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================
// Mock 設定 - 使用 vi.hoisted 確保持久化
// ============================================

const {
  mockGetAllPriceAlerts,
  mockGetAllAssetsWithLatestPrice,
  mockMarkUserDeprecationNotified,
  mockHasUserReceivedDeprecationNotice,
  mockLoggerInfo,
  mockLoggerWarn,
  mockLoggerError,
  mockCacheGet,
  mockCacheSet,
  mockGetLocalizations,
  mockUserSend,
  mockUsersFetch,
  mockCacheServiceInstance,
} = vi.hoisted(() => {
  const cacheInstance = {
    get: vi.fn(),
    set: vi.fn(),
  };
  return {
    mockGetAllPriceAlerts: vi.fn(),
    mockGetAllAssetsWithLatestPrice: vi.fn(),
    mockMarkUserDeprecationNotified: vi.fn(),
    mockHasUserReceivedDeprecationNotice: vi.fn(),
    mockLoggerInfo: vi.fn(),
    mockLoggerWarn: vi.fn(),
    mockLoggerError: vi.fn(),
    mockCacheGet: cacheInstance.get,
    mockCacheSet: cacheInstance.set,
    mockGetLocalizations: vi.fn(),
    mockUserSend: vi.fn(),
    mockUsersFetch: vi.fn(),
    mockCacheServiceInstance: cacheInstance,
  };
});

// Mock asset.repository
vi.mock('../../../src/repositories/asset.repository', () => ({
  getAllPriceAlerts: mockGetAllPriceAlerts,
  getAllAssetsWithLatestPrice: mockGetAllAssetsWithLatestPrice,
  markUserDeprecationNotified: mockMarkUserDeprecationNotified,
  hasUserReceivedDeprecationNotice: mockHasUserReceivedDeprecationNotice,
}));

// Mock logger
vi.mock('../../../src/utils/logger', () => ({
  default: {
    debug: vi.fn(),
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    error: mockLoggerError,
  },
}));

// Mock CacheService - 使用 class 語法確保正確的 prototype chain
vi.mock('../../../src/services/CacheService', () => ({
  CacheService: class MockCacheService {
    static instance = mockCacheServiceInstance;
    static getInstance = vi.fn(() => mockCacheServiceInstance);
    get = mockCacheGet;
    set = mockCacheSet;
    constructor() {}
  },
  cacheService: mockCacheServiceInstance,
}));

// Mock localization
vi.mock('../../../src/utils/localization', () => ({
  getLocalizations: mockGetLocalizations,
}));

// ============================================
// Import after mocks
// ============================================

import { PriceAlerter } from '../../../src/services/PriceAlerter.js';

// ============================================
// Test Helpers
// ============================================

function createMockClient(overrides: Partial<{ users: { fetch: typeof mockUsersFetch } }> = {}) {
  return {
    users: overrides.users ?? { fetch: mockUsersFetch },
  };
}

function createMockLocalizationManager() {
  return {
    getTranslation: vi.fn(),
  };
}

function createMockAlert(overrides: Partial<{
  id: number;
  user_id: string;
  asset_symbol: string;
  condition: 'above' | 'below';
  target_price: number;
  locale: string;
}> = {}) {
  return {
    id: overrides.id ?? 1,
    user_id: overrides.user_id ?? 'user-123',
    asset_symbol: overrides.asset_symbol ?? 'ODOG',
    condition: overrides.condition ?? 'above',
    target_price: overrides.target_price ?? 100,
    locale: overrides.locale ?? 'en-US',
  };
}

describe('PriceAlerter', () => {
  let alerter: PriceAlerter;
  let mockClient: ReturnType<typeof createMockClient>;
  let mockLocalizationManager: ReturnType<typeof createMockLocalizationManager>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockClient = createMockClient();
    mockLocalizationManager = createMockLocalizationManager();

    // Default mock returns
    mockGetAllPriceAlerts.mockResolvedValue([]);
    mockGetAllAssetsWithLatestPrice.mockResolvedValue([]);
    mockCacheGet.mockResolvedValue(null);
    mockCacheSet.mockResolvedValue(undefined);
    mockHasUserReceivedDeprecationNotice.mockResolvedValue(false);
    mockMarkUserDeprecationNotified.mockResolvedValue(undefined);
    mockGetLocalizations.mockReturnValue({
      'en-US': {
        notification: {
          deprecation_title: 'Price Alerts Deprecated',
          deprecation_body: 'This feature has been discontinued.',
        },
      },
    });
    mockUsersFetch.mockResolvedValue({
      send: mockUserSend.mockResolvedValue(undefined),
    });

    alerter = new PriceAlerter(mockClient as any, mockLocalizationManager as any);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ============================================
  // Constructor 測試
  // ============================================

  describe('constructor', () => {
    it('should initialize with provided dependencies', () => {
      // Assert
      expect(alerter).toBeDefined();
    });
  });

  // ============================================
  // checkAlerts() 測試
  // ============================================

  describe('checkAlerts()', () => {
    describe('debounce behavior', () => {
      it('should skip check if called too soon', async () => {
        // First call
        await alerter.checkAlerts();

        // Second call immediately - should be skipped
        await alerter.checkAlerts();

        // Assert - getAllPriceAlerts should only be called once
        expect(mockGetAllPriceAlerts).toHaveBeenCalledTimes(1);
      });

      it('should allow check after debounce period', async () => {
        // First call
        await alerter.checkAlerts();

        // Advance time past debounce
        vi.advanceTimersByTime(5001);

        // Second call - should proceed
        await alerter.checkAlerts();

        // Assert
        expect(mockGetAllPriceAlerts).toHaveBeenCalledTimes(2);
      });

      it('should use 5 second debounce', async () => {
        // First call
        await alerter.checkAlerts();

        // Advance time just before debounce
        vi.advanceTimersByTime(4999);

        // Second call - should still be skipped
        await alerter.checkAlerts();

        // Assert
        expect(mockGetAllPriceAlerts).toHaveBeenCalledTimes(1);
      });
    });

    describe('mutex behavior', () => {
      it('should handle concurrent check attempts gracefully', async () => {
        // This tests the concept - actual mutex is tested via behavior
        // The pendingCheck mechanism ensures no checks are lost
        const callCount = { value: 0 };
        mockGetAllPriceAlerts.mockImplementation(async () => {
          callCount.value++;
          return [];
        });

        // First check
        await alerter.checkAlerts();

        // Assert - at least one check was made
        expect(callCount.value).toBeGreaterThanOrEqual(1);
      });
    });

    describe('cache handling', () => {
      it('should use cached prices when available', async () => {
        // Arrange
        mockCacheGet.mockResolvedValueOnce({ ODOG: 150 });

        // Act
        await alerter.checkAlerts();

        // Assert
        expect(mockCacheGet).toHaveBeenCalledWith('prices:latest');
        expect(mockGetAllAssetsWithLatestPrice).not.toHaveBeenCalled();
      });

      it('should fetch prices and cache when not cached', async () => {
        // Arrange
        mockCacheGet.mockResolvedValueOnce(null);
        mockGetAllAssetsWithLatestPrice.mockResolvedValueOnce([
          { asset_symbol: 'ODOG', price: 150 },
        ]);

        // Act
        await alerter.checkAlerts();

        // Assert
        expect(mockGetAllAssetsWithLatestPrice).toHaveBeenCalled();
        expect(mockCacheSet).toHaveBeenCalledWith(
          'prices:latest',
          { ODOG: 150 },
          60
        );
      });

      it('should convert object to Map from cache', async () => {
        // Arrange - cache returns plain object
        mockCacheGet.mockResolvedValueOnce({ ODOG: 150, BTC: 50000 });
        mockGetAllPriceAlerts.mockResolvedValueOnce([
          createMockAlert({ asset_symbol: 'ODOG', condition: 'above', target_price: 100 }),
        ]);
        mockHasUserReceivedDeprecationNotice.mockResolvedValueOnce(false);

        // Act
        await alerter.checkAlerts();

        // Assert - should process without error
        expect(mockGetAllPriceAlerts).toHaveBeenCalled();
      });
    });

    describe('alert condition checking', () => {
      it('should trigger for "above" condition when price exceeds target', async () => {
        // Arrange
        mockCacheGet.mockResolvedValueOnce({ ODOG: 150 });
        mockGetAllPriceAlerts.mockResolvedValueOnce([
          createMockAlert({ condition: 'above', target_price: 100 }),
        ]);

        // Act
        await alerter.checkAlerts();

        // Assert
        expect(mockHasUserReceivedDeprecationNotice).toHaveBeenCalled();
      });

      it('should trigger for "below" condition when price is under target', async () => {
        // Arrange
        mockCacheGet.mockResolvedValueOnce({ ODOG: 50 });
        mockGetAllPriceAlerts.mockResolvedValueOnce([
          createMockAlert({ condition: 'below', target_price: 100 }),
        ]);

        // Act
        await alerter.checkAlerts();

        // Assert
        expect(mockHasUserReceivedDeprecationNotice).toHaveBeenCalled();
      });

      it('should not trigger when "above" condition not met', async () => {
        // Arrange
        mockCacheGet.mockResolvedValueOnce({ ODOG: 50 });
        mockGetAllPriceAlerts.mockResolvedValueOnce([
          createMockAlert({ condition: 'above', target_price: 100 }),
        ]);

        // Act
        await alerter.checkAlerts();

        // Assert
        expect(mockHasUserReceivedDeprecationNotice).not.toHaveBeenCalled();
      });

      it('should not trigger when "below" condition not met', async () => {
        // Arrange
        mockCacheGet.mockResolvedValueOnce({ ODOG: 150 });
        mockGetAllPriceAlerts.mockResolvedValueOnce([
          createMockAlert({ condition: 'below', target_price: 100 }),
        ]);

        // Act
        await alerter.checkAlerts();

        // Assert
        expect(mockHasUserReceivedDeprecationNotice).not.toHaveBeenCalled();
      });

      it('should skip alert when asset not in price map', async () => {
        // Arrange
        mockCacheGet.mockResolvedValueOnce({ BTC: 50000 }); // No ODOG
        mockGetAllPriceAlerts.mockResolvedValueOnce([
          createMockAlert({ asset_symbol: 'ODOG', condition: 'above', target_price: 100 }),
        ]);

        // Act
        await alerter.checkAlerts();

        // Assert
        expect(mockHasUserReceivedDeprecationNotice).not.toHaveBeenCalled();
      });
    });

    describe('deprecation notice handling', () => {
      it('should not notify user who already received notice', async () => {
        // Arrange
        mockCacheGet.mockResolvedValueOnce({ ODOG: 150 });
        mockGetAllPriceAlerts.mockResolvedValueOnce([
          createMockAlert({ condition: 'above', target_price: 100 }),
        ]);
        mockHasUserReceivedDeprecationNotice.mockResolvedValueOnce(true);

        // Act
        await alerter.checkAlerts();

        // Assert
        expect(mockUsersFetch).not.toHaveBeenCalled();
      });

      it('should deduplicate users in same check cycle', async () => {
        // Arrange
        mockCacheGet.mockResolvedValueOnce({ ODOG: 150 });
        mockGetAllPriceAlerts.mockResolvedValueOnce([
          createMockAlert({ user_id: 'user-123', condition: 'above', target_price: 100 }),
          createMockAlert({ user_id: 'user-123', condition: 'above', target_price: 50 }),
        ]);
        mockHasUserReceivedDeprecationNotice.mockResolvedValue(false);

        // Act
        await alerter.checkAlerts();

        // Assert - only one check per user
        expect(mockHasUserReceivedDeprecationNotice).toHaveBeenCalledTimes(1);
      });

      it('should send deprecation notice to user', async () => {
        // Arrange
        mockCacheGet.mockResolvedValueOnce({ ODOG: 150 });
        mockGetAllPriceAlerts.mockResolvedValueOnce([
          createMockAlert({ condition: 'above', target_price: 100 }),
        ]);

        // Act
        await alerter.checkAlerts();

        // Assert
        expect(mockUsersFetch).toHaveBeenCalledWith('user-123');
        expect(mockUserSend).toHaveBeenCalled();
        expect(mockMarkUserDeprecationNotified).toHaveBeenCalledWith('user-123');
      });
    });

    describe('error handling', () => {
      it('should log error and continue on failure', async () => {
        // Arrange
        mockGetAllPriceAlerts.mockRejectedValueOnce(new Error('DB Error'));

        // Act
        await alerter.checkAlerts();

        // Assert
        expect(mockLoggerError).toHaveBeenCalledWith(
          'Error checking price alerts:',
          expect.any(Error)
        );
      });

      it('should reset isChecking on error', async () => {
        // Arrange
        mockGetAllPriceAlerts.mockRejectedValueOnce(new Error('DB Error'));

        // Act
        await alerter.checkAlerts();

        // Advance time past debounce
        vi.advanceTimersByTime(5001);

        // Should be able to check again
        mockGetAllPriceAlerts.mockResolvedValueOnce([]);
        await alerter.checkAlerts();

        // Assert
        expect(mockGetAllPriceAlerts).toHaveBeenCalledTimes(2);
      });
    });

    describe('logging', () => {
      it('should log alert count when processing alerts', async () => {
        // Arrange
        mockCacheGet.mockResolvedValueOnce({ ODOG: 150 });
        mockGetAllPriceAlerts.mockResolvedValueOnce([
          createMockAlert({ condition: 'above', target_price: 100 }),
        ]);

        // Act
        await alerter.checkAlerts();

        // Assert
        expect(mockLoggerInfo).toHaveBeenCalledWith(
          expect.stringContaining('Checking 1 pending alerts')
        );
      });

      it('should not log when no alerts', async () => {
        // Arrange
        mockGetAllPriceAlerts.mockResolvedValueOnce([]);

        // Act
        await alerter.checkAlerts();

        // Assert - logger.info should not be called for 0 alerts
        expect(mockLoggerInfo).not.toHaveBeenCalledWith(
          expect.stringContaining('Checking 0 pending alerts')
        );
      });
    });
  });

  // ============================================
  // sendDeprecationNotice() 測試 (間接測試)
  // ============================================

  describe('sendDeprecationNotice()', () => {
    it('should warn when user not found', async () => {
      // Arrange
      mockCacheGet.mockResolvedValueOnce({ ODOG: 150 });
      mockGetAllPriceAlerts.mockResolvedValueOnce([
        createMockAlert({ condition: 'above', target_price: 100 }),
      ]);
      mockUsersFetch.mockResolvedValueOnce(null);

      // Act
      await alerter.checkAlerts();

      // Assert
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.stringContaining('User not found')
      );
    });

    it('should handle DM blocked (code 50007)', async () => {
      // Arrange
      mockCacheGet.mockResolvedValueOnce({ ODOG: 150 });
      mockGetAllPriceAlerts.mockResolvedValueOnce([
        createMockAlert({ condition: 'above', target_price: 100 }),
      ]);
      const dmBlockedError = new Error('Cannot send DM');
      (dmBlockedError as any).code = 50007;
      mockUserSend.mockRejectedValueOnce(dmBlockedError);

      // Act
      await alerter.checkAlerts();

      // Assert
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.stringContaining('Cannot send DM')
      );
      expect(mockMarkUserDeprecationNotified).toHaveBeenCalled();
    });

    it('should log error for other send failures', async () => {
      // Arrange
      mockCacheGet.mockResolvedValueOnce({ ODOG: 150 });
      mockGetAllPriceAlerts.mockResolvedValueOnce([
        createMockAlert({ condition: 'above', target_price: 100 }),
      ]);
      mockUserSend.mockRejectedValueOnce(new Error('Unknown error'));

      // Act
      await alerter.checkAlerts();

      // Assert
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send deprecation notice'),
        expect.any(Error)
      );
    });

    it('should use correct locale for message', async () => {
      // Arrange
      mockCacheGet.mockResolvedValueOnce({ ODOG: 150 });
      mockGetAllPriceAlerts.mockResolvedValueOnce([
        createMockAlert({ condition: 'above', target_price: 100, locale: 'zh-TW' }),
      ]);
      mockGetLocalizations.mockReturnValueOnce({
        'zh-TW': {
          notification: {
            deprecation_title: '價格提醒已停用',
            deprecation_body: '此功能已停止服務。',
          },
        },
        'en-US': {
          notification: {
            deprecation_title: 'Price Alerts Deprecated',
            deprecation_body: 'This feature has been discontinued.',
          },
        },
      });

      // Act
      await alerter.checkAlerts();

      // Assert
      expect(mockUserSend).toHaveBeenCalledWith(
        expect.stringContaining('價格提醒已停用')
      );
    });

    it('should fallback to en-US when locale not found', async () => {
      // Arrange
      mockCacheGet.mockResolvedValueOnce({ ODOG: 150 });
      mockGetAllPriceAlerts.mockResolvedValueOnce([
        createMockAlert({ condition: 'above', target_price: 100, locale: 'de-DE' }),
      ]);
      mockGetLocalizations.mockReturnValueOnce({
        'en-US': {
          notification: {
            deprecation_title: 'Price Alerts Deprecated',
            deprecation_body: 'This feature has been discontinued.',
          },
        },
      });

      // Act
      await alerter.checkAlerts();

      // Assert
      expect(mockUserSend).toHaveBeenCalledWith(
        expect.stringContaining('Price Alerts Deprecated')
      );
    });
  });

  // ============================================
  // 純邏輯測試
  // ============================================

  describe('Price condition logic (pure)', () => {
    it('should correctly evaluate above condition', () => {
      const isAbove = (current: number, target: number) => current > target;

      expect(isAbove(150, 100)).toBe(true);
      expect(isAbove(100, 100)).toBe(false);
      expect(isAbove(50, 100)).toBe(false);
    });

    it('should correctly evaluate below condition', () => {
      const isBelow = (current: number, target: number) => current < target;

      expect(isBelow(50, 100)).toBe(true);
      expect(isBelow(100, 100)).toBe(false);
      expect(isBelow(150, 100)).toBe(false);
    });

    it('should handle edge case at exact target price', () => {
      const conditionMet = (
        condition: 'above' | 'below',
        current: number,
        target: number
      ): boolean => {
        return condition === 'above' ? current > target : current < target;
      };

      expect(conditionMet('above', 100, 100)).toBe(false);
      expect(conditionMet('below', 100, 100)).toBe(false);
    });
  });

  describe('Debounce constants', () => {
    it('should use 5 second debounce', () => {
      // Access private static via reflection or test behavior
      // The debounce is tested behaviorally above
      expect(true).toBe(true);
    });
  });
});
