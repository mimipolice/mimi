/**
 * claimTicket 單元測試
 *
 * 測試範圍：
 * - execute(): 處理認領工單按鈕點擊
 * - 成功認領後更新訊息並回覆
 * - 錯誤處理：BusinessError、一般錯誤
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// Mock 設定 - 使用 vi.hoisted 確保持久化
// ============================================

const {
  mockClaim,
  mockLoggerError,
  mockLoggerWarn,
  mockGetInteractionLocale,
  mockBuildTicketActionRow,
} = vi.hoisted(() => ({
  mockClaim: vi.fn(),
  mockLoggerError: vi.fn(),
  mockLoggerWarn: vi.fn(),
  mockGetInteractionLocale: vi.fn().mockReturnValue('zh-TW'),
  mockBuildTicketActionRow: vi.fn().mockReturnValue({ type: 1, components: [] }),
}));

// Mock logger
vi.mock('../../../../src/utils/logger.js', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: mockLoggerWarn,
    error: mockLoggerError,
  },
}));

// Mock localeHelper
vi.mock('../../../../src/utils/localeHelper.js', () => ({
  getInteractionLocale: mockGetInteractionLocale,
}));

// Mock DiscordService
vi.mock('../../../../src/services/DiscordService.js', () => ({
  DiscordService: {
    buildTicketActionRow: mockBuildTicketActionRow,
  },
}));

// Mock interactionReply
vi.mock('../../../../src/utils/interactionReply.js', () => ({
  createBusinessErrorReply: vi.fn().mockReturnValue({
    content: 'Business error occurred',
    flags: 64,
  }),
}));

// ============================================
// 現在可以安全地 import
// ============================================

import claimTicket from '../../../../src/interactions/buttons/claimTicket.js';
import { createMockButtonInteraction, createMockClient, createMockMessage } from '../../../helpers/discord-mocks.js';
import type { Services } from '../../../../src/interfaces/Command.js';
import { ComponentType } from 'discord.js';

describe('claimTicket', () => {
  let mockServices: Services;

  beforeEach(() => {
    vi.clearAllMocks();

    mockServices = {
      localizationManager: {
        get: vi.fn().mockReturnValue('translated'),
      },
      ticketManager: {
        claim: mockClaim,
      },
      settingsManager: {},
      helpService: {},
      forumService: {},
      cacheService: {},
      storyForumService: {},
    } as unknown as Services;

    mockClaim.mockResolvedValue(undefined);
  });

  describe('name', () => {
    it('should have correct button name', () => {
      expect(claimTicket.name).toBe('claim_ticket');
    });
  });

  describe('execute', () => {
    it('should claim ticket successfully and reply', async () => {
      // Arrange
      const interaction = createMockButtonInteraction({
        customId: 'claim_ticket',
      });
      // Set up message with no Components V2
      (interaction.message as any).components = [];
      const client = createMockClient();

      // Act
      await claimTicket.execute(interaction, client, mockServices);

      // Assert
      expect(mockClaim).toHaveBeenCalledWith(interaction);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'translated', // from localizationManager.get
          flags: 64, // Ephemeral
        })
      );
    });

    it('should update message with new components when Components V2 is used', async () => {
      // Arrange
      const interaction = createMockButtonInteraction({
        customId: 'claim_ticket',
      });
      // Mock message with ActionRow containing claim button
      (interaction.message as any).components = [
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.Button,
              customId: 'claim_ticket',
            },
          ],
        },
      ];
      const client = createMockClient();

      // Act
      await claimTicket.execute(interaction, client, mockServices);

      // Assert
      expect(mockClaim).toHaveBeenCalled();
      expect(mockBuildTicketActionRow).toHaveBeenCalled();
    });

    it('should handle BusinessError and reply with error message', async () => {
      // Arrange
      const interaction = createMockButtonInteraction({
        customId: 'claim_ticket',
      });
      (interaction.message as any).components = [];
      // Import BusinessError dynamically to match the module's behavior
      const { BusinessError } = await import('../../../../src/errors/index.js');
      mockClaim.mockRejectedValue(new BusinessError('Ticket already claimed'));
      const client = createMockClient();

      // Act
      await claimTicket.execute(interaction, client, mockServices);

      // Assert
      // The handler calls createBusinessErrorReply and passes result to reply
      expect(interaction.reply).toHaveBeenCalled();
    });

    it('should handle general error and log it', async () => {
      // Arrange
      const interaction = createMockButtonInteraction({
        customId: 'claim_ticket',
      });
      (interaction.message as any).components = [];
      const error = new Error('Database connection failed');
      mockClaim.mockRejectedValue(error);
      const client = createMockClient();

      // Act
      await claimTicket.execute(interaction, client, mockServices);

      // Assert
      expect(mockLoggerError).toHaveBeenCalledWith(
        'Error in claimTicket:',
        expect.objectContaining({
          error,
          userId: interaction.user.id,
        })
      );
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'translated', // claimError translation
          flags: 64,
        })
      );
    });

    it('should not try to reply if already replied', async () => {
      // Arrange
      const interaction = createMockButtonInteraction({
        customId: 'claim_ticket',
        replied: true,
      });
      (interaction.message as any).components = [];
      mockClaim.mockRejectedValue(new Error('Some error'));
      const client = createMockClient();

      // Act
      await claimTicket.execute(interaction, client, mockServices);

      // Assert
      // Should log error but not try to reply again
      expect(mockLoggerError).toHaveBeenCalled();
    });

    it('should handle Container component type for Components V2', async () => {
      // Arrange
      const interaction = createMockButtonInteraction({
        customId: 'claim_ticket',
      });
      // Mock message with Container (Components V2)
      (interaction.message as any).components = [
        {
          type: 17, // ComponentType.Container
          components: [],
          toJSON: () => ({ type: 17, components: [] }),
        },
      ];
      const client = createMockClient();

      // Act
      await claimTicket.execute(interaction, client, mockServices);

      // Assert
      expect(mockClaim).toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalled();
    });

    it('should warn when message edit fails but continue', async () => {
      // Arrange
      const interaction = createMockButtonInteraction({
        customId: 'claim_ticket',
      });
      // Set up message with ActionRow
      const mockMessage = createMockMessage();
      (mockMessage.edit as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Edit failed'));
      (interaction.message as any) = mockMessage;
      (interaction.message as any).components = [
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.Button,
              customId: 'claim_ticket',
            },
          ],
        },
      ];
      // Mock channel.send
      (interaction.channel as any).isTextBased = vi.fn().mockReturnValue(true);
      (interaction.channel as any).send = vi.fn().mockResolvedValue({});
      const client = createMockClient();

      // Act
      await claimTicket.execute(interaction, client, mockServices);

      // Assert
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        'Failed to edit original message:',
        expect.any(Error)
      );
      // Should still reply with success
      expect(interaction.reply).toHaveBeenCalled();
    });
  });
});
