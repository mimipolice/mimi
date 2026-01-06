/**
 * stockSelect Select Menu Unit Tests
 *
 * Tests the stock select menu handler which displays price report details
 * when a user selects a stock from the dropdown menu.
 *
 * Test coverage:
 * - Authorization checks (originalUserId validation)
 * - Value selection handling
 * - Report data fetching
 * - Chart generation
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// Mock Setup - use vi.hoisted for persistent mocks
// ============================================

const {
  mockGetReportData,
  mockGenerateCandlestickChart,
  mockSaveChart,
  mockLoggerError,
  mockLoggerInfo,
} = vi.hoisted(() => ({
  mockGetReportData: vi.fn(),
  mockGenerateCandlestickChart: vi.fn(),
  mockSaveChart: vi.fn(),
  mockLoggerError: vi.fn(),
  mockLoggerInfo: vi.fn(),
}));

// Mock the report data function
vi.mock('../../../../src/commands/public/report/index.js', () => ({
  getReportData: mockGetReportData,
}));

// Mock chart generator
vi.mock('../../../../src/utils/chart-generator.js', () => ({
  generateCandlestickChart: mockGenerateCandlestickChart,
}));

// Mock ChartCacheService
vi.mock('../../../../src/services/ChartCacheService.js', () => ({
  ChartCacheService: class MockChartCacheService {
    saveChart = mockSaveChart;
  },
}));

// Mock localization
vi.mock('../../../../src/utils/localization.js', () => ({
  getLocalizations: vi.fn(() => ({
    'en-US': {
      responses: {
        no_data: 'No data available for {{symbol}}',
        chart_error: 'Failed to generate chart',
        report_title: 'Price Report: {{assetName}}',
        last_updated: 'Last updated: {{timestamp}}',
        button_price_analysis: 'Price Analysis',
        button_detailed_price: 'Detailed Price',
        button_volume_analysis: 'Volume Analysis',
        chart_description: 'Price chart for {{assetName}}',
      },
    },
    'zh-TW': {
      responses: {
        no_data: '{{symbol}} 沒有可用的資料',
        chart_error: '圖表生成失敗',
        report_title: '價格報告：{{assetName}}',
        last_updated: '最後更新：{{timestamp}}',
        button_price_analysis: '價格分析',
        button_detailed_price: '詳細價格',
        button_volume_analysis: '成交量分析',
        chart_description: '{{assetName}} 價格圖表',
      },
    },
  })),
}));

// Mock summary builder
vi.mock('../../../../src/commands/public/report/summaryBuilder.js', () => ({
  buildSummaryText: vi.fn().mockReturnValue({ type: 'TextDisplay', content: 'Summary' }),
}));

// Mock asset list
vi.mock('../../../../src/config/asset-list.json', () => ({
  default: [
    { asset_symbol: 'TSLA', asset_name: 'Tesla' },
    { asset_symbol: 'AAPL', asset_name: 'Apple' },
    { asset_symbol: 'GOOGL', asset_name: 'Google' },
  ],
}));

// Mock logger
vi.mock('../../../../src/utils/logger.js', () => ({
  default: {
    debug: vi.fn(),
    info: mockLoggerInfo,
    warn: vi.fn(),
    error: mockLoggerError,
  },
}));

// Mock interactionReply
vi.mock('../../../../src/utils/interactionReply.js', () => ({
  createUnauthorizedReply: vi.fn(() => ({
    content: 'You are not authorized to use this interaction.',
    flags: 64,
  })),
}));

// ============================================
// Import after mocks
// ============================================

import stockSelect from '../../../../src/interactions/selectMenus/stockSelect.js';
import { createMockStringSelectMenuInteraction } from '../../../helpers/discord-mocks.js';
import type { Services } from '../../../../src/interfaces/Command.js';

describe('stockSelect', () => {
  let mockServices: Services;

  beforeEach(() => {
    vi.clearAllMocks();

    mockServices = {
      localizationManager: {
        get: vi.fn((key: string) => key),
      },
      settingsManager: {} as any,
      ticketManager: {} as any,
      helpService: {} as any,
      forumService: {} as any,
      cacheService: {} as any,
      storyForumService: {} as any,
    } as Services;

    // Default mock returns
    mockGetReportData.mockResolvedValue({
      history: [
        { time: 1704067200, open: 100, high: 105, low: 98, close: 103, volume: 1000 },
      ],
      intervalLabel: '7 Days',
      latestOhlc: { open: 100, high: 105, low: 98, close: 103 },
      change: 3,
      changePercent: 3.0,
      totalChangeValue: 3,
      generatedAt: Date.now(),
    });

    mockGenerateCandlestickChart.mockResolvedValue(Buffer.from('chart-image'));
    mockSaveChart.mockResolvedValue('/tmp/chart.png');
  });

  // ============================================
  // Basic Properties
  // ============================================

  describe('handler properties', () => {
    it('should have correct name', () => {
      expect(stockSelect.name).toBe('stock-select');
    });

    it('should have execute function', () => {
      expect(typeof stockSelect.execute).toBe('function');
    });
  });

  // ============================================
  // Authorization Tests
  // ============================================

  describe('authorization', () => {
    it('should reject unauthorized users when originalUserId does not match', async () => {
      // Arrange
      const interaction = createMockStringSelectMenuInteraction({
        customId: 'stock-select:7d:user-original-123',
        values: ['TSLA'],
        userId: 'user-different-456',
      });

      // Act
      await stockSelect.execute(interaction as any, mockServices);

      // Assert
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('not authorized'),
        })
      );
      expect(interaction.deferUpdate).not.toHaveBeenCalled();
    });

    it('should allow authorized user when originalUserId matches', async () => {
      // Arrange
      const interaction = createMockStringSelectMenuInteraction({
        customId: 'stock-select:7d:user123',
        values: ['TSLA'],
        userId: 'user123',
      });

      // Act
      await stockSelect.execute(interaction as any, mockServices);

      // Assert
      expect(interaction.deferUpdate).toHaveBeenCalled();
    });

    it('should allow any user when originalUserId is not specified', async () => {
      // Arrange
      const interaction = createMockStringSelectMenuInteraction({
        customId: 'stock-select:7d:',
        values: ['TSLA'],
        userId: 'any-user',
      });

      // Act
      await stockSelect.execute(interaction as any, mockServices);

      // Assert - should proceed without authorization error
      expect(interaction.deferUpdate).toHaveBeenCalled();
    });
  });

  // ============================================
  // Value Selection Tests
  // ============================================

  describe('value selection handling', () => {
    it('should parse customId correctly', async () => {
      // Arrange
      const interaction = createMockStringSelectMenuInteraction({
        customId: 'stock-select:30d:user123',
        values: ['AAPL'],
        userId: 'user123',
      });

      // Act
      await stockSelect.execute(interaction as any, mockServices);

      // Assert
      expect(mockGetReportData).toHaveBeenCalledWith('AAPL', '30d', mockServices);
    });

    it('should use default range when not specified', async () => {
      // Arrange
      const interaction = createMockStringSelectMenuInteraction({
        customId: 'stock-select::user123',
        values: ['GOOGL'],
        userId: 'user123',
      });

      // Act
      await stockSelect.execute(interaction as any, mockServices);

      // Assert
      expect(mockGetReportData).toHaveBeenCalledWith('GOOGL', '7d', mockServices);
    });

    it('should use selected stock symbol from values', async () => {
      // Arrange
      const interaction = createMockStringSelectMenuInteraction({
        customId: 'stock-select:7d:user123',
        values: ['TSLA'],
        userId: 'user123',
      });

      // Act
      await stockSelect.execute(interaction as any, mockServices);

      // Assert
      expect(mockGetReportData).toHaveBeenCalledWith('TSLA', '7d', mockServices);
    });
  });

  // ============================================
  // Data Fetching Tests
  // ============================================

  describe('report data handling', () => {
    it('should show no data message when report data is null', async () => {
      // Arrange
      mockGetReportData.mockResolvedValue(null);
      const interaction = createMockStringSelectMenuInteraction({
        customId: 'stock-select:7d:user123',
        values: ['UNKNOWN'],
        userId: 'user123',
      });

      // Act
      await stockSelect.execute(interaction as any, mockServices);

      // Assert
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('UNKNOWN'),
          components: [],
        })
      );
    });

    it('should generate chart with correct parameters', async () => {
      // Arrange
      const mockData = {
        history: [
          { time: 1704067200, open: 100, high: 105, low: 98, close: 103, volume: 1000 },
        ],
        intervalLabel: '7 Days',
        latestOhlc: { open: 100, high: 105, low: 98, close: 103 },
        change: 3,
        changePercent: 3.0,
        totalChangeValue: 3,
        generatedAt: Date.now(),
      };
      mockGetReportData.mockResolvedValue(mockData);

      const interaction = createMockStringSelectMenuInteraction({
        customId: 'stock-select:7d:user123',
        values: ['TSLA'],
        userId: 'user123',
      });

      // Act
      await stockSelect.execute(interaction as any, mockServices);

      // Assert
      expect(mockGenerateCandlestickChart).toHaveBeenCalledWith(
        mockData.history,
        'TSLA',
        '7 Days',
        expect.objectContaining({
          latestOhlc: mockData.latestOhlc,
          change: mockData.change,
          changePercent: mockData.changePercent,
        }),
        true
      );
    });
  });

  // ============================================
  // Chart Cache Tests
  // ============================================

  describe('chart caching', () => {
    it('should save chart to cache with correct key', async () => {
      // Arrange
      const interaction = createMockStringSelectMenuInteraction({
        customId: 'stock-select:7d:user123',
        values: ['TSLA'],
        userId: 'user123',
      });

      // Act
      await stockSelect.execute(interaction as any, mockServices);

      // Assert
      expect(mockSaveChart).toHaveBeenCalledWith(
        'report-chart:TSLA:7d',
        expect.any(Buffer)
      );
    });

    it('should show error when chart save fails', async () => {
      // Arrange
      mockSaveChart.mockResolvedValue(null);
      const interaction = createMockStringSelectMenuInteraction({
        customId: 'stock-select:7d:user123',
        values: ['TSLA'],
        userId: 'user123',
      });

      // Act
      await stockSelect.execute(interaction as any, mockServices);

      // Assert
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          components: [],
        })
      );
    });
  });

  // ============================================
  // Error Handling Tests
  // ============================================

  describe('error handling', () => {
    it('should log and reply with error message when exception occurs', async () => {
      // Arrange
      mockGetReportData.mockRejectedValue(new Error('Database connection failed'));
      const interaction = createMockStringSelectMenuInteraction({
        customId: 'stock-select:7d:user123',
        values: ['TSLA'],
        userId: 'user123',
      });

      // Act
      await stockSelect.execute(interaction as any, mockServices);

      // Assert
      expect(mockLoggerError).toHaveBeenCalledWith(
        'Error executing stock select menu:',
        expect.any(Error)
      );
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('錯誤'),
          components: [],
        })
      );
    });

    it('should handle chart generation failure gracefully', async () => {
      // Arrange
      mockGenerateCandlestickChart.mockRejectedValue(new Error('Canvas error'));
      const interaction = createMockStringSelectMenuInteraction({
        customId: 'stock-select:7d:user123',
        values: ['TSLA'],
        userId: 'user123',
      });

      // Act
      await stockSelect.execute(interaction as any, mockServices);

      // Assert
      expect(mockLoggerError).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalled();
    });
  });
});
