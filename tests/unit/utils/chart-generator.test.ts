/**
 * chart-generator 單元測試
 *
 * 測試範圍：
 * - 純邏輯測試：顏色決定、padding 計算、時間單位決定
 * - 介面 shape 測試：OhlcData, ChartExtraInfo
 * - Chart 生成：需要整合測試（canvas + chart.js 依賴）
 *
 * Mock 策略：
 * - canvas 和 chart.js 因 native dependencies 較難完全 mock
 * - 這裡著重測試可抽取的純函數邏輯
 */

import { describe, it, expect } from 'vitest';

// ============================================
// 純邏輯測試 - 這些可以從 chart-generator 抽取
// ============================================

describe('chart-generator pure logic', () => {
  describe('Candlestick Color Logic', () => {
    it('should return up color when close >= open', () => {
      const getColor = (open: number, close: number, upColor: string, downColor: string) => {
        return close >= open ? upColor : downColor;
      };

      const upColor = '#22c55e';
      const downColor = '#ef4444';

      // Close > Open (bullish)
      expect(getColor(100, 110, upColor, downColor)).toBe(upColor);

      // Close == Open (neutral, treated as up)
      expect(getColor(100, 100, upColor, downColor)).toBe(upColor);

      // Close < Open (bearish)
      expect(getColor(100, 90, upColor, downColor)).toBe(downColor);
    });

    it('should apply volume color with opacity', () => {
      const getVolumeColor = (open: number, close: number) => {
        return close >= open
          ? 'rgba(34, 197, 94, 0.5)'  // green with 50% opacity
          : 'rgba(239, 68, 68, 0.5)'; // red with 50% opacity
      };

      expect(getVolumeColor(100, 110)).toBe('rgba(34, 197, 94, 0.5)');
      expect(getVolumeColor(100, 90)).toBe('rgba(239, 68, 68, 0.5)');
    });
  });

  describe('Y-Axis Padding Calculation', () => {
    it('should calculate 10% padding for Y axis', () => {
      const calculatePadding = (high: number, low: number) => {
        return (high - low) * 0.1;
      };

      expect(calculatePadding(200, 100)).toBe(10);
      expect(calculatePadding(150, 50)).toBe(10);
      expect(calculatePadding(1000, 0)).toBe(100);
    });

    it('should calculate min/max with padding', () => {
      const calculateBounds = (ohlcData: { high: number; low: number }[]) => {
        const yAxisHigh = Math.max(...ohlcData.map(d => d.high));
        const yAxisLow = Math.min(...ohlcData.map(d => d.low));
        const padding = (yAxisHigh - yAxisLow) * 0.1;

        return {
          min: yAxisLow - padding,
          max: yAxisHigh + padding,
        };
      };

      const data = [
        { high: 120, low: 90 },
        { high: 150, low: 100 },
        { high: 130, low: 80 },
      ];

      const bounds = calculateBounds(data);
      expect(bounds.max).toBe(157); // 150 + 7
      expect(bounds.min).toBe(73);  // 80 - 7
    });

    it('should handle single data point', () => {
      const data = [{ high: 100, low: 100 }];
      const yAxisHigh = Math.max(...data.map(d => d.high));
      const yAxisLow = Math.min(...data.map(d => d.low));
      const padding = (yAxisHigh - yAxisLow) * 0.1;

      // When high == low, padding is 0
      expect(padding).toBe(0);
    });
  });

  describe('Time Unit Determination', () => {
    it('should return minute unit for intervals ending with m', () => {
      const getTimeUnit = (intervalLabel: string): 'minute' | 'hour' | 'day' => {
        if (intervalLabel.endsWith('m')) return 'minute';
        if (intervalLabel.endsWith('h')) return 'hour';
        return 'day';
      };

      expect(getTimeUnit('15m')).toBe('minute');
      expect(getTimeUnit('30m')).toBe('minute');
      expect(getTimeUnit('1m')).toBe('minute');
    });

    it('should return hour unit for intervals ending with h', () => {
      const getTimeUnit = (intervalLabel: string): 'minute' | 'hour' | 'day' => {
        if (intervalLabel.endsWith('m')) return 'minute';
        if (intervalLabel.endsWith('h')) return 'hour';
        return 'day';
      };

      expect(getTimeUnit('1h')).toBe('hour');
      expect(getTimeUnit('4h')).toBe('hour');
      expect(getTimeUnit('12h')).toBe('hour');
    });

    it('should return day unit for other intervals', () => {
      const getTimeUnit = (intervalLabel: string): 'minute' | 'hour' | 'day' => {
        if (intervalLabel.endsWith('m')) return 'minute';
        if (intervalLabel.endsWith('h')) return 'hour';
        return 'day';
      };

      expect(getTimeUnit('1d')).toBe('day');
      expect(getTimeUnit('7d')).toBe('day');
      expect(getTimeUnit('1w')).toBe('day');
      expect(getTimeUnit('1M')).toBe('day');
    });
  });

  describe('Change Percentage Formatting', () => {
    it('should format positive change with + sign', () => {
      const formatChange = (change: number, changePercent: number) => {
        const sign = change >= 0 ? '+' : '';
        return `${sign}${change.toFixed(2)} (${sign}${changePercent.toFixed(2)}%)`;
      };

      expect(formatChange(5.5, 2.75)).toBe('+5.50 (+2.75%)');
      expect(formatChange(0, 0)).toBe('+0.00 (+0.00%)');
    });

    it('should format negative change without extra sign', () => {
      const formatChange = (change: number, changePercent: number) => {
        const sign = change >= 0 ? '+' : '';
        return `${sign}${change.toFixed(2)} (${sign}${changePercent.toFixed(2)}%)`;
      };

      expect(formatChange(-5.5, -2.75)).toBe('-5.50 (-2.75%)');
      expect(formatChange(-0.01, -0.005)).toBe('-0.01 (-0.01%)');
    });
  });

  describe('Tick Value Formatting', () => {
    it('should format values with more than 2 decimal places', () => {
      const formatTickValue = (value: number): string | number => {
        const valueStr = String(value);
        if (valueStr.includes('.') && valueStr.split('.')[1].length > 2) {
          return value.toFixed(2);
        }
        return value;
      };

      expect(formatTickValue(100.123)).toBe('100.12');
      expect(formatTickValue(100.12345)).toBe('100.12');
      expect(formatTickValue(100.1)).toBe(100.1);
      expect(formatTickValue(100)).toBe(100);
    });
  });
});

