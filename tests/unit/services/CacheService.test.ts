/**
 * CacheService 單元測試
 *
 * 測試範圍：
 * - get<T>(): 快取讀取，包含命中、未命中、解析錯誤
 * - set<T>(): 快取寫入，包含預設 TTL 和自訂 TTL
 * - del(): 刪除單一或多個 key
 * - flushAll(): 清除所有快取
 * - Redis 不可用時的行為
 * - 單例模式
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// Mock 設定 - 使用 vi.hoisted 確保在 import 前設定
// ============================================

const { mockRedisClient, mockEnsureRedisConnected, mockLogger } = vi.hoisted(() => {
  const client = {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    flushDb: vi.fn(),
  };
  return {
    mockRedisClient: client,
    mockEnsureRedisConnected: vi.fn().mockResolvedValue(client),
    mockLogger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
});

// Mock Redis 模組
vi.mock('../../../src/shared/redis.js', () => ({
  default: null,
  ensureRedisConnected: mockEnsureRedisConnected,
  isRedisConnected: vi.fn(() => true),
}));

// Mock Logger
vi.mock('../../../src/utils/logger.js', () => ({
  default: mockLogger,
}));

// 現在可以安全地 import
import { CacheService } from '../../../src/services/CacheService.js';

describe('CacheService', () => {
  let cacheService: CacheService;

  beforeEach(() => {
    // 重置單例以確保每個測試獨立
    CacheService.resetInstance();
    cacheService = CacheService.getInstance();
    vi.clearAllMocks();
    // 重置 mock 返回值
    mockEnsureRedisConnected.mockResolvedValue(mockRedisClient);
  });

  // ============================================
  // 單例模式測試
  // ============================================

  describe('Singleton Pattern', () => {
    it('should return same instance on multiple calls', () => {
      const instance1 = CacheService.getInstance();
      const instance2 = CacheService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should return new instance after reset', () => {
      const instance1 = CacheService.getInstance();
      CacheService.resetInstance();
      const instance2 = CacheService.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  // ============================================
  // get<T>() 測試
  // ============================================

  describe('get<T>()', () => {
    it('should return parsed JSON when cache hit', async () => {
      // Arrange
      const testData = { name: 'Test', value: 42 };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(testData));

      // Act
      const result = await cacheService.get<typeof testData>('test-key');

      // Assert
      expect(result).toEqual(testData);
      expect(mockRedisClient.get).toHaveBeenCalledWith('test-key');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('HIT')
      );
    });

    it('should return null when cache miss', async () => {
      // Arrange
      mockRedisClient.get.mockResolvedValue(null);

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
      mockRedisClient.get.mockResolvedValue('invalid-json{{{');

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
      mockRedisClient.get.mockRejectedValue(redisError);

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
      mockRedisClient.get.mockResolvedValue(JSON.stringify(complexData));

      // Act
      const result = await cacheService.get<typeof complexData>('complex-key');

      // Assert
      expect(result).toEqual(complexData);
    });

    it('should handle array data', async () => {
      // Arrange
      const arrayData = [1, 2, 3, 4, 5];
      mockRedisClient.get.mockResolvedValue(JSON.stringify(arrayData));

      // Act
      const result = await cacheService.get<number[]>('array-key');

      // Assert
      expect(result).toEqual(arrayData);
    });

    it('should handle primitive types', async () => {
      // Arrange
      mockRedisClient.get.mockResolvedValue(JSON.stringify('simple string'));

      // Act
      const result = await cacheService.get<string>('string-key');

      // Assert
      expect(result).toBe('simple string');
    });

    it('should return null when Redis not connected', async () => {
      // Arrange
      mockEnsureRedisConnected.mockResolvedValue(null);

      // Act
      const result = await cacheService.get<string>('any-key');

      // Assert
      expect(result).toBeNull();
      expect(mockRedisClient.get).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // set<T>() 測試
  // ============================================

  describe('set<T>()', () => {
    it('should serialize and store data with default TTL', async () => {
      // Arrange
      const testData = { name: 'Test' };
      mockRedisClient.set.mockResolvedValue('OK');

      // Act
      await cacheService.set('test-key', testData);

      // Assert
      expect(mockRedisClient.set).toHaveBeenCalledWith(
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
      mockRedisClient.set.mockResolvedValue('OK');

      // Act
      await cacheService.set('temp-key', testData, customTTL);

      // Assert
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'temp-key',
        JSON.stringify(testData),
        { EX: customTTL }
      );
    });

    it('should handle array values', async () => {
      // Arrange
      const arrayData = ['item1', 'item2', 'item3'];
      mockRedisClient.set.mockResolvedValue('OK');

      // Act
      await cacheService.set('array-key', arrayData);

      // Assert
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'array-key',
        JSON.stringify(arrayData),
        expect.any(Object)
      );
    });

    it('should log error when Redis set fails', async () => {
      // Arrange
      const redisError = new Error('Write failed');
      mockRedisClient.set.mockRejectedValue(redisError);

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
      mockRedisClient.set.mockResolvedValue('OK');

      // Act
      await cacheService.set('null-key', null);

      // Assert
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'null-key',
        'null',
        expect.any(Object)
      );
    });

    it('should handle zero TTL', async () => {
      // Arrange
      mockRedisClient.set.mockResolvedValue('OK');

      // Act
      await cacheService.set('zero-ttl-key', { data: 'test' }, 0);

      // Assert
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'zero-ttl-key',
        expect.any(String),
        { EX: 0 }
      );
    });

    it('should not call Redis when not connected', async () => {
      // Arrange
      mockEnsureRedisConnected.mockResolvedValue(null);

      // Act
      await cacheService.set('any-key', { data: 'test' });

      // Assert
      expect(mockRedisClient.set).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // del() 測試
  // ============================================

  describe('del()', () => {
    it('should delete single key', async () => {
      // Arrange
      mockRedisClient.del.mockResolvedValue(1);

      // Act
      await cacheService.del('single-key');

      // Assert
      expect(mockRedisClient.del).toHaveBeenCalledWith('single-key');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('DELETED')
      );
    });

    it('should delete multiple keys', async () => {
      // Arrange
      const keys = ['key1', 'key2', 'key3'];
      mockRedisClient.del.mockResolvedValue(3);

      // Act
      await cacheService.del(keys);

      // Assert
      expect(mockRedisClient.del).toHaveBeenCalledWith(keys);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('key1, key2, key3')
      );
    });

    it('should log error when Redis del fails', async () => {
      // Arrange
      const redisError = new Error('Delete failed');
      mockRedisClient.del.mockRejectedValue(redisError);

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
      mockRedisClient.del.mockResolvedValue(0);

      // Act
      await cacheService.del([]);

      // Assert
      expect(mockRedisClient.del).toHaveBeenCalledWith([]);
    });

    it('should not call Redis when not connected', async () => {
      // Arrange
      mockEnsureRedisConnected.mockResolvedValue(null);

      // Act
      await cacheService.del('any-key');

      // Assert
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // flushAll() 測試
  // ============================================

  describe('flushAll()', () => {
    it('should flush entire cache database', async () => {
      // Arrange
      mockRedisClient.flushDb.mockResolvedValue('OK');

      // Act
      await cacheService.flushAll();

      // Assert
      expect(mockRedisClient.flushDb).toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('FLUSHED')
      );
    });

    it('should log error when Redis flush fails', async () => {
      // Arrange
      const redisError = new Error('Flush failed');
      mockRedisClient.flushDb.mockRejectedValue(redisError);

      // Act
      await cacheService.flushAll();

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error FLUSHING'),
        redisError
      );
    });

    it('should not call Redis when not connected', async () => {
      // Arrange
      mockEnsureRedisConnected.mockResolvedValue(null);

      // Act
      await cacheService.flushAll();

      // Assert
      expect(mockRedisClient.flushDb).not.toHaveBeenCalled();
    });
  });
});

// ============================================
// Redis 不可用時的測試
// ============================================

describe('CacheService (Redis null scenario)', () => {
  beforeEach(() => {
    CacheService.resetInstance();
    vi.clearAllMocks();
  });

  it('should not throw when get returns undefined', async () => {
    // Arrange
    mockRedisClient.get.mockResolvedValue(undefined as unknown as null);
    mockEnsureRedisConnected.mockResolvedValue(mockRedisClient);
    const cacheService = CacheService.getInstance();

    // Act
    const result = await cacheService.get<{ name: string }>('undefined-key');

    // Assert - undefined 會被視為 cache miss
    expect(result).toBeNull();
  });

  it('should handle empty string from Redis', async () => {
    // Arrange
    mockRedisClient.get.mockResolvedValue('""');
    mockEnsureRedisConnected.mockResolvedValue(mockRedisClient);
    const cacheService = CacheService.getInstance();

    // Act
    const result = await cacheService.get<string>('empty-string-key');

    // Assert
    expect(result).toBe('');
  });
});
