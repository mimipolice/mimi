/**
 * CacheService 單元測試
 *
 * 測試範圍：
 * - get<T>(): 快取讀取，包含命中、未命中、解析錯誤
 * - set<T>(): 快取寫入，包含預設 TTL 和自訂 TTL
 * - del(): 刪除單一或多個 key
 * - flushAll(): 清除所有快取
 * - Redis 不可用時的行為
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================
// Mock 設定 - 必須在 import 之前
// ============================================

// Mock Redis 客戶端 - 使用工廠函數避免提升問題
vi.mock('../../../src/shared/redis.js', () => ({
  default: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    flushDb: vi.fn(),
  },
  isRedisConnected: vi.fn(() => true),
}));

// Mock Logger
vi.mock('../../../src/utils/logger.js', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// 現在可以安全地 import
import { CacheService } from '../../../src/services/CacheService.js';
import redisClient from '../../../src/shared/redis.js';
import logger from '../../../src/utils/logger.js';

// 取得 mocked 版本以便在測試中使用
const mockRedis = vi.mocked(redisClient);
const mockLogger = vi.mocked(logger);

describe('CacheService', () => {
  let cacheService: CacheService;

  beforeEach(() => {
    cacheService = new CacheService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================
  // get<T>() 測試
  // ============================================

  describe('get<T>()', () => {
    it('should return parsed JSON when cache hit', async () => {
      // Arrange
      const testData = { name: 'Test', value: 42 };
      mockRedis!.get.mockResolvedValue(JSON.stringify(testData));

      // Act
      const result = await cacheService.get<typeof testData>('test-key');

      // Assert
      expect(result).toEqual(testData);
      expect(mockRedis!.get).toHaveBeenCalledWith('test-key');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('HIT')
      );
    });

    it('should return null when cache miss', async () => {
      // Arrange
      mockRedis!.get.mockResolvedValue(null);

      // Act
      const result = await cacheService.get<{ name: string }>('non-existent');

      // Assert
      expect(result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('MISS')
      );
    });

    it('should return null and log error when JSON parse fails', async () => {
      // Arrange
      mockRedis!.get.mockResolvedValue('invalid-json{{{');

      // Act
      const result = await cacheService.get<{ name: string }>('bad-json-key');

      // Assert
      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error GET'),
        expect.any(Error)
      );
    });

    it('should return null and log error when Redis throws', async () => {
      // Arrange
      const redisError = new Error('Connection refused');
      mockRedis!.get.mockRejectedValue(redisError);

      // Act
      const result = await cacheService.get<{ name: string }>('error-key');

      // Assert
      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error GET'),
        redisError
      );
    });

    it('should handle complex nested objects', async () => {
      // Arrange
      const complexData = {
        user: { id: '123', name: 'Test' },
        roles: ['admin', 'user'],
        settings: { theme: 'dark', notifications: true },
      };
      mockRedis!.get.mockResolvedValue(JSON.stringify(complexData));

      // Act
      const result = await cacheService.get<typeof complexData>('complex-key');

      // Assert
      expect(result).toEqual(complexData);
    });

    it('should handle array data', async () => {
      // Arrange
      const arrayData = [1, 2, 3, 4, 5];
      mockRedis!.get.mockResolvedValue(JSON.stringify(arrayData));

      // Act
      const result = await cacheService.get<number[]>('array-key');

      // Assert
      expect(result).toEqual(arrayData);
    });

    it('should handle primitive types', async () => {
      // Arrange
      mockRedis!.get.mockResolvedValue(JSON.stringify('simple string'));

      // Act
      const result = await cacheService.get<string>('string-key');

      // Assert
      expect(result).toBe('simple string');
    });
  });

  // ============================================
  // set<T>() 測試
  // ============================================

  describe('set<T>()', () => {
    it('should serialize and store data with default TTL', async () => {
      // Arrange
      const testData = { name: 'Test' };
      mockRedis!.set.mockResolvedValue('OK');

      // Act
      await cacheService.set('test-key', testData);

      // Assert
      expect(mockRedis!.set).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify(testData),
        { EX: 3600 } // 預設 1 小時
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('SET')
      );
    });

    it('should use custom TTL when provided', async () => {
      // Arrange
      const testData = { temporary: true };
      const customTTL = 300; // 5 分鐘
      mockRedis!.set.mockResolvedValue('OK');

      // Act
      await cacheService.set('temp-key', testData, customTTL);

      // Assert
      expect(mockRedis!.set).toHaveBeenCalledWith(
        'temp-key',
        JSON.stringify(testData),
        { EX: customTTL }
      );
    });

    it('should handle array values', async () => {
      // Arrange
      const arrayData = ['item1', 'item2', 'item3'];
      mockRedis!.set.mockResolvedValue('OK');

      // Act
      await cacheService.set('array-key', arrayData);

      // Assert
      expect(mockRedis!.set).toHaveBeenCalledWith(
        'array-key',
        JSON.stringify(arrayData),
        expect.any(Object)
      );
    });

    it('should log error when Redis set fails', async () => {
      // Arrange
      const redisError = new Error('Write failed');
      mockRedis!.set.mockRejectedValue(redisError);

      // Act
      await cacheService.set('error-key', { data: 'test' });

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error SET'),
        redisError
      );
    });

    it('should handle null values', async () => {
      // Arrange
      mockRedis!.set.mockResolvedValue('OK');

      // Act
      await cacheService.set('null-key', null);

      // Assert
      expect(mockRedis!.set).toHaveBeenCalledWith(
        'null-key',
        'null',
        expect.any(Object)
      );
    });

    it('should handle zero TTL', async () => {
      // Arrange
      mockRedis!.set.mockResolvedValue('OK');

      // Act
      await cacheService.set('zero-ttl-key', { data: 'test' }, 0);

      // Assert
      expect(mockRedis!.set).toHaveBeenCalledWith(
        'zero-ttl-key',
        expect.any(String),
        { EX: 0 }
      );
    });
  });

  // ============================================
  // del() 測試
  // ============================================

  describe('del()', () => {
    it('should delete single key', async () => {
      // Arrange
      mockRedis!.del.mockResolvedValue(1);

      // Act
      await cacheService.del('single-key');

      // Assert
      expect(mockRedis!.del).toHaveBeenCalledWith('single-key');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('DELETED')
      );
    });

    it('should delete multiple keys', async () => {
      // Arrange
      const keys = ['key1', 'key2', 'key3'];
      mockRedis!.del.mockResolvedValue(3);

      // Act
      await cacheService.del(keys);

      // Assert
      expect(mockRedis!.del).toHaveBeenCalledWith(keys);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('key1, key2, key3')
      );
    });

    it('should log error when Redis del fails', async () => {
      // Arrange
      const redisError = new Error('Delete failed');
      mockRedis!.del.mockRejectedValue(redisError);

      // Act
      await cacheService.del('error-key');

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error DEL'),
        redisError
      );
    });

    it('should handle empty array of keys', async () => {
      // Arrange
      mockRedis!.del.mockResolvedValue(0);

      // Act
      await cacheService.del([]);

      // Assert
      expect(mockRedis!.del).toHaveBeenCalledWith([]);
    });
  });

  // ============================================
  // flushAll() 測試
  // ============================================

  describe('flushAll()', () => {
    it('should flush entire cache database', async () => {
      // Arrange
      mockRedis!.flushDb.mockResolvedValue('OK');

      // Act
      await cacheService.flushAll();

      // Assert
      expect(mockRedis!.flushDb).toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('FLUSHED')
      );
    });

    it('should log error when Redis flush fails', async () => {
      // Arrange
      const redisError = new Error('Flush failed');
      mockRedis!.flushDb.mockRejectedValue(redisError);

      // Act
      await cacheService.flushAll();

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error FLUSHING'),
        redisError
      );
    });
  });
});

// ============================================
// Redis 不可用時的測試（獨立檔案處理更佳）
// ============================================

describe('CacheService (Redis null scenario)', () => {
  // 這些測試驗證當 Redis 客戶端可用時的邊界情況
  // 真正的 null Redis 測試需要單獨的測試檔案來避免 mock 污染

  it('should not throw when get returns undefined', async () => {
    // Arrange
    vi.mocked(redisClient)!.get.mockResolvedValue(undefined as unknown as null);
    const cacheService = new CacheService();

    // Act
    const result = await cacheService.get<{ name: string }>('undefined-key');

    // Assert - undefined 會被視為 cache miss
    expect(result).toBeNull();
  });

  it('should handle empty string from Redis', async () => {
    // Arrange
    vi.mocked(redisClient)!.get.mockResolvedValue('""');
    const cacheService = new CacheService();

    // Act
    const result = await cacheService.get<string>('empty-string-key');

    // Assert
    expect(result).toBe('');
  });
});
