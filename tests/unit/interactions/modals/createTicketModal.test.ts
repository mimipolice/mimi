/**
 * createTicketModal Modal Unit Tests
 *
 * Tests the create ticket modal handler which processes the issue description
 * and triggers the ticket creation workflow.
 *
 * Test coverage:
 * - Form value extraction (ticket_issue_description)
 * - Ticket type parsing from customId
 * - Description length validation
 * - Ticket manager create integration
 * - Error handling (including interaction token expiry)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// Mock Setup - use vi.hoisted for persistent mocks
// ============================================

const {
  mockTicketManagerCreate,
  mockLoggerWarn,
  mockLoggerError,
} = vi.hoisted(() => ({
  mockTicketManagerCreate: vi.fn(),
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

// Mock localeHelper
vi.mock('../../../../src/utils/localeHelper.js', () => ({
  getInteractionLocale: vi.fn(() => 'en-US'),
}));

// ============================================
// Import after mocks
// ============================================

import createTicketModal from '../../../../src/interactions/modals/createTicketModal.js';
import { createMockModalSubmitInteraction } from '../../../helpers/discord-mocks.js';
import type { Services } from '../../../../src/interfaces/Command.js';

describe('createTicketModal', () => {
  let mockServices: Services;

  beforeEach(() => {
    vi.clearAllMocks();

    mockTicketManagerCreate.mockResolvedValue(undefined);

    mockServices = {
      localizationManager: {
        get: vi.fn((key: string, _locale?: string, options?: Record<string, string | number>) => {
          const translations: Record<string, string> = {
            'global.ticket.descriptionTooLong': `Description too long: ${options?.length} characters (max 1024)`,
            'global.ticket.createError': 'Failed to create ticket. Please try again.',
          };
          return translations[key] ?? key;
        }),
      },
      settingsManager: {} as any,
      ticketManager: {
        create: mockTicketManagerCreate,
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
      expect(createTicketModal.name).toBe('create_ticket_modal');
    });

    it('should have execute function', () => {
      expect(typeof createTicketModal.execute).toBe('function');
    });
  });

  // ============================================
  // Form Value Extraction Tests
  // ============================================

  describe('form value extraction', () => {
    it('should extract ticket_issue_description from form fields', async () => {
      // Arrange
      const interaction = createMockModalSubmitInteraction({
        customId: 'create_ticket_modal:general',
        userId: 'user123',
        fields: {
          ticket_issue_description: 'I need help with my account settings.',
        },
      });

      // Act
      await createTicketModal.execute(interaction as any, mockServices);

      // Assert
      expect(mockTicketManagerCreate).toHaveBeenCalledWith(
        interaction,
        'I need help with my account settings.',
        'general'
      );
    });

    it('should handle multiline issue description', async () => {
      // Arrange
      const multilineDescription = `Problem Summary:
I cannot access my account.

Steps I tried:
1. Reset password
2. Clear browser cache
3. Try different browser

Still not working.`;

      const interaction = createMockModalSubmitInteraction({
        customId: 'create_ticket_modal:technical',
        userId: 'user123',
        fields: {
          ticket_issue_description: multilineDescription,
        },
      });

      // Act
      await createTicketModal.execute(interaction as any, mockServices);

      // Assert
      expect(mockTicketManagerCreate).toHaveBeenCalledWith(
        interaction,
        multilineDescription,
        'technical'
      );
    });
  });

  // ============================================
  // Ticket Type Parsing Tests
  // ============================================

  describe('ticket type parsing', () => {
    it('should parse ticket type from customId', async () => {
      // Arrange
      const interaction = createMockModalSubmitInteraction({
        customId: 'create_ticket_modal:billing',
        userId: 'user123',
        fields: {
          ticket_issue_description: 'Billing inquiry.',
        },
      });

      // Act
      await createTicketModal.execute(interaction as any, mockServices);

      // Assert
      expect(mockTicketManagerCreate).toHaveBeenCalledWith(
        interaction,
        'Billing inquiry.',
        'billing'
      );
    });

    it('should handle empty ticket type', async () => {
      // Arrange
      const interaction = createMockModalSubmitInteraction({
        customId: 'create_ticket_modal:',
        userId: 'user123',
        fields: {
          ticket_issue_description: 'General question.',
        },
      });

      // Act
      await createTicketModal.execute(interaction as any, mockServices);

      // Assert
      expect(mockTicketManagerCreate).toHaveBeenCalledWith(
        interaction,
        'General question.',
        '' // Empty string for type
      );
    });

    it('should handle undefined ticket type when no colon', async () => {
      // Arrange
      const interaction = createMockModalSubmitInteraction({
        customId: 'create_ticket_modal',
        userId: 'user123',
        fields: {
          ticket_issue_description: 'Support request.',
        },
      });

      // Act
      await createTicketModal.execute(interaction as any, mockServices);

      // Assert
      expect(mockTicketManagerCreate).toHaveBeenCalledWith(
        interaction,
        'Support request.',
        undefined
      );
    });
  });

  // ============================================
  // Description Validation Tests
  // ============================================

  describe('description validation', () => {
    it('should reject description longer than 1024 characters', async () => {
      // Arrange
      const longDescription = 'A'.repeat(1025);

      const interaction = createMockModalSubmitInteraction({
        customId: 'create_ticket_modal:general',
        userId: 'user123',
        fields: {
          ticket_issue_description: longDescription,
        },
      });

      // Act
      await createTicketModal.execute(interaction as any, mockServices);

      // Assert
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.stringContaining('description length 1025')
      );
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('1025'),
        })
      );
      expect(mockTicketManagerCreate).not.toHaveBeenCalled();
    });

    it('should accept description exactly 1024 characters', async () => {
      // Arrange
      const exactDescription = 'A'.repeat(1024);

      const interaction = createMockModalSubmitInteraction({
        customId: 'create_ticket_modal:general',
        userId: 'user123',
        fields: {
          ticket_issue_description: exactDescription,
        },
      });

      // Act
      await createTicketModal.execute(interaction as any, mockServices);

      // Assert
      expect(mockTicketManagerCreate).toHaveBeenCalledWith(
        interaction,
        exactDescription,
        'general'
      );
    });

    it('should accept short description', async () => {
      // Arrange
      const interaction = createMockModalSubmitInteraction({
        customId: 'create_ticket_modal:general',
        userId: 'user123',
        fields: {
          ticket_issue_description: 'Help me!',
        },
      });

      // Act
      await createTicketModal.execute(interaction as any, mockServices);

      // Assert
      expect(mockTicketManagerCreate).toHaveBeenCalled();
    });
  });

  // ============================================
  // Defer Reply Tests
  // ============================================

  describe('interaction deferral', () => {
    it('should defer reply with ephemeral flag', async () => {
      // Arrange
      const interaction = createMockModalSubmitInteraction({
        customId: 'create_ticket_modal:general',
        userId: 'user123',
        fields: {
          ticket_issue_description: 'My issue.',
        },
      });

      // Act
      await createTicketModal.execute(interaction as any, mockServices);

      // Assert
      expect(interaction.deferReply).toHaveBeenCalledWith(
        expect.objectContaining({
          flags: expect.any(Number), // MessageFlags.Ephemeral
        })
      );
    });
  });

  // ============================================
  // TicketManager Service Check Tests
  // ============================================

  describe('ticket manager service check', () => {
    it('should log error and return when ticketManager is not available', async () => {
      // Arrange
      const servicesWithoutTicketManager = {
        ...mockServices,
        ticketManager: undefined,
      } as any;

      const interaction = createMockModalSubmitInteraction({
        customId: 'create_ticket_modal:general',
        userId: 'user123',
        fields: {
          ticket_issue_description: 'My issue.',
        },
      });

      // Act
      await createTicketModal.execute(interaction as any, servicesWithoutTicketManager);

      // Assert
      expect(mockLoggerError).toHaveBeenCalledWith(
        'TicketManager service not available in createTicketModal'
      );
      expect(interaction.deferReply).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // Error Handling Tests
  // ============================================

  describe('error handling', () => {
    it('should log error when ticketManager.create fails', async () => {
      // Arrange
      mockTicketManagerCreate.mockRejectedValue(new Error('Database connection failed'));

      const interaction = createMockModalSubmitInteraction({
        customId: 'create_ticket_modal:general',
        userId: 'user123',
        guildId: 'guild-456',
        fields: {
          ticket_issue_description: 'My issue.',
        },
      });

      // Act
      await createTicketModal.execute(interaction as any, mockServices);

      // Assert
      expect(mockLoggerError).toHaveBeenCalledWith(
        'Error in createTicketModal:',
        expect.objectContaining({
          error: 'Database connection failed',
          userId: 'user123',
          guildId: 'guild-456',
        })
      );
    });

    it('should edit reply when deferred and error occurs', async () => {
      // Arrange
      mockTicketManagerCreate.mockRejectedValue(new Error('Creation failed'));

      const interaction = createMockModalSubmitInteraction({
        customId: 'create_ticket_modal:general',
        userId: 'user123',
        fields: {
          ticket_issue_description: 'My issue.',
        },
        deferred: true,
      });

      // Act
      await createTicketModal.execute(interaction as any, mockServices);

      // Assert
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Failed to create ticket'),
        })
      );
    });

    it('should reply when not deferred and error occurs', async () => {
      // Arrange
      mockTicketManagerCreate.mockRejectedValue(new Error('Creation failed'));

      const interaction = createMockModalSubmitInteraction({
        customId: 'create_ticket_modal:general',
        userId: 'user123',
        fields: {
          ticket_issue_description: 'My issue.',
        },
        deferred: false,
        replied: false,
      });
      // Simulate deferReply succeeding but marked as not deferred yet
      (interaction as any).deferred = false;
      (interaction as any).replied = false;

      // Override deferReply to not update the deferred state
      (interaction.deferReply as any).mockImplementation(async () => {
        // Don't update deferred state to simulate timing issue
      });

      // Act
      await createTicketModal.execute(interaction as any, mockServices);

      // Assert
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Failed to create ticket'),
        })
      );
    });

    it('should skip reply for unknown interaction error (code 10062)', async () => {
      // Arrange
      const unknownInteractionError = new Error('Unknown interaction') as any;
      unknownInteractionError.code = 10062;
      mockTicketManagerCreate.mockRejectedValue(unknownInteractionError);

      const interaction = createMockModalSubmitInteraction({
        customId: 'create_ticket_modal:general',
        userId: 'user123',
        fields: {
          ticket_issue_description: 'My issue.',
        },
      });

      // Act
      await createTicketModal.execute(interaction as any, mockServices);

      // Assert
      // Should not try to reply when interaction token is invalid
      expect(mockLoggerError).toHaveBeenCalled();
      // The function should return early after logging
    });

    it('should not log reply error for token expiry errors', async () => {
      // Arrange
      mockTicketManagerCreate.mockRejectedValue(new Error('Creation failed'));

      const tokenExpiredError = new Error('Token expired') as any;
      tokenExpiredError.code = 10062;

      const interaction = createMockModalSubmitInteraction({
        customId: 'create_ticket_modal:general',
        userId: 'user123',
        fields: {
          ticket_issue_description: 'My issue.',
        },
        deferred: true,
      });
      (interaction.editReply as any).mockRejectedValue(tokenExpiredError);

      // Act
      await createTicketModal.execute(interaction as any, mockServices);

      // Assert
      // Should not log the reply error for 10062
      const errorCalls = mockLoggerError.mock.calls;
      expect(errorCalls.some((call: any[]) =>
        call[0] === 'Failed to send error message to user:'
      )).toBe(false);
    });

    it('should not log reply error for interaction already acknowledged (code 40060)', async () => {
      // Arrange
      mockTicketManagerCreate.mockRejectedValue(new Error('Creation failed'));

      const alreadyAckedError = new Error('Already acknowledged') as any;
      alreadyAckedError.code = 40060;

      const interaction = createMockModalSubmitInteraction({
        customId: 'create_ticket_modal:general',
        userId: 'user123',
        fields: {
          ticket_issue_description: 'My issue.',
        },
        deferred: true,
      });
      (interaction.editReply as any).mockRejectedValue(alreadyAckedError);

      // Act
      await createTicketModal.execute(interaction as any, mockServices);

      // Assert
      // Should not log the reply error for 40060
      const errorCalls = mockLoggerError.mock.calls;
      expect(errorCalls.some((call: any[]) =>
        call[0] === 'Failed to send error message to user:'
      )).toBe(false);
    });

    it('should log reply error for other error codes', async () => {
      // Arrange
      mockTicketManagerCreate.mockRejectedValue(new Error('Creation failed'));

      const otherError = new Error('Unknown error') as any;
      otherError.code = 50001;

      const interaction = createMockModalSubmitInteraction({
        customId: 'create_ticket_modal:general',
        userId: 'user123',
        fields: {
          ticket_issue_description: 'My issue.',
        },
        deferred: true,
      });
      (interaction.editReply as any).mockRejectedValue(otherError);

      // Act
      await createTicketModal.execute(interaction as any, mockServices);

      // Assert
      expect(mockLoggerError).toHaveBeenCalledWith(
        'Failed to send error message to user:',
        expect.any(Error)
      );
    });
  });
});
