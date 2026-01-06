/**
 * withRetry 工具函數單元測試
 *
 * 測試範圍：
 * - 成功執行（不需重試）
 * - 失敗後重試成功
 * - 超過重試次數後拋出錯誤
 * - 自訂重試選項
 * - onRetry 日誌記錄
 *
 * 注意：使用真實計時器，因為 async-retry 套件不支援 fake timers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Logger
vi.mock('../../../src/utils/logger.js', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { withRetry, type RetryOptions } from '../../../src/utils/withRetry.js';
import logger from '../../../src/utils/logger.js';

const mockLogger = vi.mocked(logger);

// 使用極短的超時時間來加速測試
const fastRetryOptions: RetryOptions = {
  minTimeout: 1,
  factor: 1,
};

describe('withRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // 成功執行測試
  // ============================================

  describe('successful execution', () => {
    it('should return result immediately when function succeeds', async () => {
      // Arrange
      const expectedResult = { data: 'success' };
      const fn = vi.fn().mockResolvedValue(expectedResult);

      // Act
      const result = await withRetry(fn, 'test operation');

      // Assert
      expect(result).toEqual(expectedResult);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should not retry when function succeeds on first attempt', async () => {
      // Arrange
      const fn = vi.fn().mockResolvedValue('success');

      // Act
      await withRetry(fn, 'immediate success');

      // Assert
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should handle void return type', async () => {
      // Arrange
      const fn = vi.fn().mockResolvedValue(undefined);

      // Act
      const result = await withRetry(fn, 'void operation');

      // Assert
      expect(result).toBeUndefined();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should handle null result', async () => {
      // Arrange
      const fn = vi.fn().mockResolvedValue(null);

      // Act
      const result = await withRetry(fn, 'null result');

      // Assert
      expect(result).toBeNull();
    });
  });

  // ============================================
  // 重試後成功測試
  // ============================================

  describe('retry then success', () => {
    it('should succeed after 1 retry', async () => {
      // Arrange
      const expectedResult = 'finally worked';
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValue(expectedResult);

      // Act
      const result = await withRetry(fn, 'retry once', fastRetryOptions);

      // Assert
      expect(result).toBe(expectedResult);
      expect(fn).toHaveBeenCalledTimes(2);
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('retry once'),
        expect.objectContaining({ error: 'First attempt failed' })
      );
    });

    it('should succeed after 2 retries', async () => {
      // Arrange
      const expectedResult = { success: true };
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('First fail'))
        .mockRejectedValueOnce(new Error('Second fail'))
        .mockResolvedValue(expectedResult);

      // Act
      const result = await withRetry(fn, 'retry twice', fastRetryOptions);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(fn).toHaveBeenCalledTimes(3);
      expect(mockLogger.warn).toHaveBeenCalledTimes(2);
    });

    it('should succeed on last allowed retry', async () => {
      // Arrange
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockRejectedValueOnce(new Error('Fail 3'))
        .mockResolvedValue('success');

      // Act
      const result = await withRetry(fn, 'last retry', {
        retries: 3,
        ...fastRetryOptions,
      });

      // Assert
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    });
  });

  // ============================================
  // 超過重試次數後失敗測試
  // ============================================

  describe('exhausted retries', () => {
    it('should throw after exceeding retry count', async () => {
      // Arrange
      const error = new Error('Persistent failure');
      const fn = vi.fn().mockRejectedValue(error);

      // Act & Assert
      await expect(
        withRetry(fn, 'always fails', { retries: 2, ...fastRetryOptions })
      ).rejects.toThrow('Persistent failure');
      expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });

    it('should throw the last error when all retries fail', async () => {
      // Arrange
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockRejectedValue(new Error('Final error'));

      // Act & Assert
      await expect(
        withRetry(fn, 'varying errors', { retries: 2, ...fastRetryOptions })
      ).rejects.toThrow('Final error');
    });

    it('should log each retry attempt', async () => {
      // Arrange
      const fn = vi.fn().mockRejectedValue(new Error('Always fails'));

      // Act
      try {
        await withRetry(fn, 'log test', { retries: 3, ...fastRetryOptions });
      } catch {
        // Expected to throw
      }

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledTimes(3);
      expect(mockLogger.warn).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('attempt 1'),
        expect.any(Object)
      );
      expect(mockLogger.warn).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('attempt 2'),
        expect.any(Object)
      );
      expect(mockLogger.warn).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('attempt 3'),
        expect.any(Object)
      );
    });
  });

  // ============================================
  // 自訂選項測試
  // ============================================

  describe('custom options', () => {
    it('should respect custom retries count', async () => {
      // Arrange
      const fn = vi.fn().mockRejectedValue(new Error('Fail'));
      const options: RetryOptions = { retries: 5, ...fastRetryOptions };

      // Act
      try {
        await withRetry(fn, 'custom retries', options);
      } catch {
        // Expected to throw
      }

      // Assert
      expect(fn).toHaveBeenCalledTimes(6); // 1 initial + 5 retries
    });

    it('should use zero retries (no retry)', async () => {
      // Arrange
      const fn = vi.fn().mockRejectedValue(new Error('Immediate fail'));
      const options: RetryOptions = { retries: 0 };

      // Act & Assert
      await expect(withRetry(fn, 'no retry', options)).rejects.toThrow(
        'Immediate fail'
      );
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should use default options when not provided', async () => {
      // Arrange - 使用 fast options 避免等待過久
      const fn = vi.fn().mockRejectedValue(new Error('Fail'));

      // Act
      try {
        await withRetry(fn, 'default options', fastRetryOptions);
      } catch {
        // Expected to throw
      }

      // Assert - 預設 3 次重試
      expect(fn).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    });
  });

  // ============================================
  // 邊界情況測試
  // ============================================

  describe('edge cases', () => {
    it('should handle async function that throws synchronously', async () => {
      // Arrange
      const fn = vi.fn().mockImplementation(() => {
        throw new Error('Sync throw');
      });

      // Act & Assert
      await expect(
        withRetry(fn, 'sync throw', { retries: 0 })
      ).rejects.toThrow('Sync throw');
    });

    it('should preserve error type', async () => {
      // Arrange
      class CustomError extends Error {
        constructor(
          message: string,
          public code: number
        ) {
          super(message);
          this.name = 'CustomError';
        }
      }
      const customError = new CustomError('Custom failure', 500);
      const fn = vi.fn().mockRejectedValue(customError);

      // Act & Assert
      try {
        await withRetry(fn, 'custom error', { retries: 0 });
      } catch (e) {
        expect(e).toBe(customError);
        expect((e as CustomError).code).toBe(500);
      }
    });

    it('should include context in log message', async () => {
      // Arrange
      const fn = vi.fn().mockRejectedValue(new Error('Fail'));
      const context = 'Database connection';

      // Act
      try {
        await withRetry(fn, context, { retries: 1, ...fastRetryOptions });
      } catch {
        // Expected to throw
      }

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(context),
        expect.any(Object)
      );
    });
  });

  // ============================================
  // 泛型類型測試
  // ============================================

  describe('type safety', () => {
    it('should preserve return type for objects', async () => {
      // Arrange
      interface User {
        id: string;
        name: string;
      }
      const user: User = { id: '123', name: 'Test' };
      const fn = vi.fn().mockResolvedValue(user);

      // Act
      const result = await withRetry<User>(fn, 'fetch user');

      // Assert
      expect(result.id).toBe('123');
      expect(result.name).toBe('Test');
    });

    it('should preserve return type for arrays', async () => {
      // Arrange
      const items = [1, 2, 3, 4, 5];
      const fn = vi.fn().mockResolvedValue(items);

      // Act
      const result = await withRetry<number[]>(fn, 'fetch items');

      // Assert
      expect(result).toHaveLength(5);
      expect(result[0]).toBe(1);
    });
  });
});
