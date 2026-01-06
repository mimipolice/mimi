/**
 * helpInteractionHandler.ts Unit Tests
 *
 * Test Coverage:
 * - Interaction deferral
 * - Authorization checking (original user vs other user)
 * - Language detection and switching
 * - Navigation state management
 * - Button and select menu handling
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GuildMember } from 'discord.js';

// ============================================
// Mock Setup - Using vi.hoisted for persistence
// ============================================

const {
  mockLoggerError,
  mockCreateUnauthorizedReply,
  mockBuildHelpEmbed,
} = vi.hoisted(() => ({
  mockLoggerError: vi.fn(),
  mockCreateUnauthorizedReply: vi.fn().mockReturnValue({
    content: 'Unauthorized',
    ephemeral: true,
  }),
  mockBuildHelpEmbed: vi.fn().mockResolvedValue({
    container: {},
    components: [],
    files: [],
  }),
}));

// Mock logger
vi.mock('../../../../src/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: mockLoggerError,
    debug: vi.fn(),
  },
}));

// Mock interactionReply
vi.mock('../../../../src/utils/interactionReply.js', () => ({
  createUnauthorizedReply: mockCreateUnauthorizedReply,
}));

// Mock helpEmbedBuilder
vi.mock('../../../../src/commands/utility/help/helpEmbedBuilder.js', () => ({
  buildHelpEmbed: mockBuildHelpEmbed,
  HelpState: {},
}));

// ============================================
// Import after mocks are set up
// ============================================

import { handleHelpInteraction } from '../../../../src/events/handlers/helpInteractionHandler.js';

// ============================================
// Test Helpers
// ============================================

function createMockServices() {
  return {
    localizationManager: {},
    settingsManager: {},
    ticketManager: {},
    helpService: {},
    forumService: {},
    cacheService: {},
    storyForumService: {},
  };
}

function createMockInteraction(options: {
  customId?: string;
  userId?: string;
  locale?: string;
  isButton?: boolean;
  isSelectMenu?: boolean;
  selectMenuValues?: string[];
  messageComponents?: any[];
} = {}) {
  const isButton = options.isButton ?? true;
  const isSelectMenu = options.isSelectMenu ?? false;

  return {
    customId: options.customId ?? 'help:home:user-123',
    user: {
      id: options.userId ?? 'user-123',
    },
    locale: options.locale ?? 'en-US',
    // member is not instanceof GuildMember in tests, so will be null
    member: null,
    deferUpdate: vi.fn().mockResolvedValue(undefined),
    followUp: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    isButton: vi.fn().mockReturnValue(isButton),
    isStringSelectMenu: vi.fn().mockReturnValue(isSelectMenu),
    isMessageComponent: vi.fn().mockReturnValue(true),
    values: options.selectMenuValues ?? [],
    message: {
      components: options.messageComponents ?? [],
    },
  };
}

describe('helpInteractionHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================
  // Interaction Deferral Tests
  // ============================================

  describe('interaction deferral', () => {
    it('should defer update at the start', async () => {
      // Arrange
      const interaction = createMockInteraction();
      const services = createMockServices();

      // Act
      await handleHelpInteraction(interaction as any, services as any);

      // Assert
      expect(interaction.deferUpdate).toHaveBeenCalled();
    });
  });

  // ============================================
  // Authorization Tests
  // ============================================

  describe('authorization checking', () => {
    it('should allow original user to interact', async () => {
      // Arrange
      const interaction = createMockInteraction({
        customId: 'help:home:user-123',
        userId: 'user-123',
      });
      const services = createMockServices();

      // Act
      await handleHelpInteraction(interaction as any, services as any);

      // Assert
      expect(interaction.followUp).not.toHaveBeenCalled();
      expect(mockBuildHelpEmbed).toHaveBeenCalled();
    });

    it('should deny other users from interacting', async () => {
      // Arrange
      const interaction = createMockInteraction({
        customId: 'help:home:original-user',
        userId: 'different-user',
      });
      const services = createMockServices();

      // Act
      await handleHelpInteraction(interaction as any, services as any);

      // Assert
      expect(interaction.followUp).toHaveBeenCalled();
      expect(mockBuildHelpEmbed).not.toHaveBeenCalled();
    });

    it('should allow interaction when only 2 parts in customId', async () => {
      // Arrange - customId with only 2 parts means parts.length is NOT > 2
      const interaction = createMockInteraction({
        customId: 'help:home',
        userId: 'any-user',
      });
      const services = createMockServices();

      // Act
      await handleHelpInteraction(interaction as any, services as any);

      // Assert - should not check authorization since no userId in customId
      expect(interaction.followUp).not.toHaveBeenCalled();
      expect(mockBuildHelpEmbed).toHaveBeenCalled();
    });
  });

  // ============================================
  // Language Detection Tests
  // ============================================

  describe('language detection', () => {
    it('should detect zh-TW for Chinese locale', async () => {
      // Arrange
      const interaction = createMockInteraction({
        locale: 'zh-TW',
        isButton: true,
        customId: 'help:home:user-123',
        userId: 'user-123',
      });
      const services = createMockServices();

      // Act
      await handleHelpInteraction(interaction as any, services as any);

      // Assert
      expect(mockBuildHelpEmbed).toHaveBeenCalledWith(
        expect.objectContaining({ lang: 'zh-TW' }),
        expect.anything(),
        null, // member is null (not instanceof GuildMember)
        expect.anything(),
        'user-123'
      );
    });

    it('should default to en-US for non-Chinese locale', async () => {
      // Arrange
      const interaction = createMockInteraction({
        locale: 'en-US',
        isButton: true,
        customId: 'help:home:user-123',
        userId: 'user-123',
      });
      const services = createMockServices();

      // Act
      await handleHelpInteraction(interaction as any, services as any);

      // Assert
      expect(mockBuildHelpEmbed).toHaveBeenCalledWith(
        expect.objectContaining({ lang: 'en-US' }),
        expect.anything(),
        null,
        expect.anything(),
        'user-123'
      );
    });

    it('should switch language when lang button is clicked', async () => {
      // Arrange
      const interaction = createMockInteraction({
        locale: 'en-US',
        isButton: true,
        customId: 'help:lang:zh-TW:home:user-123',
        userId: 'user-123',
      });
      const services = createMockServices();

      // Act
      await handleHelpInteraction(interaction as any, services as any);

      // Assert
      expect(mockBuildHelpEmbed).toHaveBeenCalledWith(
        expect.objectContaining({ lang: 'zh-TW' }),
        expect.anything(),
        null,
        expect.anything(),
        'user-123'
      );
    });
  });

  // ============================================
  // Button Navigation Tests
  // ============================================

  describe('button navigation', () => {
    it('should navigate to home when home button is clicked', async () => {
      // Arrange
      const interaction = createMockInteraction({
        isButton: true,
        customId: 'help:home:user-123',
        userId: 'user-123',
      });
      const services = createMockServices();

      // Act
      await handleHelpInteraction(interaction as any, services as any);

      // Assert
      expect(mockBuildHelpEmbed).toHaveBeenCalledWith(
        expect.objectContaining({ view: 'home' }),
        expect.anything(),
        null,
        expect.anything(),
        'user-123'
      );
    });

    it('should preserve state when switching language', async () => {
      // Arrange
      const interaction = createMockInteraction({
        isButton: true,
        customId: 'help:lang:en-US:category:admin:user-123',
        userId: 'user-123',
      });
      const services = createMockServices();

      // Act
      await handleHelpInteraction(interaction as any, services as any);

      // Assert
      expect(mockBuildHelpEmbed).toHaveBeenCalledWith(
        expect.objectContaining({
          lang: 'en-US',
          view: 'category',
          category: 'admin',
        }),
        expect.anything(),
        null,
        expect.anything(),
        'user-123'
      );
    });
  });

  // ============================================
  // Select Menu Navigation Tests
  // ============================================

  describe('select menu navigation', () => {
    it('should navigate to category when category is selected', async () => {
      // Arrange
      const interaction = createMockInteraction({
        isButton: false,
        isSelectMenu: true,
        customId: 'help:category_select:user-123',
        selectMenuValues: ['admin'],
        userId: 'user-123',
      });
      const services = createMockServices();

      // Act
      await handleHelpInteraction(interaction as any, services as any);

      // Assert
      expect(mockBuildHelpEmbed).toHaveBeenCalledWith(
        expect.objectContaining({
          view: 'category',
          category: 'admin',
        }),
        expect.anything(),
        null,
        expect.anything(),
        'user-123'
      );
    });

    it('should navigate to command when command is selected', async () => {
      // Arrange
      const interaction = createMockInteraction({
        isButton: false,
        isSelectMenu: true,
        customId: 'help:command_select:admin:user-123',
        selectMenuValues: ['config'],
        userId: 'user-123',
      });
      const services = createMockServices();

      // Act
      await handleHelpInteraction(interaction as any, services as any);

      // Assert
      expect(mockBuildHelpEmbed).toHaveBeenCalledWith(
        expect.objectContaining({
          view: 'command',
          category: 'admin',
          command: 'config',
        }),
        expect.anything(),
        null,
        expect.anything(),
        'user-123'
      );
    });
  });

  // ============================================
  // Error Handling Tests
  // ============================================

  describe('error handling', () => {
    it('should log error and send error message when buildHelpEmbed fails', async () => {
      // Arrange
      const error = new Error('Build failed');
      mockBuildHelpEmbed.mockRejectedValueOnce(error);
      const interaction = createMockInteraction({
        customId: 'help:home:user-123',
        userId: 'user-123',
      });
      const services = createMockServices();

      // Act
      await handleHelpInteraction(interaction as any, services as any);

      // Assert
      expect(mockLoggerError).toHaveBeenCalledWith(
        'Error updating help embed:',
        error
      );
      expect(interaction.editReply).toHaveBeenCalledWith({
        content: 'An error occurred while updating the help menu.',
        embeds: [],
        components: [],
      });
    });
  });

  // ============================================
  // Response Building Tests
  // ============================================

  describe('response building', () => {
    it('should edit reply with built embed payload', async () => {
      // Arrange
      const mockPayload = {
        container: { type: 'container' },
        components: [{ type: 'row' }],
        files: [{ name: 'test.png' }],
      };
      mockBuildHelpEmbed.mockResolvedValueOnce(mockPayload);
      const interaction = createMockInteraction({
        customId: 'help:home:user-123',
        userId: 'user-123',
      });
      const services = createMockServices();

      // Act
      await handleHelpInteraction(interaction as any, services as any);

      // Assert
      expect(interaction.editReply).toHaveBeenCalledWith({
        components: [mockPayload.container, ...mockPayload.components],
        files: mockPayload.files,
      });
    });
  });
});
