/**
 * closeTicketModal Modal Unit Tests
 *
 * Tests the close ticket modal handler which processes the close reason
 * and triggers the ticket closing workflow.
 *
 * Test coverage:
 * - Form value extraction (close_reason)
 * - Ticket manager close integration
 * - Close request button cleanup
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Collection } from 'discord.js';

// ============================================
// Mock Setup - use vi.hoisted for persistent mocks
// ============================================

const {
  mockTicketManagerClose,
  mockLoggerWarn,
  mockLoggerError,
} = vi.hoisted(() => ({
  mockTicketManagerClose: vi.fn(),
  mockLoggerWarn: vi.fn(),
  mockLoggerError: vi.fn(),
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

// ============================================
// Import after mocks
// ============================================

import closeTicketModal from '../../../../src/interactions/modals/closeTicketModal.js';
import {
  createMockModalSubmitInteraction,
  createMockTextChannel,
  createMockMessage,
} from '../../../helpers/discord-mocks.js';
import type { Services } from '../../../../src/interfaces/Command.js';

describe('closeTicketModal', () => {
  let mockServices: Services;

  beforeEach(() => {
    vi.clearAllMocks();

    mockTicketManagerClose.mockResolvedValue(undefined);

    mockServices = {
      localizationManager: {
        get: vi.fn((key: string) => key),
      },
      settingsManager: {} as any,
      ticketManager: {
        close: mockTicketManagerClose,
      },
      helpService: {} as any,
      forumService: {} as any,
      cacheService: {} as any,
      storyForumService: {} as any,
    } as unknown as Services;
  });

  // ============================================
  // Basic Properties
  // ============================================

  describe('handler properties', () => {
    it('should have correct name', () => {
      expect(closeTicketModal.name).toBe('close_ticket_modal');
    });

    it('should have execute function', () => {
      expect(typeof closeTicketModal.execute).toBe('function');
    });
  });

  // ============================================
  // Form Value Extraction Tests
  // ============================================

  describe('form value extraction', () => {
    it('should extract close_reason from form fields', async () => {
      // Arrange
      const interaction = createMockModalSubmitInteraction({
        customId: 'close_ticket_modal',
        userId: 'user123',
        fields: {
          close_reason: 'Issue has been resolved. Thank you for contacting us.',
        },
      });

      const mockChannel = createMockTextChannel();
      (mockChannel.messages.fetch as any).mockResolvedValue(new Collection());
      (interaction as any).channel = mockChannel;

      // Act
      await closeTicketModal.execute(interaction as any, mockServices);

      // Assert
      expect(mockTicketManagerClose).toHaveBeenCalledWith(
        interaction,
        'Issue has been resolved. Thank you for contacting us.'
      );
    });

    it('should handle empty close reason', async () => {
      // Arrange
      const interaction = createMockModalSubmitInteraction({
        customId: 'close_ticket_modal',
        userId: 'user123',
        fields: {
          close_reason: '',
        },
      });

      const mockChannel = createMockTextChannel();
      (mockChannel.messages.fetch as any).mockResolvedValue(new Collection());
      (interaction as any).channel = mockChannel;

      // Act
      await closeTicketModal.execute(interaction as any, mockServices);

      // Assert
      expect(mockTicketManagerClose).toHaveBeenCalledWith(interaction, '');
    });

    it('should handle multiline close reason', async () => {
      // Arrange
      const multilineReason = `Issue resolved.

Steps taken:
1. Reviewed the problem
2. Applied fix
3. Verified solution`;

      const interaction = createMockModalSubmitInteraction({
        customId: 'close_ticket_modal',
        userId: 'user123',
        fields: {
          close_reason: multilineReason,
        },
      });

      const mockChannel = createMockTextChannel();
      (mockChannel.messages.fetch as any).mockResolvedValue(new Collection());
      (interaction as any).channel = mockChannel;

      // Act
      await closeTicketModal.execute(interaction as any, mockServices);

      // Assert
      expect(mockTicketManagerClose).toHaveBeenCalledWith(interaction, multilineReason);
    });
  });

  // ============================================
  // Defer Reply Tests
  // ============================================

  describe('interaction deferral', () => {
    it('should defer reply before processing', async () => {
      // Arrange
      const interaction = createMockModalSubmitInteraction({
        customId: 'close_ticket_modal',
        userId: 'user123',
        fields: {
          close_reason: 'Resolved',
        },
      });

      const mockChannel = createMockTextChannel();
      (mockChannel.messages.fetch as any).mockResolvedValue(new Collection());
      (interaction as any).channel = mockChannel;

      // Act
      await closeTicketModal.execute(interaction as any, mockServices);

      // Assert
      expect(interaction.deferReply).toHaveBeenCalled();
    });
  });

  // ============================================
  // Close Request Button Cleanup Tests
  // ============================================

  describe('close request button cleanup', () => {
    it('should remove close request button from matching message', async () => {
      // Arrange
      const mockMessage = createMockMessage();
      (mockMessage as any).components = [
        {
          components: [
            { customId: 'confirm_close_request:123' },
          ],
        },
      ];

      const messagesCollection = new Collection<string, typeof mockMessage>();
      messagesCollection.set('msg-1', mockMessage);

      const mockChannel = createMockTextChannel();
      (mockChannel.messages.fetch as any).mockResolvedValue(messagesCollection);

      const interaction = createMockModalSubmitInteraction({
        customId: 'close_ticket_modal',
        userId: 'user123',
        fields: {
          close_reason: 'Resolved',
        },
      });
      (interaction as any).channel = mockChannel;

      // Act
      await closeTicketModal.execute(interaction as any, mockServices);

      // Assert
      expect(mockMessage.edit).toHaveBeenCalledWith({ components: [] });
    });

    it('should not edit message without close request button', async () => {
      // Arrange
      const mockMessage = createMockMessage();
      (mockMessage as any).components = [
        {
          components: [
            { customId: 'other_button' },
          ],
        },
      ];

      const messagesCollection = new Collection<string, typeof mockMessage>();
      messagesCollection.set('msg-1', mockMessage);

      const mockChannel = createMockTextChannel();
      (mockChannel.messages.fetch as any).mockResolvedValue(messagesCollection);

      const interaction = createMockModalSubmitInteraction({
        customId: 'close_ticket_modal',
        userId: 'user123',
        fields: {
          close_reason: 'Resolved',
        },
      });
      (interaction as any).channel = mockChannel;

      // Act
      await closeTicketModal.execute(interaction as any, mockServices);

      // Assert
      expect(mockMessage.edit).not.toHaveBeenCalled();
    });

    it('should handle empty components array', async () => {
      // Arrange
      const mockMessage = createMockMessage();
      (mockMessage as any).components = [];

      const messagesCollection = new Collection<string, typeof mockMessage>();
      messagesCollection.set('msg-1', mockMessage);

      const mockChannel = createMockTextChannel();
      (mockChannel.messages.fetch as any).mockResolvedValue(messagesCollection);

      const interaction = createMockModalSubmitInteraction({
        customId: 'close_ticket_modal',
        userId: 'user123',
        fields: {
          close_reason: 'Resolved',
        },
      });
      (interaction as any).channel = mockChannel;

      // Act
      await closeTicketModal.execute(interaction as any, mockServices);

      // Assert
      expect(mockMessage.edit).not.toHaveBeenCalled();
    });

    it('should continue even if button cleanup fails', async () => {
      // Arrange
      const mockChannel = createMockTextChannel();
      (mockChannel.messages.fetch as any).mockRejectedValue(new Error('Fetch failed'));

      const interaction = createMockModalSubmitInteraction({
        customId: 'close_ticket_modal',
        userId: 'user123',
        fields: {
          close_reason: 'Resolved',
        },
      });
      (interaction as any).channel = mockChannel;

      // Act
      await closeTicketModal.execute(interaction as any, mockServices);

      // Assert
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        'Failed to remove close request button:',
        expect.any(Error)
      );
      // Should still call ticketManager.close
      expect(mockTicketManagerClose).toHaveBeenCalled();
    });

    it('should handle null channel gracefully', async () => {
      // Arrange
      const interaction = createMockModalSubmitInteraction({
        customId: 'close_ticket_modal',
        userId: 'user123',
        fields: {
          close_reason: 'Resolved',
        },
      });
      (interaction as any).channel = null;

      // Act
      await closeTicketModal.execute(interaction as any, mockServices);

      // Assert
      // Should still call ticketManager.close
      expect(mockTicketManagerClose).toHaveBeenCalled();
    });
  });

  // ============================================
  // TicketManager Integration Tests
  // ============================================

  describe('ticket manager integration', () => {
    it('should pass interaction to ticketManager.close', async () => {
      // Arrange
      const interaction = createMockModalSubmitInteraction({
        customId: 'close_ticket_modal',
        userId: 'user123',
        fields: {
          close_reason: 'Done',
        },
      });

      const mockChannel = createMockTextChannel();
      (mockChannel.messages.fetch as any).mockResolvedValue(new Collection());
      (interaction as any).channel = mockChannel;

      // Act
      await closeTicketModal.execute(interaction as any, mockServices);

      // Assert
      expect(mockTicketManagerClose).toHaveBeenCalledWith(
        expect.objectContaining({
          customId: 'close_ticket_modal',
        }),
        'Done'
      );
    });
  });
});
