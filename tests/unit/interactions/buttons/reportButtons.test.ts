/**
 * Report Buttons 單元測試
 *
 * 合併測試 reportView 和 reportQuick
 *
 * 測試範圍：
 * - reportView: 切換報告視圖（價格/詳細/成交量）
 * - reportQuick: 快速生成報告
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ComponentType, MessageFlags } from 'discord.js';

// ============================================
// Mock 設定 - 使用 vi.hoisted 確保持久化
// ============================================

const {
  mockGetReportData,
  mockGenerateCandlestickChart,
  mockSaveChart,
  mockGetChartPath,
  mockGetLocalizations,
  mockBuildSummaryText,
  mockCreateStockSelectMenu,
  mockLoggerError,
  mockErrorHandler,
} = vi.hoisted(() => ({
  mockGetReportData: vi.fn(),
  mockGenerateCandlestickChart: vi.fn(),
  mockSaveChart: vi.fn(),
  mockGetChartPath: vi.fn(),
  mockGetLocalizations: vi.fn(),
  mockBuildSummaryText: vi.fn(),
  mockCreateStockSelectMenu: vi.fn(),
  mockLoggerError: vi.fn(),
  mockErrorHandler: {
    handleInteractionError: vi.fn(),
  },
}));

// Mock logger
vi.mock('../../../../src/utils/logger.js', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: mockLoggerError,
  },
}));

// Mock report command
vi.mock('../../../../src/commands/public/report/index.js', () => ({
  getReportData: mockGetReportData,
}));

// Mock summaryBuilder
vi.mock('../../../../src/commands/public/report/summaryBuilder.js', () => ({
  buildSummaryText: mockBuildSummaryText,
}));

// Mock chart-generator
vi.mock('../../../../src/utils/chart-generator.js', () => ({
  generateCandlestickChart: mockGenerateCandlestickChart,
}));

// Mock ChartCacheService
vi.mock('../../../../src/services/ChartCacheService.js', () => ({
  ChartCacheService: class MockChartCacheService {
    saveChart = mockSaveChart;
    getChartPath = mockGetChartPath;
  },
}));

// Mock localization
vi.mock('../../../../src/utils/localization.js', () => ({
  getLocalizations: mockGetLocalizations,
}));

// Mock stockSelect
vi.mock('../../../../src/interactions/selectMenus/stockSelect.js', () => ({
  createStockSelectMenu: mockCreateStockSelectMenu,
}));

// Mock interactionReply
vi.mock('../../../../src/utils/interactionReply.js', () => ({
  createUnauthorizedReply: vi.fn().mockReturnValue({
    content: 'Unauthorized',
    flags: 64,
  }),
}));

// Mock errorHandler
vi.mock('../../../../src/utils/errorHandler.js', () => ({
  errorHandler: mockErrorHandler,
}));

// Mock asset-list
vi.mock('../../../../src/config/asset-list.json', () => ({
  default: [
    { asset_symbol: 'ODOG', asset_name: 'Odog Coin' },
    { asset_symbol: 'BTC', asset_name: 'Bitcoin' },
  ],
}));

// ============================================
// 現在可以安全地 import
// ============================================

import reportView from '../../../../src/interactions/buttons/reportView.js';
import reportQuick from '../../../../src/interactions/buttons/reportQuick.js';
import { createMockButtonInteraction, createMockClient, createMockMessage } from '../../../helpers/discord-mocks.js';
import type { Services, Databases } from '../../../../src/interfaces/Command.js';

// Mock report data
const mockReportDataResult = {
  history: [
    { open: 100, high: 110, low: 95, close: 105, volume: 1000 },
  ],
  intervalLabel: '7d',
  latestOhlc: { open: 100, high: 110, low: 95, close: 105, volume: 1000 },
  change: 5,
  changePercent: 5,
  totalChangeValue: 5,
  generatedAt: 1234567890,
};

// Mock translations
const mockTranslations = {
  'en-US': {
    responses: {
      report_title: '{{assetName}} Report',
      last_updated: 'Last updated: <t:{{timestamp}}:R>',
      button_price_analysis: 'Price Analysis',
      button_detailed_price: 'Detailed Price',
      button_volume_analysis: 'Volume Analysis',
      chart_description: '{{assetName}} Chart',
      error_fetching: 'Error fetching data',
      no_data: 'No data for {{symbol}}',
      chart_error: 'Chart error',
      report_stale: 'Report is stale',
    },
  },
  'zh-TW': {
    responses: {
      report_title: '{{assetName}} 報告',
      last_updated: '最後更新: <t:{{timestamp}}:R>',
      button_price_analysis: '價格分析',
      button_detailed_price: '詳細價格',
      button_volume_analysis: '成交量分析',
      chart_description: '{{assetName}} 圖表',
      error_fetching: '獲取數據錯誤',
      no_data: '{{symbol}} 沒有數據',
      chart_error: '圖表錯誤',
      report_stale: '報告已過期',
    },
  },
};

describe('reportView', () => {
  let mockServices: Services;
  let mockDatabases: Databases;

  beforeEach(() => {
    vi.clearAllMocks();

    mockServices = {
      localizationManager: {
        get: vi.fn().mockReturnValue('translated'),
      },
      ticketManager: {},
      settingsManager: {},
      helpService: {},
      forumService: {},
      cacheService: {},
      storyForumService: {},
    } as unknown as Services;

    mockDatabases = {} as Databases;

    mockGetReportData.mockResolvedValue(mockReportDataResult);
    mockGetLocalizations.mockReturnValue(mockTranslations);
    mockBuildSummaryText.mockReturnValue({ type: 10, content: 'Summary text' });
    mockGetChartPath.mockReturnValue('/tmp/chart.png');
  });

  describe('name', () => {
    it('should have correct button name', () => {
      expect(reportView.name).toBe('reportView');
    });
  });

  describe('execute', () => {
    it('should reject unauthorized user', async () => {
      // Arrange
      const interaction = createMockButtonInteraction({
        customId: 'report-price-ODOG-7d-1234567890',
      });
      // Set different user
      (interaction.message as any).interaction = {
        user: { id: 'original-user-123' },
      };
      const client = createMockClient();

      // Act
      await reportView.execute(interaction, client, mockServices, mockDatabases);

      // Assert
      expect(interaction.reply).toHaveBeenCalled();
    });

    it('should switch to price view', async () => {
      // Arrange
      const interaction = createMockButtonInteraction({
        customId: 'report-price-ODOG-7d-1234567890',
      });
      (interaction.message as any).interaction = {
        user: { id: interaction.user.id },
      };
      // Mock container component
      (interaction.message as any).components = [
        {
          type: ComponentType.Container,
          toJSON: () => ({
            type: 17,
            components: [
              { type: 10, content: 'Title' },
              { type: 10, content: 'Last updated: <t:123:R>' },
            ],
          }),
        },
      ];
      (interaction.message as any).attachments = {
        first: () => ({ url: 'https://example.com/chart.png' }),
        map: () => [{ id: '123' }],
      };
      const client = createMockClient();

      // Act
      await reportView.execute(interaction, client, mockServices, mockDatabases);

      // Assert
      expect(interaction.deferUpdate).toHaveBeenCalled();
      expect(mockGetReportData).toHaveBeenCalledWith('ODOG', '7d', mockServices);
    });

    it('should handle stale data', async () => {
      // Arrange
      const oldTimestamp = '1234567889'; // Different from generatedAt
      const interaction = createMockButtonInteraction({
        customId: `report-price-ODOG-7d-${oldTimestamp}`,
      });
      (interaction.message as any).interaction = {
        user: { id: interaction.user.id },
      };
      (interaction.message as any).components = [
        {
          type: ComponentType.Container,
          toJSON: () => ({
            type: 17,
            components: [
              { type: 10, content: 'Last updated: <t:123:R>' },
            ],
          }),
        },
      ];
      (interaction.message as any).attachments = {
        first: () => ({ url: 'https://example.com/chart.png' }),
        map: () => [{ id: '123' }],
      };
      const client = createMockClient();

      // Act
      await reportView.execute(interaction, client, mockServices, mockDatabases);

      // Assert
      // When data is stale, the interaction is processed and deferUpdate is called
      expect(interaction.deferUpdate).toHaveBeenCalled();
    });

    it('should handle no data', async () => {
      // Arrange
      mockGetReportData.mockResolvedValue(null);
      const interaction = createMockButtonInteraction({
        customId: 'report-price-ODOG-7d-1234567890',
      });
      (interaction.message as any).interaction = {
        user: { id: interaction.user.id },
      };
      (interaction.message as any).components = [
        {
          type: ComponentType.Container,
          toJSON: () => ({
            type: 17,
            components: [],
          }),
        },
      ];
      const client = createMockClient();

      // Act
      await reportView.execute(interaction, client, mockServices, mockDatabases);

      // Assert
      expect(interaction.followUp).toHaveBeenCalledWith(
        expect.objectContaining({
          content: mockTranslations['en-US'].responses.error_fetching,
          flags: MessageFlags.Ephemeral,
        })
      );
    });

    it('should handle errors via errorHandler', async () => {
      // Arrange
      mockGetReportData.mockRejectedValue(new Error('API error'));
      const interaction = createMockButtonInteraction({
        customId: 'report-price-ODOG-7d-1234567890',
      });
      (interaction.message as any).interaction = {
        user: { id: interaction.user.id },
      };
      const client = createMockClient();

      // Act
      await reportView.execute(interaction, client, mockServices, mockDatabases);

      // Assert
      expect(mockErrorHandler.handleInteractionError).toHaveBeenCalled();
    });
  });
});

describe('reportQuick', () => {
  let mockServices: Services;

  beforeEach(() => {
    vi.clearAllMocks();

    mockServices = {
      localizationManager: {
        get: vi.fn().mockReturnValue('translated'),
      },
      ticketManager: {},
      settingsManager: {},
      helpService: {},
      forumService: {},
      cacheService: {},
      storyForumService: {},
    } as unknown as Services;

    mockGetReportData.mockResolvedValue(mockReportDataResult);
    mockGetLocalizations.mockReturnValue(mockTranslations);
    mockGenerateCandlestickChart.mockResolvedValue(Buffer.from('chart'));
    mockSaveChart.mockResolvedValue('/tmp/chart.png');
    mockBuildSummaryText.mockReturnValue({ type: 10, content: 'Summary text' });
    mockCreateStockSelectMenu.mockReturnValue({ type: 3, customId: 'stock_select' });
  });

  describe('name', () => {
    it('should have correct button name', () => {
      expect(reportQuick.name).toBe('report-quick');
    });
  });

  describe('execute', () => {
    it('should generate quick report', async () => {
      // Arrange
      const interaction = createMockButtonInteraction({
        customId: 'report-quick-ODOG',
      });
      const client = createMockClient();

      // Act
      await reportQuick.execute(interaction, mockServices as any);

      // Assert
      expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: false });
      expect(mockGetReportData).toHaveBeenCalledWith('ODOG', '7d', mockServices);
      expect(mockGenerateCandlestickChart).toHaveBeenCalled();
      expect(mockSaveChart).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          components: expect.any(Array),
          files: expect.any(Array),
          flags: MessageFlags.IsComponentsV2,
        })
      );
    });

    it('should handle no data', async () => {
      // Arrange
      mockGetReportData.mockResolvedValue(null);
      const interaction = createMockButtonInteraction({
        customId: 'report-quick-INVALID',
      });

      // Act
      await reportQuick.execute(interaction, mockServices as any);

      // Assert
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('INVALID'),
        })
      );
    });

    it('should handle chart generation failure', async () => {
      // Arrange
      mockSaveChart.mockResolvedValue(null);
      const interaction = createMockButtonInteraction({
        customId: 'report-quick-ODOG',
      });

      // Act
      await reportQuick.execute(interaction, mockServices as any);

      // Assert
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: mockTranslations['en-US'].responses.chart_error,
        })
      );
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      mockGetReportData.mockRejectedValue(new Error('API error'));
      const interaction = createMockButtonInteraction({
        customId: 'report-quick-ODOG',
      });

      // Act
      await reportQuick.execute(interaction, mockServices as any);

      // Assert
      expect(mockLoggerError).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('未預期的錯誤'),
        })
      );
    });

    it('should use default range of 7d', async () => {
      // Arrange
      const interaction = createMockButtonInteraction({
        customId: 'report-quick-ODOG',
      });

      // Act
      await reportQuick.execute(interaction, mockServices as any);

      // Assert
      expect(mockGetReportData).toHaveBeenCalledWith('ODOG', '7d', mockServices);
    });
  });
});
