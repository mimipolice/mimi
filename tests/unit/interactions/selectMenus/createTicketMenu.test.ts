/**
 * createTicketMenu Select Menu Unit Tests
 *
 * Tests the create ticket menu handler which shows a modal for users
 * to describe their issue when creating a new support ticket.
 *
 * Test coverage:
 * - Ticket type parsing from selected value
 * - Modal creation and display
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// Mock Setup - use vi.hoisted for persistent mocks
// ============================================

const {
  mockLoggerError,
  mockLoggerInfo,
} = vi.hoisted(() => ({
  mockLoggerError: vi.fn(),
  mockLoggerInfo: vi.fn(),
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

// Mock localeHelper
vi.mock('../../../../src/utils/localeHelper.js', () => ({
  getInteractionLocale: vi.fn(() => 'en-US'),
}));

// ============================================
// Import after mocks
// ============================================

import createTicketMenu from '../../../../src/interactions/selectMenus/createTicketMenu.js';
import { createMockStringSelectMenuInteraction } from '../../../helpers/discord-mocks.js';
import type { Services, Databases } from '../../../../src/interfaces/Command.js';
import { createMockKysely } from '../../../helpers/kysely-mocks.js';

describe('createTicketMenu', () => {
  let mockServices: Services;
  let mockDatabases: Databases;

  beforeEach(() => {
    vi.clearAllMocks();

    mockServices = {
      localizationManager: {
        get: vi.fn((key: string) => {
          const translations: Record<string, string> = {
            'global.ticket.modalTitle': 'Create Ticket',
            'global.ticket.describeIssue': 'Please describe your issue',
            'global.ticket.formError': 'Failed to open the form. Please try again.',
          };
          return translations[key] ?? key;
        }),
      },
      settingsManager: {} as any,
      ticketManager: {} as any,
      helpService: {} as any,
      forumService: {} as any,
      cacheService: {} as any,
      storyForumService: {} as any,
    } as Services;

    const mockDb = createMockKysely();
    mockDatabases = {
      gachaDb: mockDb as any,
      ticketDb: mockDb as any,
    };
  });

  // ============================================
  // Basic Properties
  // ============================================

  describe('handler properties', () => {
    it('should have correct name', () => {
      expect(createTicketMenu.name).toBe('create_ticket_menu');
    });

    it('should have execute function', () => {
      expect(typeof createTicketMenu.execute).toBe('function');
    });
  });

  // ============================================
  // Ticket Type Parsing Tests
  // ============================================

  describe('ticket type parsing', () => {
    it('should parse ticket type from selected value', async () => {
      // Arrange
      const interaction = createMockStringSelectMenuInteraction({
        customId: 'create_ticket_menu',
        values: ['create_ticket:technical'],
        userId: 'user123',
      });

      // Act
      await createTicketMenu.execute(interaction as any, mockServices, mockDatabases);

      // Assert
      expect(interaction.showModal).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            custom_id: 'create_ticket_modal:technical',
          }),
        })
      );
    });

    it('should handle billing ticket type', async () => {
      // Arrange
      const interaction = createMockStringSelectMenuInteraction({
        customId: 'create_ticket_menu',
        values: ['create_ticket:billing'],
        userId: 'user123',
      });

      // Act
      await createTicketMenu.execute(interaction as any, mockServices, mockDatabases);

      // Assert
      expect(interaction.showModal).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            custom_id: 'create_ticket_modal:billing',
          }),
        })
      );
    });

    it('should handle general ticket type', async () => {
      // Arrange
      const interaction = createMockStringSelectMenuInteraction({
        customId: 'create_ticket_menu',
        values: ['create_ticket:general'],
        userId: 'user123',
      });

      // Act
      await createTicketMenu.execute(interaction as any, mockServices, mockDatabases);

      // Assert
      expect(interaction.showModal).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            custom_id: 'create_ticket_modal:general',
          }),
        })
      );
    });

    it('should handle empty ticket type', async () => {
      // Arrange
      const interaction = createMockStringSelectMenuInteraction({
        customId: 'create_ticket_menu',
        values: ['create_ticket:'],
        userId: 'user123',
      });

      // Act
      await createTicketMenu.execute(interaction as any, mockServices, mockDatabases);

      // Assert
      expect(interaction.showModal).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            custom_id: 'create_ticket_modal:',
          }),
        })
      );
    });

    it('should handle value without colon', async () => {
      // Arrange
      const interaction = createMockStringSelectMenuInteraction({
        customId: 'create_ticket_menu',
        values: ['create_ticket'],
        userId: 'user123',
      });

      // Act
      await createTicketMenu.execute(interaction as any, mockServices, mockDatabases);

      // Assert
      expect(interaction.showModal).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            custom_id: expect.stringContaining('create_ticket_modal:'),
          }),
        })
      );
    });
  });

  // ============================================
  // Modal Creation Tests
  // ============================================

  describe('modal creation', () => {
    it('should create modal with correct title', async () => {
      // Arrange
      const interaction = createMockStringSelectMenuInteraction({
        customId: 'create_ticket_menu',
        values: ['create_ticket:support'],
        userId: 'user123',
      });

      // Act
      await createTicketMenu.execute(interaction as any, mockServices, mockDatabases);

      // Assert
      expect(interaction.showModal).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Create Ticket',
          }),
        })
      );
    });

    it('should create modal with text input for issue description', async () => {
      // Arrange
      const interaction = createMockStringSelectMenuInteraction({
        customId: 'create_ticket_menu',
        values: ['create_ticket:support'],
        userId: 'user123',
      });

      // Act
      await createTicketMenu.execute(interaction as any, mockServices, mockDatabases);

      // Assert - check that showModal was called with a modal containing the expected structure
      expect(interaction.showModal).toHaveBeenCalledWith(
        expect.objectContaining({
          custom_id: 'create_ticket_modal:support',
          title: 'Create Ticket',
          components: expect.arrayContaining([
            expect.objectContaining({
              components: expect.arrayContaining([
                expect.objectContaining({
                  custom_id: 'ticket_issue_description',
                  style: 2, // Paragraph style
                  required: true,
                  min_length: 10,
                  max_length: 1024,
                }),
              ]),
            }),
          ]),
        })
      );
    });

    it('should use localized label for issue description', async () => {
      // Arrange
      const interaction = createMockStringSelectMenuInteraction({
        customId: 'create_ticket_menu',
        values: ['create_ticket:support'],
        userId: 'user123',
      });

      // Act
      await createTicketMenu.execute(interaction as any, mockServices, mockDatabases);

      // Assert
      expect(mockServices.localizationManager.get).toHaveBeenCalledWith(
        'global.ticket.describeIssue',
        'en-US'
      );
    });
  });

  // ============================================
  // Error Handling Tests
  // ============================================

  describe('error handling', () => {
    it('should log error when showModal fails', async () => {
      // Arrange
      const interaction = createMockStringSelectMenuInteraction({
        customId: 'create_ticket_menu',
        values: ['create_ticket:support'],
        userId: 'user123',
      });
      (interaction.showModal as any).mockRejectedValue(new Error('Discord API error'));

      // Act
      await createTicketMenu.execute(interaction as any, mockServices, mockDatabases);

      // Assert
      expect(mockLoggerError).toHaveBeenCalledWith(
        'Error in createTicketMenu:',
        expect.objectContaining({
          error: expect.any(Error),
        })
      );
    });

    it('should send error reply when modal fails and not already replied', async () => {
      // Arrange
      const interaction = createMockStringSelectMenuInteraction({
        customId: 'create_ticket_menu',
        values: ['create_ticket:support'],
        userId: 'user123',
        replied: false,
        deferred: false,
      });
      (interaction.showModal as any).mockRejectedValue(new Error('Discord API error'));

      // Act
      await createTicketMenu.execute(interaction as any, mockServices, mockDatabases);

      // Assert
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.any(String),
        })
      );
    });

    it('should not send reply when already replied', async () => {
      // Arrange
      const interaction = createMockStringSelectMenuInteraction({
        customId: 'create_ticket_menu',
        values: ['create_ticket:support'],
        userId: 'user123',
        replied: true,
      });
      (interaction.showModal as any).mockRejectedValue(new Error('Discord API error'));

      // Act
      await createTicketMenu.execute(interaction as any, mockServices, mockDatabases);

      // Assert
      expect(interaction.reply).not.toHaveBeenCalled();
    });

    it('should not send reply when already deferred', async () => {
      // Arrange
      const interaction = createMockStringSelectMenuInteraction({
        customId: 'create_ticket_menu',
        values: ['create_ticket:support'],
        userId: 'user123',
        deferred: true,
      });
      (interaction.showModal as any).mockRejectedValue(new Error('Discord API error'));

      // Act
      await createTicketMenu.execute(interaction as any, mockServices, mockDatabases);

      // Assert
      expect(interaction.reply).not.toHaveBeenCalled();
    });

    it('should handle reply failure silently', async () => {
      // Arrange
      const interaction = createMockStringSelectMenuInteraction({
        customId: 'create_ticket_menu',
        values: ['create_ticket:support'],
        userId: 'user123',
      });
      (interaction.showModal as any).mockRejectedValue(new Error('Discord API error'));
      (interaction.reply as any).mockRejectedValue(new Error('Reply failed'));

      // Act & Assert - should not throw
      await expect(
        createTicketMenu.execute(interaction as any, mockServices, mockDatabases)
      ).resolves.not.toThrow();
    });
  });
});
