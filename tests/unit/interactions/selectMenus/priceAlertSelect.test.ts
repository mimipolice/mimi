/**
 * priceAlertSelect Select Menu Unit Tests
 *
 * Tests the price alert select menu handler which creates price alerts
 * when a user selects an asset from the dropdown.
 *
 * Test coverage:
 * - Authorization checks (originalUserId validation)
 * - Parameter parsing (condition, targetPrice, symbol)
 * - Asset validation
 * - Price alert creation
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// Mock Setup - use vi.hoisted for persistent mocks
// ============================================

const {
  mockCreatePriceAlert,
  mockGetAllAssetsWithLatestPrice,
  mockFindNextAvailablePriceAlertId,
  mockLoggerError,
} = vi.hoisted(() => ({
  mockCreatePriceAlert: vi.fn(),
  mockGetAllAssetsWithLatestPrice: vi.fn(),
  mockFindNextAvailablePriceAlertId: vi.fn(),
  mockLoggerError: vi.fn(),
}));

// Mock asset repository
vi.mock('../../../../src/repositories/asset.repository.js', () => ({
  createPriceAlert: mockCreatePriceAlert,
  getAllAssetsWithLatestPrice: mockGetAllAssetsWithLatestPrice,
  findNextAvailablePriceAlertId: mockFindNextAvailablePriceAlertId,
}));

// Mock file system for asset list
vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn(() => `
- asset_symbol: TSLA
  asset_name: Tesla
- asset_symbol: AAPL
  asset_name: Apple
- asset_symbol: GOOGL
  asset_name: Google
`),
  },
  readFileSync: vi.fn(() => `
- asset_symbol: TSLA
  asset_name: Tesla
- asset_symbol: AAPL
  asset_name: Apple
- asset_symbol: GOOGL
  asset_name: Google
`),
}));

// Mock js-yaml
vi.mock('js-yaml', () => ({
  default: {
    load: vi.fn(() => [
      { asset_symbol: 'TSLA', asset_name: 'Tesla' },
      { asset_symbol: 'AAPL', asset_name: 'Apple' },
      { asset_symbol: 'GOOGL', asset_name: 'Google' },
    ]),
  },
  load: vi.fn(() => [
    { asset_symbol: 'TSLA', asset_name: 'Tesla' },
    { asset_symbol: 'AAPL', asset_name: 'Apple' },
    { asset_symbol: 'GOOGL', asset_name: 'Google' },
  ]),
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

import priceAlertSelect from '../../../../src/interactions/selectMenus/priceAlertSelect.js';
import { createMockStringSelectMenuInteraction } from '../../../helpers/discord-mocks.js';
import type { Services } from '../../../../src/interfaces/Command.js';

describe('priceAlertSelect', () => {
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
    mockGetAllAssetsWithLatestPrice.mockResolvedValue([
      { asset_symbol: 'TSLA', price: 250.50 },
      { asset_symbol: 'AAPL', price: 175.25 },
      { asset_symbol: 'GOOGL', price: 140.00 },
    ]);
    mockFindNextAvailablePriceAlertId.mockResolvedValue(1);
    mockCreatePriceAlert.mockResolvedValue(undefined);
  });

  // ============================================
  // Basic Properties
  // ============================================

  describe('handler properties', () => {
    it('should have correct name', () => {
      expect(priceAlertSelect.name).toBe('pricealert-select');
    });

    it('should have execute function', () => {
      expect(typeof priceAlertSelect.execute).toBe('function');
    });
  });

  // ============================================
  // Authorization Tests
  // ============================================

  describe('authorization', () => {
    it('should reject unauthorized users when originalUserId does not match', async () => {
      // Arrange
      const interaction = createMockStringSelectMenuInteraction({
        customId: 'pricealert-select:above:100:user-original-123',
        values: ['TSLA'],
        userId: 'user-different-456',
      });

      // Act
      await priceAlertSelect.execute(interaction as any, mockServices);

      // Assert
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('not authorized'),
        })
      );
      expect(mockCreatePriceAlert).not.toHaveBeenCalled();
    });

    it('should allow authorized user when originalUserId matches', async () => {
      // Arrange
      const interaction = createMockStringSelectMenuInteraction({
        customId: 'pricealert-select:above:100:user123',
        values: ['TSLA'],
        userId: 'user123',
      });

      // Act
      await priceAlertSelect.execute(interaction as any, mockServices);

      // Assert
      expect(interaction.update).toHaveBeenCalled();
      expect(mockCreatePriceAlert).toHaveBeenCalled();
    });
  });

  // ============================================
  // Parameter Parsing Tests
  // ============================================

  describe('parameter parsing', () => {
    it('should parse condition correctly (above)', async () => {
      // Arrange
      const interaction = createMockStringSelectMenuInteraction({
        customId: 'pricealert-select:above:150:user123',
        values: ['TSLA'],
        userId: 'user123',
      });

      // Act
      await priceAlertSelect.execute(interaction as any, mockServices);

      // Assert
      expect(mockCreatePriceAlert).toHaveBeenCalledWith(
        1, // nextId from mockFindNextAvailablePriceAlertId
        'user123',
        'TSLA',
        'above',
        150,
        false,
        undefined // locale is undefined when not set on interaction
      );
    });

    it('should parse condition correctly (below)', async () => {
      // Arrange
      const interaction = createMockStringSelectMenuInteraction({
        customId: 'pricealert-select:below:200:user123',
        values: ['AAPL'],
        userId: 'user123',
      });

      // Act
      await priceAlertSelect.execute(interaction as any, mockServices);

      // Assert
      expect(mockCreatePriceAlert).toHaveBeenCalledWith(
        1, // nextId from mockFindNextAvailablePriceAlertId
        'user123',
        'AAPL',
        'below',
        200,
        false,
        undefined // locale is undefined when not set on interaction
      );
    });

    it('should parse decimal targetPrice correctly', async () => {
      // Arrange
      const interaction = createMockStringSelectMenuInteraction({
        customId: 'pricealert-select:above:123.45:user123',
        values: ['TSLA'],
        userId: 'user123',
      });

      // Act
      await priceAlertSelect.execute(interaction as any, mockServices);

      // Assert
      expect(mockCreatePriceAlert).toHaveBeenCalledWith(
        1, // nextId from mockFindNextAvailablePriceAlertId
        'user123',
        'TSLA',
        'above',
        123.45,
        false,
        undefined // locale is undefined when not set on interaction
      );
    });

    it('should show error when condition is missing', async () => {
      // Arrange
      const interaction = createMockStringSelectMenuInteraction({
        customId: 'pricealert-select::100:user123',
        values: ['TSLA'],
        userId: 'user123',
      });

      // Act
      await priceAlertSelect.execute(interaction as any, mockServices);

      // Assert
      expect(interaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('錯誤'),
          components: [],
        })
      );
      expect(mockCreatePriceAlert).not.toHaveBeenCalled();
    });

    it('should show error when targetPrice is NaN', async () => {
      // Arrange
      const interaction = createMockStringSelectMenuInteraction({
        customId: 'pricealert-select:above:invalid:user123',
        values: ['TSLA'],
        userId: 'user123',
      });

      // Act
      await priceAlertSelect.execute(interaction as any, mockServices);

      // Assert
      expect(interaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('錯誤'),
          components: [],
        })
      );
      expect(mockCreatePriceAlert).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // Asset Validation Tests
  // ============================================

  describe('asset validation', () => {
    it('should show error when asset is not found in list', async () => {
      // Arrange
      const interaction = createMockStringSelectMenuInteraction({
        customId: 'pricealert-select:above:100:user123',
        values: ['UNKNOWN'],
        userId: 'user123',
      });

      // Act
      await priceAlertSelect.execute(interaction as any, mockServices);

      // Assert
      expect(interaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('UNKNOWN'),
          components: [],
        })
      );
      expect(mockCreatePriceAlert).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // Price Alert Creation Tests
  // ============================================

  describe('price alert creation', () => {
    it('should create price alert with correct parameters', async () => {
      // Arrange
      mockFindNextAvailablePriceAlertId.mockResolvedValue(42);

      const interaction = createMockStringSelectMenuInteraction({
        customId: 'pricealert-select:above:300:user123',
        values: ['TSLA'],
        userId: 'user123',
      });
      (interaction as any).locale = 'zh-TW';

      // Act
      await priceAlertSelect.execute(interaction as any, mockServices);

      // Assert
      expect(mockCreatePriceAlert).toHaveBeenCalledWith(
        42,
        'user123',
        'TSLA',
        'above',
        300,
        false,
        'zh-TW'
      );
    });

    it('should show success message with current price when available', async () => {
      // Arrange
      mockGetAllAssetsWithLatestPrice.mockResolvedValue([
        { asset_symbol: 'TSLA', price: 250.50 },
      ]);

      const interaction = createMockStringSelectMenuInteraction({
        customId: 'pricealert-select:above:300:user123',
        values: ['TSLA'],
        userId: 'user123',
      });

      // Act
      await priceAlertSelect.execute(interaction as any, mockServices);

      // Assert
      expect(interaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('250.50'),
          components: [],
        })
      );
    });

    it('should show success message without current price when not available', async () => {
      // Arrange
      mockGetAllAssetsWithLatestPrice.mockResolvedValue([]);

      const interaction = createMockStringSelectMenuInteraction({
        customId: 'pricealert-select:above:300:user123',
        values: ['TSLA'],
        userId: 'user123',
      });

      // Act
      await priceAlertSelect.execute(interaction as any, mockServices);

      // Assert
      expect(interaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('尚無資料'),
          components: [],
        })
      );
    });

    it('should include asset name in success message', async () => {
      // Arrange
      const interaction = createMockStringSelectMenuInteraction({
        customId: 'pricealert-select:above:300:user123',
        values: ['TSLA'],
        userId: 'user123',
      });

      // Act
      await priceAlertSelect.execute(interaction as any, mockServices);

      // Assert
      expect(interaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Tesla'),
        })
      );
    });
  });

  // ============================================
  // Error Handling Tests
  // ============================================

  describe('error handling', () => {
    it('should log and show error message when exception occurs', async () => {
      // Arrange
      mockCreatePriceAlert.mockRejectedValue(new Error('Database error'));

      const interaction = createMockStringSelectMenuInteraction({
        customId: 'pricealert-select:above:300:user123',
        values: ['TSLA'],
        userId: 'user123',
      });

      // Act
      await priceAlertSelect.execute(interaction as any, mockServices);

      // Assert
      expect(mockLoggerError).toHaveBeenCalledWith(
        'Error executing price alert select menu (by <@user123> / user123):',
        expect.any(Error)
      );
      expect(interaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('錯誤'),
          components: [],
        })
      );
    });

    it('should handle getAllAssetsWithLatestPrice failure', async () => {
      // Arrange
      mockGetAllAssetsWithLatestPrice.mockRejectedValue(new Error('API error'));

      const interaction = createMockStringSelectMenuInteraction({
        customId: 'pricealert-select:above:300:user123',
        values: ['TSLA'],
        userId: 'user123',
      });

      // Act
      await priceAlertSelect.execute(interaction as any, mockServices);

      // Assert
      expect(mockLoggerError).toHaveBeenCalled();
      expect(interaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('錯誤'),
        })
      );
    });
  });
});