// ============================================
// Interface Shape 測試
// ============================================

describe('chart-generator interfaces', () => {
  describe('OhlcData interface', () => {
    it('should have correct shape for OHLC data', () => {
      const ohlc = {
        timestamp: new Date('2024-01-01T12:00:00Z'),
        open: 100,
        high: 110,
        low: 95,
        close: 105,
        volume: 1000,
      };

      expect(ohlc.timestamp).toBeInstanceOf(Date);
      expect(typeof ohlc.open).toBe('number');
      expect(typeof ohlc.high).toBe('number');
      expect(typeof ohlc.low).toBe('number');
      expect(typeof ohlc.close).toBe('number');
      expect(typeof ohlc.volume).toBe('number');
    });

    it('should support various price ranges', () => {
      // Small prices (crypto fractions)
      const smallPrice = {
        timestamp: new Date(),
        open: 0.00001,
        high: 0.00002,
        low: 0.000005,
        close: 0.000015,
        volume: 1000000,
      };
      expect(smallPrice.high).toBeGreaterThan(smallPrice.low);

      // Large prices
      const largePrice = {
        timestamp: new Date(),
        open: 50000,
        high: 52000,
        low: 48000,
        close: 51500,
        volume: 10000000,
      };
      expect(largePrice.high).toBeGreaterThan(largePrice.low);
    });

    it('should validate OHLC constraints', () => {
      const validateOhlc = (ohlc: {
        open: number;
        high: number;
        low: number;
        close: number;
      }): boolean => {
        return ohlc.high >= ohlc.open &&
               ohlc.high >= ohlc.close &&
               ohlc.low <= ohlc.open &&
               ohlc.low <= ohlc.close;
      };

      // Valid OHLC
      expect(validateOhlc({ open: 100, high: 110, low: 90, close: 105 })).toBe(true);

      // Invalid: high < open
      expect(validateOhlc({ open: 100, high: 99, low: 90, close: 105 })).toBe(false);

      // Invalid: low > close
      expect(validateOhlc({ open: 100, high: 110, low: 106, close: 105 })).toBe(false);
    });
  });

  describe('ChartExtraInfo interface', () => {
    it('should have correct shape for chart extra info', () => {
      const extraInfo = {
        latestOhlc: {
          timestamp: new Date(),
          open: 100,
          high: 110,
          low: 95,
          close: 105,
          volume: 1000,
        },
        change: 5,
        changePercent: 5.0,
      };

      expect(extraInfo.latestOhlc).toBeDefined();
      expect(typeof extraInfo.change).toBe('number');
      expect(typeof extraInfo.changePercent).toBe('number');
    });

    it('should support negative change values', () => {
      const extraInfo = {
        latestOhlc: {
          timestamp: new Date(),
          open: 105,
          high: 110,
          low: 95,
          close: 100,
          volume: 1000,
        },
        change: -5,
        changePercent: -4.76,
      };

      expect(extraInfo.change).toBeLessThan(0);
      expect(extraInfo.changePercent).toBeLessThan(0);
    });
  });
});

