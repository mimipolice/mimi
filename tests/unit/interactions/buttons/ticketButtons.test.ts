/**
 * Ticket Buttons 單元測試
 *
 * 合併測試 confirmCloseRequest 和 cancelCloseRequest
 *
 * 測試範圍：
 * - confirmCloseRequest: 確認關閉請求，顯示關閉原因 Modal
 * - cancelCloseRequest: 取消關閉請求，移除按鈕
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// Mock 設定 - 使用 vi.hoisted 確保持久化
// ============================================

const { mockFindTicketByChannel } = vi.hoisted(() => ({
  mockFindTicketByChannel: vi.fn(),
}));

// Mock logger
vi.mock('../../../../src/utils/logger.js', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ============================================
// 現在可以安全地 import
// ============================================

import confirmCloseRequest from '../../../../src/interactions/buttons/confirmCloseRequest.js';
import cancelCloseRequest from '../../../../src/interactions/buttons/cancelCloseRequest.js';
import { createMockButtonInteraction, createMockClient, createMockMessage } from '../../../helpers/discord-mocks.js';
import { FIXTURE_OPEN_TICKET, FIXTURE_CLAIMED_TICKET } from '../../../fixtures/tickets.js';
import type { Services } from '../../../../src/interfaces/Command.js';

describe('confirmCloseRequest', () => {
  let mockServices: Services;

  beforeEach(() => {
    vi.clearAllMocks();

    mockServices = {
      localizationManager: {
        get: vi.fn().mockReturnValue('translated'),
      },
      ticketManager: {
        findTicketByChannel: mockFindTicketByChannel,
      },
      settingsManager: {},
      helpService: {},
      forumService: {},
      cacheService: {},
      storyForumService: {},
    } as unknown as Services;
  });

  describe('name', () => {
    it('should have correct button name', () => {
      expect(confirmCloseRequest.name).toBe('confirm_close_request');
    });
  });

  describe('execute', () => {
    it('should show modal when ticket owner confirms', async () => {
      // Arrange
      mockFindTicketByChannel.mockResolvedValue(FIXTURE_OPEN_TICKET);
      const interaction = createMockButtonInteraction({
        customId: `confirm_close_request:${FIXTURE_OPEN_TICKET.ownerId}`,
        userId: FIXTURE_OPEN_TICKET.ownerId,
        channelId: FIXTURE_OPEN_TICKET.channelId,
      });
      const client = createMockClient();

      // Act
      await confirmCloseRequest.execute(interaction, client, mockServices);

      // Assert
      expect(interaction.showModal).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            custom_id: 'close_ticket_modal',
          }),
        })
      );
    });

    it('should show modal when claimed staff confirms', async () => {
      // Arrange
      mockFindTicketByChannel.mockResolvedValue(FIXTURE_CLAIMED_TICKET);
      const interaction = createMockButtonInteraction({
        customId: `confirm_close_request:${FIXTURE_CLAIMED_TICKET.ownerId}`,
        userId: FIXTURE_CLAIMED_TICKET.claimedById!, // Staff who claimed
        channelId: FIXTURE_CLAIMED_TICKET.channelId,
      });
      const client = createMockClient();

      // Act
      await confirmCloseRequest.execute(interaction, client, mockServices);

      // Assert
      expect(interaction.showModal).toHaveBeenCalled();
    });

    it('should reject when ticket not found', async () => {
      // Arrange
      mockFindTicketByChannel.mockResolvedValue(null);
      const interaction = createMockButtonInteraction({
        customId: 'confirm_close_request:user123',
      });
      const client = createMockClient();

      // Act
      await confirmCloseRequest.execute(interaction, client, mockServices);

      // Assert
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          ephemeral: true,
        })
      );
      expect(interaction.showModal).not.toHaveBeenCalled();
    });

    it('should reject when user is not authorized', async () => {
      // Arrange
      mockFindTicketByChannel.mockResolvedValue(FIXTURE_OPEN_TICKET);
      const interaction = createMockButtonInteraction({
        customId: `confirm_close_request:${FIXTURE_OPEN_TICKET.ownerId}`,
        userId: 'unauthorized-user-id',
        channelId: FIXTURE_OPEN_TICKET.channelId,
      });
      const client = createMockClient();

      // Act
      await confirmCloseRequest.execute(interaction, client, mockServices);

      // Assert
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          ephemeral: true,
        })
      );
      expect(interaction.showModal).not.toHaveBeenCalled();
    });
  });
});

describe('cancelCloseRequest', () => {
  let mockServices: Services;

  beforeEach(() => {
    vi.clearAllMocks();

    mockServices = {
      localizationManager: {
        get: vi.fn().mockReturnValue('translated'),
      },
      ticketManager: {
        findTicketByChannel: mockFindTicketByChannel,
      },
      settingsManager: {},
      helpService: {},
      forumService: {},
      cacheService: {},
      storyForumService: {},
    } as unknown as Services;
  });

  describe('name', () => {
    it('should have correct button name', () => {
      expect(cancelCloseRequest.name).toBe('cancel_close_request');
    });
  });

  describe('execute', () => {
    it('should cancel request and reply with embed when owner cancels', async () => {
      // Arrange
      mockFindTicketByChannel.mockResolvedValue(FIXTURE_OPEN_TICKET);
      const interaction = createMockButtonInteraction({
        customId: `cancel_close_request:${FIXTURE_OPEN_TICKET.ownerId}`,
        userId: FIXTURE_OPEN_TICKET.ownerId,
        channelId: FIXTURE_OPEN_TICKET.channelId,
      });
      const client = createMockClient();

      // Act
      await cancelCloseRequest.execute(interaction, client, mockServices);

      // Assert
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array),
        })
      );
      expect(interaction.message.edit).toHaveBeenCalledWith({
        components: [],
      });
    });

    it('should allow claimed staff to cancel request', async () => {
      // Arrange
      mockFindTicketByChannel.mockResolvedValue(FIXTURE_CLAIMED_TICKET);
      const interaction = createMockButtonInteraction({
        customId: `cancel_close_request:${FIXTURE_CLAIMED_TICKET.ownerId}`,
        userId: FIXTURE_CLAIMED_TICKET.claimedById!,
        channelId: FIXTURE_CLAIMED_TICKET.channelId,
      });
      const client = createMockClient();

      // Act
      await cancelCloseRequest.execute(interaction, client, mockServices);

      // Assert
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array),
        })
      );
    });

    it('should reject when ticket not found', async () => {
      // Arrange
      mockFindTicketByChannel.mockResolvedValue(null);
      const interaction = createMockButtonInteraction({
        customId: 'cancel_close_request:user123',
      });
      const client = createMockClient();

      // Act
      await cancelCloseRequest.execute(interaction, client, mockServices);

      // Assert
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          ephemeral: true,
        })
      );
    });

    it('should reject when user is not authorized', async () => {
      // Arrange
      mockFindTicketByChannel.mockResolvedValue(FIXTURE_OPEN_TICKET);
      const interaction = createMockButtonInteraction({
        customId: `cancel_close_request:${FIXTURE_OPEN_TICKET.ownerId}`,
        userId: 'unauthorized-user-id',
        channelId: FIXTURE_OPEN_TICKET.channelId,
      });
      const client = createMockClient();

      // Act
      await cancelCloseRequest.execute(interaction, client, mockServices);

      // Assert
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          ephemeral: true,
        })
      );
      expect(interaction.message.edit).not.toHaveBeenCalled();
    });

    it('should handle message edit error gracefully', async () => {
      // Arrange
      mockFindTicketByChannel.mockResolvedValue(FIXTURE_OPEN_TICKET);
      const interaction = createMockButtonInteraction({
        customId: `cancel_close_request:${FIXTURE_OPEN_TICKET.ownerId}`,
        userId: FIXTURE_OPEN_TICKET.ownerId,
        channelId: FIXTURE_OPEN_TICKET.channelId,
      });
      (interaction.message.edit as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Message deleted')
      );
      const client = createMockClient();

      // Act & Assert - should not throw
      await expect(
        cancelCloseRequest.execute(interaction, client, mockServices)
      ).resolves.toBeUndefined();
      expect(interaction.reply).toHaveBeenCalled();
    });
  });
});
