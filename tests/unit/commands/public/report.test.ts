/**
 * Report Command Unit Tests
 *
 * Tests for the /report command which generates asset price reports.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Locale } from 'discord.js';

// ============================================
// Mock Setup - Use vi.hoisted for persistence
// ============================================

const {
  mockDeferReply,
  mockEditReply,
  mockGetOhlcPriceHistory,
  mockGenerateCandlestickChart,
  mockCacheGet,
  mockCacheSet,
  mockSaveChart,
} = vi.hoisted(() => ({
  mockDeferReply: vi.fn().mockResolvedValue(undefined),
  mockEditReply: vi.fn().mockResolvedValue(undefined),
  mockGetOhlcPriceHistory: vi.fn(),
  mockGenerateCandlestickChart: vi.fn(),
  mockCacheGet: vi.fn(),
  mockCacheSet: vi.fn(),
  mockSaveChart: vi.fn(),
}));

// Mock asset repository
vi.mock('../../../../src/repositories/asset.repository.js', () => ({
  getOhlcPriceHistory: mockGetOhlcPriceHistory,
}));

// Mock chart generator
vi.mock('../../../../src/utils/chart-generator.js', () => ({
  generateCandlestickChart: mockGenerateCandlestickChart,
}));

// Mock localization
vi.mock('../../../../src/utils/localization.js', () => ({
  getLocalizations: vi.fn().mockReturnValue({
    'en-US': {
      responses: {
        asset_list: 'Available Assets',
        no_data: 'No data available for {{symbol}}',
        chart_error: 'Error generating chart',
        report_title: '{{assetName}} Report',
        last_updated: 'Last updated: <t:{{timestamp}}:R>',
        button_price_analysis: 'Price Analysis',
        button_detailed_price: 'Detailed Price',
        button_volume_analysis: 'Volume Analysis',
        chart_description: '{{assetName}} price chart',
      },
    },
    'zh-TW': {
      responses: {
        asset_list: '可選資產列表',
        no_data: '沒有 {{symbol}} 的資料',
        chart_error: '產生圖表時發生錯誤',
        report_title: '{{assetName}} 報告',
        last_updated: '最後更新: <t:{{timestamp}}:R>',
        button_price_analysis: '價格分析',
        button_detailed_price: '詳細價格',
        button_volume_analysis: '成交量分析',
        chart_description: '{{assetName}} 價格圖表',
      },
    },
  }),
}));

// Mock error handler
vi.mock('../../../../src/utils/errorHandler.js', () => ({
  errorHandler: {
    handleInteractionError: vi.fn(),
  },
}));

// Mock asset list config
vi.mock('../../../../src/config/asset-list.json', () => ({
  default: [
    { asset_symbol: 'BTC', asset_name: 'Bitcoin' },
    { asset_symbol: 'ETH', asset_name: 'Ethereum' },
    { asset_symbol: 'AAPL', asset_name: 'Apple Inc.' },
  ],
}));

// Mock ChartCacheService
vi.mock('../../../../src/services/ChartCacheService.js', () => ({
  ChartCacheService: vi.fn().mockImplementation(() => ({
    saveChart: mockSaveChart,
  })),
}));

// Mock asset price cache repository
vi.mock('../../../../src/repositories/asset-price-cache.repository.js', () => ({
  getAllAssetsWithPriceChange: vi.fn().mockResolvedValue([
    { asset_symbol: 'BTC', change_percent: 2.5 },
    { asset_symbol: 'ETH', change_percent: -1.2 },
  ]),
}));

// Mock stock select menu
vi.mock('../../../../src/interactions/selectMenus/stockSelect.js', () => ({
  createStockSelectMenu: vi.fn().mockReturnValue({
    type: 1,
    components: [],
  }),
}));

// ============================================
// Import command after mocks are set up
// ============================================

import reportCommand from '../../../../src/commands/public/report/index.js';

// ============================================
// Test Helpers
// ============================================

function createMockInteraction(overrides: Record<string, any> = {}) {
  return {
    commandName: 'report',
    user: { id: 'user123', tag: 'TestUser#0001' },
    guild: { id: 'guild123' },
    guildId: 'guild123',
    channelId: 'channel123',
    locale: Locale.EnglishUS,
    deferReply: mockDeferReply,
    editReply: mockEditReply,
    replied: false,
    deferred: false,
    isChatInputCommand: () => true,
    options: {
      getString: vi.fn().mockImplementation((name: string, required?: boolean) => {
        if (name === 'symbol') return 'BTC';
        if (name === 'range') return '7d';
        return null;
      }),
      getInteger: vi.fn(),
      getUser: vi.fn(),
      getSubcommand: vi.fn().mockReturnValue('symbol'),
    },
    ...overrides,
  };
}

function createMockClient() {
  return {
    ws: { ping: 42 },
    user: { id: 'bot123', username: 'MimiBot' },
  };
}

function createMockServices() {
  return {
    localizationManager: {
      get: vi.fn().mockReturnValue('translated_text'),
      getAvailableLanguages: vi.fn().mockReturnValue(['en-US', 'zh-TW']),
      getLocale: vi.fn(),
    },
    settingsManager: {},
    ticketManager: {},
    helpService: {},
    forumService: {},
    cacheService: {
      get: mockCacheGet,
      set: mockCacheSet,
    },
    storyForumService: {},
  };
}

function createMockOhlcData() {
  const now = new Date();
  return {
    ohlcData: [
      { timestamp: new Date(now.getTime() - 86400000 * 2), open: 100, high: 105, low: 95, close: 102, volume: 1000 },
      { timestamp: new Date(now.getTime() - 86400000), open: 102, high: 110, low: 100, close: 108, volume: 1200 },
      { timestamp: now, open: 108, high: 115, low: 105, close: 112, volume: 1500 },
    ],
    rawDataPointCount: 100,
  };
}

// ============================================
// Tests
// ============================================

describe('Report Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOhlcPriceHistory.mockResolvedValue(createMockOhlcData());
    mockGenerateCandlestickChart.mockResolvedValue(Buffer.from('fake-image'));
    mockCacheGet.mockResolvedValue(null);
    mockSaveChart.mockResolvedValue('/tmp/chart.png');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Command Data', () => {
    it('should have correct command name', () => {
      expect(reportCommand.data.name).toBe('report');
    });

    it('should have description', () => {
      expect(reportCommand.data.description).toBe('Generates a report or lists available assets.');
    });

    it('should have Chinese localization', () => {
      const descLocalizations = reportCommand.data.toJSON().description_localizations;
      expect(descLocalizations?.['zh-TW']).toBe('產生報告或列出可用的資產。');
    });

    it('should have symbol subcommand', () => {
      const json = reportCommand.data.toJSON();
      const options = json.options || [];
      const symbolSubcommand = options.find((opt: any) => opt.name === 'symbol');
      expect(symbolSubcommand).toBeDefined();
    });

    it('should have list subcommand', () => {
      const json = reportCommand.data.toJSON();
      const options = json.options || [];
      const listSubcommand = options.find((opt: any) => opt.name === 'list');
      expect(listSubcommand).toBeDefined();
    });
  });

  describe('execute() - symbol subcommand', () => {
    it('should defer reply on execute', async () => {
      const interaction = createMockInteraction();
      const client = createMockClient();
      const services = createMockServices();

      await reportCommand.execute(
        interaction as any,
        client as any,
        services as any,
        {} as any
      );

      expect(mockDeferReply).toHaveBeenCalled();
    });

    it('should not defer if already deferred', async () => {
      const interaction = createMockInteraction({
        deferred: true,
      });
      const client = createMockClient();
      const services = createMockServices();

      await reportCommand.execute(
        interaction as any,
        client as any,
        services as any,
        {} as any
      );

      expect(mockDeferReply).not.toHaveBeenCalled();
    });

    it('should fetch OHLC price history', async () => {
      const interaction = createMockInteraction();
      const client = createMockClient();
      const services = createMockServices();

      await reportCommand.execute(
        interaction as any,
        client as any,
        services as any,
        {} as any
      );

      expect(mockGetOhlcPriceHistory).toHaveBeenCalledWith('BTC', '7d', expect.any(Number));
    });

    it('should reply with no data message when insufficient history', async () => {
      mockGetOhlcPriceHistory.mockResolvedValue({
        ohlcData: [{ timestamp: new Date(), open: 100, high: 105, low: 95, close: 102, volume: 1000 }],
        rawDataPointCount: 1,
      });

      const interaction = createMockInteraction();
      const client = createMockClient();
      const services = createMockServices();

      await reportCommand.execute(
        interaction as any,
        client as any,
        services as any,
        {} as any
      );

      expect(mockEditReply).toHaveBeenCalledWith(
        expect.stringContaining('BTC')
      );
    });

    it('should generate candlestick chart', async () => {
      const interaction = createMockInteraction();
      const client = createMockClient();
      const services = createMockServices();

      await reportCommand.execute(
        interaction as any,
        client as any,
        services as any,
        {} as any
      );

      expect(mockGenerateCandlestickChart).toHaveBeenCalled();
    });

    it('should save chart to cache', async () => {
      const interaction = createMockInteraction();
      const client = createMockClient();
      const services = createMockServices();

      await reportCommand.execute(
        interaction as any,
        client as any,
        services as any,
        {} as any
      );

      expect(mockSaveChart).toHaveBeenCalled();
    });

    it('should use cached data if available', async () => {
      const cachedData = {
        generatedAt: Date.now(),
        history: createMockOhlcData().ohlcData,
        intervalLabel: '1h',
        latestOhlc: { timestamp: new Date(), open: 108, high: 115, low: 105, close: 112, volume: 1500 },
        change: 4,
        changePercent: 3.7,
        totalChangeValue: 12,
        startPrice: 100,
        endPrice: 112,
      };
      mockCacheGet.mockResolvedValue(cachedData);

      const interaction = createMockInteraction();
      const client = createMockClient();
      const services = createMockServices();

      await reportCommand.execute(
        interaction as any,
        client as any,
        services as any,
        {} as any
      );

      // Should not fetch from database when cache hit
      expect(mockGetOhlcPriceHistory).not.toHaveBeenCalled();
    });

    it('should use default range of 7d when not specified', async () => {
      const interaction = createMockInteraction({
        options: {
          getString: vi.fn().mockImplementation((name: string) => {
            if (name === 'symbol') return 'BTC';
            return null; // range not specified
          }),
          getSubcommand: vi.fn().mockReturnValue('symbol'),
        },
      });
      const client = createMockClient();
      const services = createMockServices();

      await reportCommand.execute(
        interaction as any,
        client as any,
        services as any,
        {} as any
      );

      expect(mockGetOhlcPriceHistory).toHaveBeenCalledWith('BTC', '7d', expect.any(Number));
    });

    it('should handle chart generation error', async () => {
      mockSaveChart.mockResolvedValue(null);

      const interaction = createMockInteraction();
      const client = createMockClient();
      const services = createMockServices();

      await reportCommand.execute(
        interaction as any,
        client as any,
        services as any,
        {} as any
      );

      expect(mockEditReply).toHaveBeenCalled();
    });
  });

  describe('execute() - list subcommand', () => {
    it('should display asset list with price changes', async () => {
      const interaction = createMockInteraction({
        options: {
          getString: vi.fn(),
          getSubcommand: vi.fn().mockReturnValue('list'),
        },
      });
      const client = createMockClient();
      const services = createMockServices();

      await reportCommand.execute(
        interaction as any,
        client as any,
        services as any,
        {} as any
      );

      expect(mockEditReply).toHaveBeenCalledWith(
        expect.objectContaining({
          components: expect.any(Array),
        })
      );
    });
  });

  describe('autocomplete()', () => {
    it('should respond with filtered asset list', async () => {
      const mockRespond = vi.fn();
      const interaction = {
        options: {
          getFocused: vi.fn().mockReturnValue('bit'),
        },
        respond: mockRespond,
      };

      await reportCommand.autocomplete(interaction as any);

      expect(mockRespond).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: expect.stringContaining('Bitcoin'),
            value: 'BTC',
          }),
        ])
      );
    });

    it('should limit autocomplete results to 25', async () => {
      const mockRespond = vi.fn();
      const interaction = {
        options: {
          getFocused: vi.fn().mockReturnValue(''),
        },
        respond: mockRespond,
      };

      await reportCommand.autocomplete(interaction as any);

      const calledWith = mockRespond.mock.calls[0][0];
      expect(calledWith.length).toBeLessThanOrEqual(25);
    });

    it('should match by symbol case-insensitively', async () => {
      const mockRespond = vi.fn();
      const interaction = {
        options: {
          getFocused: vi.fn().mockReturnValue('BTC'),
        },
        respond: mockRespond,
      };

      await reportCommand.autocomplete(interaction as any);

      expect(mockRespond).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            value: 'BTC',
          }),
        ])
      );
    });
  });
});