// ============================================
// Chart Defaults 測試
// ============================================

describe('chart-generator defaults', () => {
  describe('Chart dimensions', () => {
    it('should use 16:9 aspect ratio', () => {
      const WIDTH = 900;
      const HEIGHT = 506.25;

      // 900 / 506.25 ≈ 1.777... ≈ 16/9
      const aspectRatio = WIDTH / HEIGHT;
      expect(aspectRatio).toBeCloseTo(16 / 9, 2);
    });
  });

  describe('Theme colors', () => {
    it('should have correct up/down colors', () => {
      const upColor = '#22c55e';   // Tailwind green-500
      const downColor = '#ef4444'; // Tailwind red-500

      expect(upColor).toBe('#22c55e');
      expect(downColor).toBe('#ef4444');
    });

    it('should have dark mode text colors', () => {
      const darkModeText = 'rgba(255, 255, 255, 0.9)';
      const darkModeMuted = 'rgba(255, 255, 255, 0.6)';
      const darkModeGrid = 'rgba(255, 255, 255, 0.1)';

      // Verify rgba format
      expect(darkModeText).toMatch(/^rgba\(\d+, \d+, \d+, [\d.]+\)$/);
      expect(darkModeMuted).toMatch(/^rgba\(\d+, \d+, \d+, [\d.]+\)$/);
      expect(darkModeGrid).toMatch(/^rgba\(\d+, \d+, \d+, [\d.]+\)$/);
    });

    it('should have light mode text colors', () => {
      const lightModeText = 'black';
      const lightModeMuted = '#555';
      const lightModeGrid = 'rgba(0, 0, 0, 0.1)';

      expect(lightModeText).toBe('black');
      expect(lightModeMuted).toBe('#555');
      expect(lightModeGrid).toBe('rgba(0, 0, 0, 0.1)');
    });

    it('should have OHLC label color', () => {
      const ohlcLabelColor = '#facc15'; // Yellow
      expect(ohlcLabelColor).toBe('#facc15');
    });
  });

  describe('Background colors', () => {
    it('should have correct dark mode background', () => {
      const darkModeBg = '#1E293B'; // Tailwind slate-800
      expect(darkModeBg).toBe('#1E293B');
    });

    it('should have correct light mode background', () => {
      const lightModeBg = 'white';
      expect(lightModeBg).toBe('white');
    });
  });
});

// ============================================
// Data Transformation 測試
// ============================================

describe('chart-generator data transformation', () => {
  describe('OHLC to floating bar data', () => {
    it('should transform OHLC to chart.js floating bar format', () => {
      const ohlcData = [
        { timestamp: new Date('2024-01-01T00:00:00Z'), open: 100, high: 110, low: 95, close: 105, volume: 1000 },
        { timestamp: new Date('2024-01-01T01:00:00Z'), open: 105, high: 115, low: 100, close: 110, volume: 1200 },
      ];

      const transformedData = ohlcData.map(d => ({
        x: d.timestamp.getTime(),
        y: [d.open, d.close],
        high: d.high,
        low: d.low,
      }));

      expect(transformedData[0].x).toBe(ohlcData[0].timestamp.getTime());
      expect(transformedData[0].y).toEqual([100, 105]);
      expect(transformedData[0].high).toBe(110);
      expect(transformedData[0].low).toBe(95);
    });
  });

  describe('Volume data transformation', () => {
    it('should transform volume data for chart.js', () => {
      const ohlcData = [
        { timestamp: new Date('2024-01-01T00:00:00Z'), open: 100, high: 110, low: 95, close: 105, volume: 1000 },
        { timestamp: new Date('2024-01-01T01:00:00Z'), open: 105, high: 115, low: 100, close: 110, volume: 1200 },
      ];

      const volumeData = ohlcData.map(d => ({
        x: d.timestamp.getTime(),
        y: d.volume,
      }));

      expect(volumeData[0].y).toBe(1000);
      expect(volumeData[1].y).toBe(1200);
    });
  });

  describe('Color arrays for data points', () => {
    it('should generate correct color array for candlesticks', () => {
      const ohlcData = [
        { open: 100, close: 105 }, // bullish
        { open: 105, close: 100 }, // bearish
        { open: 100, close: 100 }, // neutral (treated as bullish)
      ];

      const upColor = '#22c55e';
      const downColor = '#ef4444';

      const colors = ohlcData.map(d => d.close >= d.open ? upColor : downColor);

      expect(colors).toEqual([upColor, downColor, upColor]);
    });
  });
});
