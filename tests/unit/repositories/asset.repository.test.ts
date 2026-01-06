/**
 * asset.repository 單元測試
 *
 * 測試範圍：
 * - TimescaleDB 函數: getOhlcWithCandlestick, getDownsampledPrices, getPriceStatistics
 *
 * 注意：
 * - 其他使用 gachaDB/mimiDLCDb 直接導入的函數較難 mock
 * - 這些函數使用 sql`` template tag 直接執行 SQL，更適合 mock
 *
 * Mock 策略：
 * - Kysely sql tag: mock sql 函數的 execute 方法
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================
// Mock 設定
// ============================================

const mockSqlExecute = vi.fn();

// Mock Kysely sql tag
vi.mock('kysely', async (importOriginal) => {
  const original = await importOriginal<typeof import('kysely')>();
  return {
    ...original,
    sql: Object.assign(
      (strings: TemplateStringsArray, ...values: any[]) => ({
        execute: mockSqlExecute,
        as: vi.fn().mockReturnValue({}),
      }),
      {
        raw: vi.fn((str: string) => str),
      }
    ),
  };
});

// Mock databases - simple mock to prevent import errors
vi.mock('../../../src/shared/database/index.js', () => ({
  gachaDB: {},
  mimiDLCDb: {},
}));

// ============================================
// Import after mocks
// ============================================

import {
  getOhlcWithCandlestick,
  getDownsampledPrices,
  getPriceStatistics,
} from '../../../src/repositories/asset.repository.js';

describe('asset.repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSqlExecute.mockResolvedValue({ rows: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================
  // TimescaleDB 函數測試 (使用 sql`` template tag)
  // ============================================

  describe('getOhlcWithCandlestick()', () => {
    it('should return OHLCV with VWAP from candlestick_agg', async () => {
      // Arrange
      mockSqlExecute.mockResolvedValueOnce({
        rows: [
          {
            bucket: new Date('2024-01-01'),
            open: 100,
            high: 120,
            low: 95,
            close: 115,
            vwap: 108.5,
            volume: '5000',
          },
        ],
      });

      // Act
      const result = await getOhlcWithCandlestick('ODOG', '7d', '1 hour');

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].open).toBe(100);
      expect(result[0].high).toBe(120);
      expect(result[0].low).toBe(95);
      expect(result[0].close).toBe(115);
      expect(result[0].vwap).toBe(108.5);
      expect(result[0].volume).toBe(5000);
    });

    it('should handle multiple candles', async () => {
      // Arrange
      mockSqlExecute.mockResolvedValueOnce({
        rows: [
          { bucket: new Date('2024-01-01T00:00:00Z'), open: 100, high: 110, low: 95, close: 105, vwap: 102, volume: '1000' },
          { bucket: new Date('2024-01-01T01:00:00Z'), open: 105, high: 115, low: 100, close: 112, vwap: 108, volume: '1500' },
          { bucket: new Date('2024-01-01T02:00:00Z'), open: 112, high: 120, low: 108, close: 118, vwap: 114, volume: '2000' },
        ],
      });

      // Act
      const result = await getOhlcWithCandlestick('ODOG', '1d', '1 hour');

      // Assert
      expect(result).toHaveLength(3);
      expect(result[0].timestamp).toEqual(new Date('2024-01-01T00:00:00Z'));
      expect(result[2].close).toBe(118);
    });

    it('should handle empty result', async () => {
      // Arrange
      mockSqlExecute.mockResolvedValueOnce({ rows: [] });

      // Act
      const result = await getOhlcWithCandlestick('UNKNOWN', '1d', '30 minutes');

      // Assert
      expect(result).toEqual([]);
    });

    it('should convert all numeric fields properly', async () => {
      // Arrange - simulate database returning strings (common with PostgreSQL numeric types)
      mockSqlExecute.mockResolvedValueOnce({
        rows: [
          {
            bucket: new Date('2024-01-01'),
            open: '100.50',
            high: '120.75',
            low: '95.25',
            close: '115.00',
            vwap: '108.50',
            volume: '5000',
          },
        ],
      });

      // Act
      const result = await getOhlcWithCandlestick('ODOG', '7d', '1 hour');

      // Assert
      expect(typeof result[0].open).toBe('number');
      expect(typeof result[0].volume).toBe('number');
      expect(result[0].open).toBe(100.50);
    });

    it('should parse different time ranges', async () => {
      // Arrange
      mockSqlExecute.mockResolvedValue({ rows: [] });

      // Act & Assert - these should not throw
      await getOhlcWithCandlestick('ODOG', '24h', '30 minutes');
      await getOhlcWithCandlestick('ODOG', '7d', '1 hour');
      await getOhlcWithCandlestick('ODOG', '1m', '1 day');
      await getOhlcWithCandlestick('ODOG', '1y', '1 week');
      await getOhlcWithCandlestick('ODOG', 'all', '1 day');

      expect(mockSqlExecute).toHaveBeenCalledTimes(5);
    });
  });

  describe('getDownsampledPrices()', () => {
    it('should return downsampled price data with LTTB', async () => {
      // Arrange
      mockSqlExecute.mockResolvedValueOnce({
        rows: [
          { time: new Date('2024-01-01T00:00:00Z'), value: 100 },
          { time: new Date('2024-01-01T12:00:00Z'), value: 110 },
          { time: new Date('2024-01-02T00:00:00Z'), value: 105 },
        ],
      });

      // Act
      const result = await getDownsampledPrices('ODOG', '7d', 500);

      // Assert
      expect(result).toHaveLength(3);
      expect(result[0].timestamp).toBeInstanceOf(Date);
      expect(result[0].price).toBe(100);
    });

    it('should use default target points of 500', async () => {
      // Arrange
      mockSqlExecute.mockResolvedValueOnce({ rows: [] });

      // Act
      await getDownsampledPrices('ODOG', '7d');

      // Assert
      expect(mockSqlExecute).toHaveBeenCalled();
    });

    it('should handle custom target points', async () => {
      // Arrange
      mockSqlExecute.mockResolvedValueOnce({ rows: [] });

      // Act
      await getDownsampledPrices('ODOG', '30d', 1000);

      // Assert
      expect(mockSqlExecute).toHaveBeenCalled();
    });

    it('should convert price values to numbers', async () => {
      // Arrange
      mockSqlExecute.mockResolvedValueOnce({
        rows: [
          { time: new Date('2024-01-01'), value: '99.99' },
        ],
      });

      // Act
      const result = await getDownsampledPrices('ODOG', '1d');

      // Assert
      expect(typeof result[0].price).toBe('number');
      expect(result[0].price).toBe(99.99);
    });

    it('should return empty array when no data', async () => {
      // Arrange
      mockSqlExecute.mockResolvedValueOnce({ rows: [] });

      // Act
      const result = await getDownsampledPrices('UNKNOWN', '7d');

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('getPriceStatistics()', () => {
    it('should return statistical metrics', async () => {
      // Arrange
      mockSqlExecute.mockResolvedValueOnce({
        rows: [
          {
            mean: 105.5,
            stddev: 15.2,
            variance: 231.04,
            skewness: 0.5,
            kurtosis: 2.8,
          },
        ],
      });

      // Act
      const result = await getPriceStatistics('ODOG', '7d');

      // Assert
      expect(result).toEqual({
        mean: 105.5,
        stddev: 15.2,
        variance: 231.04,
        skewness: 0.5,
        kurtosis: 2.8,
      });
    });

    it('should return null when no data', async () => {
      // Arrange
      mockSqlExecute.mockResolvedValueOnce({
        rows: [{ mean: null, stddev: null, variance: null, skewness: null, kurtosis: null }],
      });

      // Act
      const result = await getPriceStatistics('UNKNOWN', '7d');

      // Assert
      expect(result).toBeNull();
    });

    it('should return null when no rows returned', async () => {
      // Arrange
      mockSqlExecute.mockResolvedValueOnce({ rows: [] });

      // Act
      const result = await getPriceStatistics('UNKNOWN', '1d');

      // Assert
      expect(result).toBeNull();
    });

    it('should handle string numeric values from database', async () => {
      // Arrange
      mockSqlExecute.mockResolvedValueOnce({
        rows: [
          {
            mean: '105.5',
            stddev: '15.2',
            variance: '231.04',
            skewness: '0.5',
            kurtosis: '2.8',
          },
        ],
      });

      // Act
      const result = await getPriceStatistics('ODOG', '7d');

      // Assert
      expect(result).not.toBeNull();
      expect(typeof result!.mean).toBe('number');
      expect(result!.mean).toBe(105.5);
    });

    it('should handle different time ranges', async () => {
      // Arrange
      mockSqlExecute.mockResolvedValue({
        rows: [{ mean: 100, stddev: 10, variance: 100, skewness: 0, kurtosis: 3 }],
      });

      // Act
      await getPriceStatistics('ODOG', '1h');
      await getPriceStatistics('ODOG', '24h');
      await getPriceStatistics('ODOG', '7d');
      await getPriceStatistics('ODOG', '1m');
      await getPriceStatistics('ODOG', '1y');
      await getPriceStatistics('ODOG', 'all');

      // Assert
      expect(mockSqlExecute).toHaveBeenCalledTimes(6);
    });

    it('should handle extreme statistical values', async () => {
      // Arrange - simulate highly volatile asset
      mockSqlExecute.mockResolvedValueOnce({
        rows: [
          {
            mean: 1000000,
            stddev: 500000,
            variance: 250000000000,
            skewness: 2.5,  // High positive skew
            kurtosis: 10.0, // Fat tails
          },
        ],
      });

      // Act
      const result = await getPriceStatistics('VOLATILE', '7d');

      // Assert
      expect(result).not.toBeNull();
      expect(result!.kurtosis).toBe(10.0);
    });
  });

  // ============================================
  // 邊界情況測試
  // ============================================

  describe('edge cases', () => {
    it('should handle zero values', async () => {
      // Arrange
      mockSqlExecute.mockResolvedValueOnce({
        rows: [
          {
            bucket: new Date('2024-01-01'),
            open: 0,
            high: 0,
            low: 0,
            close: 0,
            vwap: 0,
            volume: '0',
          },
        ],
      });

      // Act
      const result = await getOhlcWithCandlestick('ZERO', '1d', '1 hour');

      // Assert
      expect(result[0].open).toBe(0);
      expect(result[0].volume).toBe(0);
    });

    it('should handle very small decimal values', async () => {
      // Arrange
      mockSqlExecute.mockResolvedValueOnce({
        rows: [
          { time: new Date('2024-01-01'), value: 0.00000001 },
        ],
      });

      // Act
      const result = await getDownsampledPrices('MICRO', '1d');

      // Assert
      expect(result[0].price).toBe(0.00000001);
    });

    it('should handle very large values', async () => {
      // Arrange
      mockSqlExecute.mockResolvedValueOnce({
        rows: [
          { time: new Date('2024-01-01'), value: 999999999.99 },
        ],
      });

      // Act
      const result = await getDownsampledPrices('WHALE', '1d');

      // Assert
      expect(result[0].price).toBe(999999999.99);
    });
  });
});
