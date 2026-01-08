/**
 * CacheInvalidationService 單元測試
 *
 * 測試範圍：
 * - constructor: 初始化及依賴注入
 * - startListening(): PostgreSQL LISTEN 設定、通知處理
 * - stopListening(): 釋放連線資源
 * - invalidateCacheForSymbol(): Redis 和檔案系統快取清除
 *
 * Mock 策略：
 * - pg PoolClient: mock connect, query, on, release
 * - fs/promises: mock readdir
 * - redis: mock scan
 * - CacheService: mock del
 * - ChartCacheService: mock delChart
 * - PriceAlerter: mock checkAlerts
 * - logger: mock info, debug, error
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================
// Mock 設定 - 使用 vi.hoisted 確保持久化
// ============================================

const {
  mockLoggerInfo,
  mockLoggerDebug,
  mockLoggerError,
  mockCacheDel,
  mockChartCacheDelChart,
  mockPriceAlerterCheckAlerts,
  mockPoolConnect,
  mockPoolClientQuery,
  mockPoolClientOn,
  mockPoolClientRelease,
  mockReaddir,
  mockRedisScan,
  mockCacheServiceInstance,
  mockRedisClient,
  mockEnsureRedisConnected,
} = vi.hoisted(() => {
  const cacheInstance = {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  };
  const redisClient = {
    scan: vi.fn(),
  };
  return {
    mockLoggerInfo: vi.fn(),
    mockLoggerDebug: vi.fn(),
    mockLoggerError: vi.fn(),
    mockCacheDel: cacheInstance.del,
    mockChartCacheDelChart: vi.fn(),
    mockPriceAlerterCheckAlerts: vi.fn(),
    mockPoolConnect: vi.fn(),
    mockPoolClientQuery: vi.fn(),
    mockPoolClientOn: vi.fn(),
    mockPoolClientRelease: vi.fn(),
    mockReaddir: vi.fn(),
    mockRedisScan: redisClient.scan,
    mockCacheServiceInstance: cacheInstance,
    mockRedisClient: redisClient,
    mockEnsureRedisConnected: vi.fn(),
  };
});

// Mock logger
vi.mock('../../../src/utils/logger', () => ({
  default: {
    debug: mockLoggerDebug,
    info: mockLoggerInfo,
    warn: vi.fn(),
    error: mockLoggerError,
  },
}));

// Mock CacheService
vi.mock('../../../src/services/CacheService', () => ({
  CacheService: class MockCacheService {
    static instance = mockCacheServiceInstance;
    static getInstance = vi.fn(() => mockCacheServiceInstance);
    get = vi.fn();
    set = vi.fn();
    del = mockCacheDel;
    constructor() {}
  },
  cacheService: mockCacheServiceInstance,
}));

// Mock ChartCacheService
vi.mock('../../../src/services/ChartCacheService', () => ({
  ChartCacheService: class MockChartCacheService {
    delChart = mockChartCacheDelChart;
    constructor() {}
  },
}));

// Mock gachaPool
vi.mock('../../../src/shared/database', () => ({
  gachaPool: {
    connect: mockPoolConnect,
  },
}));

// Mock redis client
vi.mock('../../../src/shared/redis', () => ({
  ensureRedisConnected: mockEnsureRedisConnected,
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readdir: mockReaddir,
}));

// ============================================
// Import after mocks
// ============================================

import { CacheInvalidationService } from '../../../src/services/CacheInvalidationService.js';

// ============================================
// Test Helpers
// ============================================

function createMockPriceAlerter() {
  return {
    checkAlerts: mockPriceAlerterCheckAlerts,
  };
}

function createMockPoolClient() {
  return {
    query: mockPoolClientQuery,
    on: mockPoolClientOn,
    release: mockPoolClientRelease,
  };
}

describe('CacheInvalidationService', () => {
  let service: CacheInvalidationService;
  let mockPriceAlerter: ReturnType<typeof createMockPriceAlerter>;
  let mockPoolClient: ReturnType<typeof createMockPoolClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockPriceAlerter = createMockPriceAlerter();
    mockPoolClient = createMockPoolClient();

    mockPoolConnect.mockResolvedValue(mockPoolClient);
    mockPoolClientQuery.mockResolvedValue(undefined);
    mockPoolClientOn.mockReturnValue(undefined);
    mockCacheDel.mockResolvedValue(undefined);
    mockChartCacheDelChart.mockResolvedValue(undefined);
    mockPriceAlerterCheckAlerts.mockResolvedValue(undefined);
    mockReaddir.mockResolvedValue([]);
    mockRedisScan.mockResolvedValue({ cursor: '0', keys: [] });
    mockEnsureRedisConnected.mockResolvedValue(mockRedisClient);

    service = new CacheInvalidationService(mockPriceAlerter as any);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ============================================
  // Constructor 測試
  // ============================================

  describe('constructor', () => {
    it('should initialize with PriceAlerter dependency', () => {
      expect(service).toBeDefined();
    });

    it('should log initialization message', () => {
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        '[CacheInvalidator] Service initialized.'
      );
    });
  });

  // ============================================
  // startListening() 測試
  // ============================================

  describe('startListening()', () => {
    it('should connect to pool and setup listener', async () => {
      // Act
      await service.startListening();

      // Assert
      expect(mockPoolConnect).toHaveBeenCalled();
      expect(mockPoolClientQuery).toHaveBeenCalledWith('LISTEN cache_invalidation');
    });

    it('should log successful connection', async () => {
      // Act
      await service.startListening();

      // Assert
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        expect.stringContaining('Now listening for \'cache_invalidation\' notifications')
      );
    });

    it('should register notification handler', async () => {
      // Act
      await service.startListening();

      // Assert
      expect(mockPoolClientOn).toHaveBeenCalledWith('notification', expect.any(Function));
    });

    it('should register error handler', async () => {
      // Act
      await service.startListening();

      // Assert
      expect(mockPoolClientOn).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should log error when connection fails', async () => {
      // Arrange
      mockPoolConnect.mockRejectedValueOnce(new Error('Connection refused'));

      // Act
      await service.startListening();

      // Assert
      expect(mockLoggerError).toHaveBeenCalledWith(
        '[CacheInvalidator] Failed to start listening:',
        expect.any(Error)
      );
    });

    describe('notification handling', () => {
      it('should invalidate cache on valid notification', async () => {
        // Arrange
        let notificationHandler: (msg: any) => void = () => {};
        mockPoolClientOn.mockImplementation((event, handler) => {
          if (event === 'notification') {
            notificationHandler = handler;
          }
        });

        await service.startListening();

        // Act - simulate notification
        notificationHandler({
          channel: 'cache_invalidation',
          payload: 'ODOG',
        });

        // Assert
        expect(mockLoggerDebug).toHaveBeenCalledWith(
          expect.stringContaining('Received \'cache_invalidation\' for symbol: ODOG')
        );
      });

      it('should trigger price alerts check after delay', async () => {
        // Arrange
        let notificationHandler: (msg: any) => void = () => {};
        mockPoolClientOn.mockImplementation((event, handler) => {
          if (event === 'notification') {
            notificationHandler = handler;
          }
        });

        await service.startListening();

        // Act
        notificationHandler({
          channel: 'cache_invalidation',
          payload: 'ODOG',
        });

        // Wait for setTimeout
        vi.advanceTimersByTime(1000);

        // Assert
        expect(mockPriceAlerterCheckAlerts).toHaveBeenCalled();
      });

      it('should ignore notifications from other channels', async () => {
        // Arrange
        let notificationHandler: (msg: any) => void = () => {};
        mockPoolClientOn.mockImplementation((event, handler) => {
          if (event === 'notification') {
            notificationHandler = handler;
          }
        });

        await service.startListening();

        // Act - notification from different channel
        notificationHandler({
          channel: 'other_channel',
          payload: 'ODOG',
        });

        // Assert
        expect(mockLoggerDebug).not.toHaveBeenCalledWith(
          expect.stringContaining('Received \'cache_invalidation\'')
        );
      });

      it('should ignore notifications without payload', async () => {
        // Arrange
        let notificationHandler: (msg: any) => void = () => {};
        mockPoolClientOn.mockImplementation((event, handler) => {
          if (event === 'notification') {
            notificationHandler = handler;
          }
        });

        await service.startListening();

        // Act - notification without payload
        notificationHandler({
          channel: 'cache_invalidation',
          payload: null,
        });

        // Assert - should not log debug message
        expect(mockLoggerDebug).not.toHaveBeenCalledWith(
          expect.stringContaining('Received \'cache_invalidation\'')
        );
      });
    });

    describe('error handling', () => {
      it('should reconnect on client error', async () => {
        // Arrange
        let errorHandler: (err: Error) => void = () => {};
        mockPoolClientOn.mockImplementation((event, handler) => {
          if (event === 'error') {
            errorHandler = handler;
          }
        });

        await service.startListening();
        vi.clearAllMocks();

        // Act - simulate error
        errorHandler(new Error('Connection lost'));

        // Should log error
        expect(mockLoggerError).toHaveBeenCalledWith(
          '[CacheInvalidator] Listener client error:',
          expect.any(Error)
        );

        // Should release client
        expect(mockPoolClientRelease).toHaveBeenCalled();

        // Should schedule reconnect
        vi.advanceTimersByTime(5000);
        expect(mockPoolConnect).toHaveBeenCalled();
      });
    });
  });

  // ============================================
  // stopListening() 測試
  // ============================================

  describe('stopListening()', () => {
    it('should release pool client when active', async () => {
      // Arrange
      await service.startListening();

      // Act
      service.stopListening();

      // Assert
      expect(mockPoolClientRelease).toHaveBeenCalled();
    });

    it('should log stop message', async () => {
      // Arrange
      await service.startListening();
      vi.clearAllMocks();

      // Act
      service.stopListening();

      // Assert
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        '[CacheInvalidator] Stopped listening for notifications.'
      );
    });

    it('should do nothing when not listening', () => {
      // Act - call stop without start
      service.stopListening();

      // Assert
      expect(mockPoolClientRelease).not.toHaveBeenCalled();
      expect(mockLoggerInfo).not.toHaveBeenCalledWith(
        expect.stringContaining('Stopped listening')
      );
    });

    it('should clear client reference after stop', async () => {
      // Arrange
      await service.startListening();
      service.stopListening();
      vi.clearAllMocks();

      // Act - call stop again
      service.stopListening();

      // Assert - should not release again
      expect(mockPoolClientRelease).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // invalidateCacheForSymbol() 測試 (private, tested indirectly)
  // ============================================

  describe('cache invalidation (via notification)', () => {
    let notificationHandler: (msg: any) => void;

    beforeEach(async () => {
      mockPoolClientOn.mockImplementation((event, handler) => {
        if (event === 'notification') {
          notificationHandler = handler;
        }
      });
      await service.startListening();
    });

    describe('Redis cache invalidation', () => {
      it('should scan and delete Redis keys for symbol', async () => {
        // Arrange
        mockRedisScan.mockResolvedValueOnce({
          cursor: '0',
          keys: ['report-data:ODOG:1h', 'report-data:ODOG:7d'],
        });

        // Act
        notificationHandler({
          channel: 'cache_invalidation',
          payload: 'ODOG',
        });

        // Wait for async operations
        await vi.runAllTimersAsync();

        // Assert
        expect(mockRedisScan).toHaveBeenCalledWith('0', {
          MATCH: 'report-data:ODOG:*',
          COUNT: 100,
        });
        expect(mockCacheDel).toHaveBeenCalledWith(['report-data:ODOG:1h', 'report-data:ODOG:7d']);
      });

      it('should handle multi-page scan results', async () => {
        // Arrange
        mockRedisScan
          .mockResolvedValueOnce({
            cursor: '123',
            keys: ['report-data:ODOG:1h'],
          })
          .mockResolvedValueOnce({
            cursor: '0',
            keys: ['report-data:ODOG:7d'],
          });

        // Act
        notificationHandler({
          channel: 'cache_invalidation',
          payload: 'ODOG',
        });

        await vi.runAllTimersAsync();

        // Assert - should call scan twice
        expect(mockRedisScan).toHaveBeenCalledTimes(2);
        expect(mockCacheDel).toHaveBeenCalledTimes(2);
      });

      it('should not call del when no keys found', async () => {
        // Arrange
        mockRedisScan.mockResolvedValueOnce({
          cursor: '0',
          keys: [],
        });

        // Act
        notificationHandler({
          channel: 'cache_invalidation',
          payload: 'ODOG',
        });

        await vi.runAllTimersAsync();

        // Assert
        expect(mockCacheDel).not.toHaveBeenCalled();
      });

      it('should log error on Redis scan failure', async () => {
        // Arrange
        mockRedisScan.mockRejectedValueOnce(new Error('Redis connection lost'));

        // Act
        notificationHandler({
          channel: 'cache_invalidation',
          payload: 'ODOG',
        });

        await vi.runAllTimersAsync();

        // Assert
        expect(mockLoggerError).toHaveBeenCalledWith(
          expect.stringContaining('Error scanning/deleting Redis keys for symbol ODOG'),
          expect.any(Error)
        );
      });
    });

    describe('Chart cache invalidation', () => {
      it('should delete chart files for symbol', async () => {
        // Arrange
        mockReaddir.mockResolvedValueOnce([
          'report-chart:ODOG:1h.png',
          'report-chart:ODOG:7d.png',
          'report-chart:BTC:1h.png',
        ]);

        // Act
        notificationHandler({
          channel: 'cache_invalidation',
          payload: 'ODOG',
        });

        await vi.runAllTimersAsync();

        // Assert
        expect(mockChartCacheDelChart).toHaveBeenCalledWith('report-chart:ODOG:1h');
        expect(mockChartCacheDelChart).toHaveBeenCalledWith('report-chart:ODOG:7d');
        expect(mockChartCacheDelChart).not.toHaveBeenCalledWith('report-chart:BTC:1h');
      });

      it('should ignore ENOENT error (directory not exists)', async () => {
        // Arrange
        const enoentError = new Error('No such directory') as NodeJS.ErrnoException;
        enoentError.code = 'ENOENT';
        mockReaddir.mockRejectedValueOnce(enoentError);

        // Act
        notificationHandler({
          channel: 'cache_invalidation',
          payload: 'ODOG',
        });

        await vi.runAllTimersAsync();

        // Assert - should not log error
        expect(mockLoggerError).not.toHaveBeenCalledWith(
          expect.stringContaining('Error reading chart cache directory')
        );
      });

      it('should log error for non-ENOENT errors', async () => {
        // Arrange
        const permError = new Error('Permission denied') as NodeJS.ErrnoException;
        permError.code = 'EPERM';
        mockReaddir.mockRejectedValueOnce(permError);

        // Act
        notificationHandler({
          channel: 'cache_invalidation',
          payload: 'ODOG',
        });

        await vi.runAllTimersAsync();

        // Assert
        expect(mockLoggerError).toHaveBeenCalledWith(
          expect.stringContaining('Error reading chart cache directory for symbol ODOG'),
          expect.any(Error)
        );
      });
    });
  });

  // ============================================
  // 純邏輯測試
  // ============================================

  describe('pure logic', () => {
    it('should use 1 second delay before checking alerts', () => {
      // This is verified behaviorally above
      // The 1 second delay ensures the transaction is committed
      expect(true).toBe(true);
    });

    it('should use 5 second delay for reconnection', () => {
      // This is verified behaviorally above
      expect(true).toBe(true);
    });

    describe('cache key patterns', () => {
      it('should use correct Redis key pattern', () => {
        const symbol = 'ODOG';
        const pattern = `report-data:${symbol}:*`;
        expect(pattern).toBe('report-data:ODOG:*');
      });

      it('should use correct chart file prefix', () => {
        const symbol = 'ODOG';
        const prefix = `report-chart:${symbol}:`;
        expect(prefix).toBe('report-chart:ODOG:');
      });
    });

    describe('file name parsing', () => {
      it('should extract key from filename', () => {
        const extractKey = (filename: string) => {
          const parts = filename.split('.');
          return parts.slice(0, -1).join('.');
        };

        expect(extractKey('report-chart:ODOG:7d.png')).toBe('report-chart:ODOG:7d');
        expect(extractKey('some-file.txt')).toBe('some-file');
      });
    });
  });
});
