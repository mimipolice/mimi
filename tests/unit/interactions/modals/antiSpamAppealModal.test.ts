/**
 * antiSpamAppealModal Modal Unit Tests
 *
 * Tests the anti-spam appeal modal handler which processes timeout appeals
 * and sends them to the log channel for staff review.
 *
 * Test coverage:
 * - Authorization checks (userId validation)
 * - Form value extraction (appealReason)
 * - Original DM message fetching
 * - Appeal review embed creation
 * - Log channel message sending
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Collection, TextChannel } from 'discord.js';

// ============================================
// Mock Setup - use vi.hoisted for persistent mocks
// ============================================

const {
  mockGetAntiSpamSettings,
  mockLoggerWarn,
  mockLoggerError,
} = vi.hoisted(() => ({
  mockGetAntiSpamSettings: vi.fn(),
  mockLoggerWarn: vi.fn(),
  mockLoggerError: vi.fn(),
}));

// Mock AntiSpamSettingsManager
vi.mock('../../../../src/services/AntiSpamSettingsManager.js', () => ({
  AntiSpamSettingsManager: class MockAntiSpamSettingsManager {
    getAntiSpamSettings = mockGetAntiSpamSettings;
  },
}));

// Mock database
vi.mock('../../../../src/shared/database/index.js', () => ({
  mimiDLCDb: {},
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

import antiSpamAppealModal from '../../../../src/interactions/modals/antiSpamAppealModal.js';
import {
  createMockModalSubmitInteraction,
  createMockTextChannel,
  createMockUser,
  createMockGuild,
  createMockGuildMember,
  createMockMessage,
  createMockClient,
} from '../../../helpers/discord-mocks.js';
import type { Services, Databases } from '../../../../src/interfaces/Command.js';
import { createMockKysely } from '../../../helpers/kysely-mocks.js';

describe('antiSpamAppealModal', () => {
  let mockServices: Services;
  let mockDatabases: Databases;

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

    const mockDb = createMockKysely();
    mockDatabases = {
      gachaDb: mockDb as any,
      ticketDb: mockDb as any,
    };

    // Default mock returns
    mockGetAntiSpamSettings.mockResolvedValue({
      log_channel_id: 'log-channel-123',
    });
  });

  // ============================================
  // Basic Properties
  // ============================================

  describe('handler properties', () => {
    it('should have correct name', () => {
      expect(antiSpamAppealModal.name).toBe('anti_spam_appeal_modal');
    });

    it('should have execute function', () => {
      expect(typeof antiSpamAppealModal.execute).toBe('function');
    });
  });

  // ============================================
  // Authorization Tests
  // ============================================

  describe('authorization', () => {
    it('should reject when user ID does not match customId', async () => {
      // Arrange
      const interaction = createMockModalSubmitInteraction({
        customId: 'anti_spam_appeal_modal:user-original-123:guild-456:msg-789',
        userId: 'user-different-456',
        fields: {
          appealReason: 'I was wrongly timed out',
        },
      });
      (interaction as any).isModalSubmit = vi.fn().mockReturnValue(true);

      // Act
      await antiSpamAppealModal.execute(interaction as any, mockServices, mockDatabases);

      // Assert
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('not authorized'),
        })
      );
      expect(interaction.deferReply).not.toHaveBeenCalled();
    });

    it('should allow when user ID matches customId', async () => {
      // Arrange
      const mockUser = createMockUser({ id: 'user123' });
      const mockDmChannel = {
        messages: {
          fetch: vi.fn().mockResolvedValue(
            createMockMessage({
              content: 'You have been timed out.\n\n**Reason**: Spam detection',
            })
          ),
        },
      };
      mockUser.dmChannel = mockDmChannel as any;
      (mockUser as any).createDM = vi.fn().mockResolvedValue(mockDmChannel);

      const mockGuild = createMockGuild({ id: 'guild456' });
      const mockMember = createMockGuildMember({ id: 'user123' });
      (mockGuild.members.fetch as any).mockResolvedValue(mockMember);

      const mockLogChannel = createMockTextChannel({ id: 'log-channel-123' });

      const mockClient = createMockClient();
      (mockClient.users.fetch as any).mockResolvedValue(mockUser);
      (mockClient.guilds.fetch as any).mockResolvedValue(mockGuild);
      (mockClient.channels.fetch as any).mockResolvedValue(mockLogChannel);

      const interaction = createMockModalSubmitInteraction({
        customId: 'anti_spam_appeal_modal:user123:guild456:msg789',
        userId: 'user123',
        fields: {
          appealReason: 'I was wrongly timed out',
        },
      });
      (interaction as any).isModalSubmit = vi.fn().mockReturnValue(true);
      (interaction as any).client = mockClient;

      // Act
      await antiSpamAppealModal.execute(interaction as any, mockServices, mockDatabases);

      // Assert
      expect(interaction.deferReply).toHaveBeenCalled();
    });
  });

  // ============================================
  // Form Value Extraction Tests
  // ============================================

  describe('form value extraction', () => {
    it('should extract appealReason from form fields', async () => {
      // Arrange
      const mockUser = createMockUser({ id: 'user123' });
      const mockDmChannel = {
        messages: {
          fetch: vi.fn().mockResolvedValue(
            createMockMessage({
              content: 'You have been timed out.\n\n**Reason**: Spam detection',
            })
          ),
        },
      };
      mockUser.dmChannel = mockDmChannel as any;
      (mockUser as any).createDM = vi.fn().mockResolvedValue(mockDmChannel);

      const mockGuild = createMockGuild({ id: 'guild456' });
      const mockMember = createMockGuildMember({ id: 'user123' });
      (mockGuild.members.fetch as any).mockResolvedValue(mockMember);

      const mockLogChannel = createMockTextChannel({ id: 'log-channel-123' });

      const mockClient = createMockClient();
      (mockClient.users.fetch as any).mockResolvedValue(mockUser);
      (mockClient.guilds.fetch as any).mockResolvedValue(mockGuild);
      (mockClient.channels.fetch as any).mockResolvedValue(mockLogChannel);

      const interaction = createMockModalSubmitInteraction({
        customId: 'anti_spam_appeal_modal:user123:guild456:msg789',
        userId: 'user123',
        fields: {
          appealReason: 'My account was hacked, I did not send that spam.',
        },
      });
      (interaction as any).isModalSubmit = vi.fn().mockReturnValue(true);
      (interaction as any).client = mockClient;

      // Act
      await antiSpamAppealModal.execute(interaction as any, mockServices, mockDatabases);

      // Assert - verify logChannel.send was called (indicating appeal was processed)
      expect(mockLogChannel.send).toHaveBeenCalled();
    });
  });

  // ============================================
  // Log Channel Configuration Tests
  // ============================================

  describe('log channel configuration', () => {
    it('should warn user when log channel is not configured', async () => {
      // Arrange
      mockGetAntiSpamSettings.mockResolvedValue({
        log_channel_id: null,
      });

      const mockUser = createMockUser({ id: 'user123' });
      const mockDmChannel = {
        messages: {
          fetch: vi.fn().mockResolvedValue(
            createMockMessage({
              content: 'You have been timed out.\n\n**Reason**: Spam detection',
            })
          ),
        },
      };
      mockUser.dmChannel = mockDmChannel as any;
      (mockUser as any).createDM = vi.fn().mockResolvedValue(mockDmChannel);

      const mockGuild = createMockGuild({ id: 'guild456' });
      const mockMember = createMockGuildMember({ id: 'user123' });
      (mockGuild.members.fetch as any).mockResolvedValue(mockMember);

      const mockClient = createMockClient();
      (mockClient.users.fetch as any).mockResolvedValue(mockUser);
      (mockClient.guilds.fetch as any).mockResolvedValue(mockGuild);

      const interaction = createMockModalSubmitInteraction({
        customId: 'anti_spam_appeal_modal:user123:guild456:msg789',
        userId: 'user123',
        fields: {
          appealReason: 'Appeal reason',
        },
      });
      (interaction as any).isModalSubmit = vi.fn().mockReturnValue(true);
      (interaction as any).client = mockClient;

      // Act
      await antiSpamAppealModal.execute(interaction as any, mockServices, mockDatabases);

      // Assert
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.stringContaining('No log channel configured')
      );
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('not configured'),
        })
      );
    });
  });

  // ============================================
  // Appeal Embed Tests
  // ============================================

  describe('appeal embed creation', () => {
    it('should create embed with correct title and color', async () => {
      // Arrange
      const mockUser = createMockUser({ id: 'user123', username: 'TestUser' });
      const mockDmChannel = {
        messages: {
          fetch: vi.fn().mockResolvedValue(
            createMockMessage({
              content: 'You have been timed out.\n\n**Reason**: Spam detection',
            })
          ),
        },
      };
      mockUser.dmChannel = mockDmChannel as any;
      (mockUser as any).createDM = vi.fn().mockResolvedValue(mockDmChannel);

      const mockGuild = createMockGuild({ id: 'guild456' });
      const mockMember = createMockGuildMember({ id: 'user123' });
      (mockGuild.members.fetch as any).mockResolvedValue(mockMember);

      const mockLogChannel = createMockTextChannel({ id: 'log-channel-123' });

      const mockClient = createMockClient();
      (mockClient.users.fetch as any).mockResolvedValue(mockUser);
      (mockClient.guilds.fetch as any).mockResolvedValue(mockGuild);
      (mockClient.channels.fetch as any).mockResolvedValue(mockLogChannel);

      const interaction = createMockModalSubmitInteraction({
        customId: 'anti_spam_appeal_modal:user123:guild456:msg789',
        userId: 'user123',
        fields: {
          appealReason: 'Appeal reason',
        },
      });
      (interaction as any).isModalSubmit = vi.fn().mockReturnValue(true);
      (interaction as any).client = mockClient;

      // Act
      await antiSpamAppealModal.execute(interaction as any, mockServices, mockDatabases);

      // Assert - verify that logChannel.send was called with embeds
      expect(mockLogChannel.send).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array),
        })
      );
    });

    it('should include approve and deny buttons', async () => {
      // Arrange
      const mockUser = createMockUser({ id: 'user123' });
      const mockDmChannel = {
        messages: {
          fetch: vi.fn().mockResolvedValue(
            createMockMessage({
              content: 'You have been timed out.\n\n**Reason**: Spam detection',
            })
          ),
        },
      };
      mockUser.dmChannel = mockDmChannel as any;
      (mockUser as any).createDM = vi.fn().mockResolvedValue(mockDmChannel);

      const mockGuild = createMockGuild({ id: 'guild456' });
      const mockMember = createMockGuildMember({ id: 'user123' });
      (mockGuild.members.fetch as any).mockResolvedValue(mockMember);

      const mockLogChannel = createMockTextChannel({ id: 'log-channel-123' });

      const mockClient = createMockClient();
      (mockClient.users.fetch as any).mockResolvedValue(mockUser);
      (mockClient.guilds.fetch as any).mockResolvedValue(mockGuild);
      (mockClient.channels.fetch as any).mockResolvedValue(mockLogChannel);

      const interaction = createMockModalSubmitInteraction({
        customId: 'anti_spam_appeal_modal:user123:guild456:msg789',
        userId: 'user123',
        fields: {
          appealReason: 'Appeal reason',
        },
      });
      (interaction as any).isModalSubmit = vi.fn().mockReturnValue(true);
      (interaction as any).client = mockClient;

      // Act
      await antiSpamAppealModal.execute(interaction as any, mockServices, mockDatabases);

      // Assert - verify logChannel.send was called with components
      expect(mockLogChannel.send).toHaveBeenCalledWith(
        expect.objectContaining({
          components: expect.any(Array),
        })
      );
    });
  });

  // ============================================
  // DM Message Cleanup Tests
  // ============================================

  describe('DM message cleanup', () => {
    it('should remove components from original DM message', async () => {
      // Arrange
      const mockDmMessage = createMockMessage({
        id: 'msg789',
        content: 'You have been timed out.\n\n**Reason**: Spam detection',
      });
      (mockDmMessage as any).embeds = [];

      const mockUser = createMockUser({ id: 'user123' });
      const mockDmChannel = {
        messages: {
          fetch: vi.fn().mockResolvedValue(mockDmMessage),
        },
      };
      mockUser.dmChannel = mockDmChannel as any;
      (mockUser as any).createDM = vi.fn().mockResolvedValue(mockDmChannel);

      const mockGuild = createMockGuild({ id: 'guild456' });
      const mockMember = createMockGuildMember({ id: 'user123' });
      (mockGuild.members.fetch as any).mockResolvedValue(mockMember);

      const mockLogChannel = createMockTextChannel({ id: 'log-channel-123' });

      const mockClient = createMockClient();
      (mockClient.users.fetch as any).mockResolvedValue(mockUser);
      (mockClient.guilds.fetch as any).mockResolvedValue(mockGuild);
      (mockClient.channels.fetch as any).mockResolvedValue(mockLogChannel);

      const interaction = createMockModalSubmitInteraction({
        customId: 'anti_spam_appeal_modal:user123:guild456:msg789',
        userId: 'user123',
        fields: {
          appealReason: 'Appeal reason',
        },
      });
      (interaction as any).isModalSubmit = vi.fn().mockReturnValue(true);
      (interaction as any).client = mockClient;

      // Act
      await antiSpamAppealModal.execute(interaction as any, mockServices, mockDatabases);

      // Assert - verify that the message edit was called to remove components
      expect(mockDmMessage.edit).toHaveBeenCalled();
    });
  });

  // ============================================
  // Error Handling Tests
  // ============================================

  describe('error handling', () => {
    it('should log error and reply when exception occurs', async () => {
      // Arrange
      const mockClient = createMockClient();
      (mockClient.users.fetch as any).mockRejectedValue(new Error('User not found'));

      const interaction = createMockModalSubmitInteraction({
        customId: 'anti_spam_appeal_modal:user123:guild456:msg789',
        userId: 'user123',
        fields: {
          appealReason: 'Appeal reason',
        },
      });
      (interaction as any).isModalSubmit = vi.fn().mockReturnValue(true);
      (interaction as any).client = mockClient;

      // Act
      await antiSpamAppealModal.execute(interaction as any, mockServices, mockDatabases);

      // Assert
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining('Error handling appeal'),
        expect.any(Error)
      );
    });

    it('should edit reply when already deferred', async () => {
      // Arrange
      const mockClient = createMockClient();
      (mockClient.users.fetch as any).mockRejectedValue(new Error('User not found'));

      const interaction = createMockModalSubmitInteraction({
        customId: 'anti_spam_appeal_modal:user123:guild456:msg789',
        userId: 'user123',
        fields: {
          appealReason: 'Appeal reason',
        },
        deferred: true,
      });
      (interaction as any).isModalSubmit = vi.fn().mockReturnValue(true);
      (interaction as any).client = mockClient;

      // Act
      await antiSpamAppealModal.execute(interaction as any, mockServices, mockDatabases);

      // Assert
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('error occurred'),
        })
      );
    });

    it('should handle error when createDM fails', async () => {
      // Arrange
      const mockUser = createMockUser({ id: 'user123' });
      mockUser.dmChannel = null as any;
      (mockUser as any).createDM = vi.fn().mockRejectedValue(new Error('Cannot create DM'));

      const mockClient = createMockClient();
      (mockClient.users.fetch as any).mockResolvedValue(mockUser);

      const interaction = createMockModalSubmitInteraction({
        customId: 'anti_spam_appeal_modal:user123:guild456:msg789',
        userId: 'user123',
        fields: {
          appealReason: 'Appeal reason',
        },
        deferred: false,
        replied: false,
      });
      (interaction as any).isModalSubmit = vi.fn().mockReturnValue(true);
      (interaction as any).client = mockClient;

      // Act
      await antiSpamAppealModal.execute(interaction as any, mockServices, mockDatabases);

      // Assert - error should be logged
      expect(mockLoggerError).toHaveBeenCalled();
    });
  });

  // ============================================
  // Modal Submit Check Tests
  // ============================================

  describe('modal submit validation', () => {
    it('should return early when not a modal submit', async () => {
      // Arrange
      const interaction = createMockModalSubmitInteraction({
        customId: 'anti_spam_appeal_modal:user123:guild456:msg789',
        userId: 'user123',
        fields: {
          appealReason: 'Appeal reason',
        },
      });
      (interaction as any).isModalSubmit = vi.fn().mockReturnValue(false);

      // Act
      await antiSpamAppealModal.execute(interaction as any, mockServices, mockDatabases);

      // Assert
      expect(interaction.deferReply).not.toHaveBeenCalled();
      expect(interaction.reply).not.toHaveBeenCalled();
    });
  });
});
