/**
 * Misc Buttons 單元測試
 *
 * 合併測試較小的按鈕處理器：
 * - testErrorButton: 測試錯誤按鈕
 * - antiSpamAppealReview: 反垃圾郵件申訴審查
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// Mock 設定 - 使用 vi.hoisted 確保持久化
// ============================================

const { mockLoggerError, mockLoggerWarn } = vi.hoisted(() => ({
  mockLoggerError: vi.fn(),
  mockLoggerWarn: vi.fn(),
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

// Mock errors
vi.mock('../../../../src/errors/index.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../../src/errors/index.js')>();
  return {
    ...original,
    BusinessError: class BusinessError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'BusinessError';
      }
    },
    CooldownError: class CooldownError extends Error {
      remainingSeconds: number;
      constructor(message: string, remainingSeconds: number) {
        super(message);
        this.name = 'CooldownError';
        this.remainingSeconds = remainingSeconds;
      }
    },
    MissingPermissionsError: class MissingPermissionsError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'MissingPermissionsError';
      }
    },
  };
});

// ============================================
// 現在可以安全地 import
// ============================================

import testErrorButton from '../../../../src/interactions/buttons/testErrorButton.js';
import antiSpamAppealReview from '../../../../src/interactions/buttons/antiSpamAppealReview.js';
import { createMockButtonInteraction, createMockClient, createMockGuild, createMockGuildMember, createMockMessage } from '../../../helpers/discord-mocks.js';
import type { Services, Databases } from '../../../../src/interfaces/Command.js';

describe('testErrorButton', () => {
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
  });

  describe('name', () => {
    it('should have correct button name', () => {
      expect(testErrorButton.name).toBe('test_error');
    });
  });

  describe('execute', () => {
    it('should throw BusinessError for business error type', async () => {
      // Arrange
      const interaction = createMockButtonInteraction({
        customId: 'test_error:business',
      });
      const client = createMockClient();

      // Act & Assert
      await expect(
        testErrorButton.execute(interaction, client, mockServices, mockDatabases)
      ).rejects.toThrow('這是一個測試業務邏輯錯誤訊息');
    });

    it('should throw Error for internal error type', async () => {
      // Arrange
      const interaction = createMockButtonInteraction({
        customId: 'test_error:internal',
      });
      const client = createMockClient();

      // Act & Assert
      await expect(
        testErrorButton.execute(interaction, client, mockServices, mockDatabases)
      ).rejects.toThrow('這是一個測試內部錯誤');
    });

    it('should throw CooldownError for cooldown error type', async () => {
      // Arrange
      const interaction = createMockButtonInteraction({
        customId: 'test_error:cooldown',
      });
      const client = createMockClient();

      // Act & Assert
      await expect(
        testErrorButton.execute(interaction, client, mockServices, mockDatabases)
      ).rejects.toThrow();
    });

    it('should throw MissingPermissionsError for permissions error type', async () => {
      // Arrange
      const interaction = createMockButtonInteraction({
        customId: 'test_error:permissions',
      });
      const client = createMockClient();

      // Act & Assert
      await expect(
        testErrorButton.execute(interaction, client, mockServices, mockDatabases)
      ).rejects.toThrow();
    });

    it('should throw BusinessError for unknown error type', async () => {
      // Arrange
      const interaction = createMockButtonInteraction({
        customId: 'test_error:unknown',
      });
      const client = createMockClient();

      // Act & Assert
      await expect(
        testErrorButton.execute(interaction, client, mockServices, mockDatabases)
      ).rejects.toThrow('未知的錯誤類型');
    });

    it('should throw BusinessError when no error type specified', async () => {
      // Arrange
      const interaction = createMockButtonInteraction({
        customId: 'test_error',
      });
      const client = createMockClient();

      // Act & Assert
      await expect(
        testErrorButton.execute(interaction, client, mockServices, mockDatabases)
      ).rejects.toThrow('未知的錯誤類型');
    });
  });
});

describe('antiSpamAppealReview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('name', () => {
    it('should match appeal review buttons with regex', () => {
      expect(antiSpamAppealReview.name).toBeInstanceOf(RegExp);
      expect((antiSpamAppealReview.name as RegExp).test('appeal_approve:123456789:987654321')).toBe(true);
      expect((antiSpamAppealReview.name as RegExp).test('appeal_deny:123456789:987654321')).toBe(true);
    });
  });

  describe('execute - appeal_approve', () => {
    it('should approve appeal and remove timeout', async () => {
      // Arrange
      const userId = '123456789012345678';
      const guildId = '987654321098765432';
      const mockMember = createMockGuildMember({ id: userId });
      (mockMember as any).timeout = vi.fn().mockResolvedValue(undefined);

      const mockGuild = createMockGuild({ id: guildId });
      (mockGuild.members.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockMember);

      const client = createMockClient();
      (client.guilds.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockGuild);

      const mockMessage = createMockMessage();
      (mockMessage as any).embeds = [{
        toJSON: () => ({ title: 'Appeal', description: 'Test appeal' }),
      }];

      const interaction = createMockButtonInteraction({
        customId: `appeal_approve:${userId}:${guildId}`,
      });
      (interaction as any).message = mockMessage;

      // Act
      await antiSpamAppealReview.execute(interaction, client);

      // Assert
      expect(mockMember.timeout).toHaveBeenCalledWith(null, 'Appeal approved by administrator.');
      expect(mockMember.send).toHaveBeenCalledWith(
        'Your appeal has been approved, and your timeout has been removed.'
      );
      expect(mockMessage.edit).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array),
          components: [],
        })
      );
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('approved'),
          flags: 64,
        })
      );
    });

    it('should handle guild not found', async () => {
      // Arrange
      const userId = '123456789012345678';
      const guildId = '987654321098765432';

      const client = createMockClient();
      (client.guilds.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const interaction = createMockButtonInteraction({
        customId: `appeal_approve:${userId}:${guildId}`,
      });

      // Act
      await antiSpamAppealReview.execute(interaction, client);

      // Assert
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Guild not found.',
          flags: 64,
        })
      );
    });

    it('should handle member not found', async () => {
      // Arrange
      const userId = '123456789012345678';
      const guildId = '987654321098765432';

      const mockGuild = createMockGuild({ id: guildId });
      (mockGuild.members.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const client = createMockClient();
      (client.guilds.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockGuild);

      const interaction = createMockButtonInteraction({
        customId: `appeal_approve:${userId}:${guildId}`,
      });

      // Act
      await antiSpamAppealReview.execute(interaction, client);

      // Assert
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Member not found in this guild.',
          flags: 64,
        })
      );
    });

    it('should handle timeout removal failure', async () => {
      // Arrange
      const userId = '123456789012345678';
      const guildId = '987654321098765432';
      const mockMember = createMockGuildMember({ id: userId });
      (mockMember as any).timeout = vi.fn().mockRejectedValue(new Error('Permission denied'));

      const mockGuild = createMockGuild({ id: guildId });
      (mockGuild.members.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockMember);

      const client = createMockClient();
      (client.guilds.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockGuild);

      const mockMessage = createMockMessage();
      (mockMessage as any).embeds = [{
        toJSON: () => ({ title: 'Appeal', description: 'Test appeal' }),
      }];

      const interaction = createMockButtonInteraction({
        customId: `appeal_approve:${userId}:${guildId}`,
      });
      (interaction as any).message = mockMessage;

      // Act
      await antiSpamAppealReview.execute(interaction, client);

      // Assert
      expect(mockLoggerError).toHaveBeenCalledWith(
        'Failed to approve appeal:',
        expect.any(Object)
      );
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Failed to remove timeout.',
          flags: 64,
        })
      );
    });

    it('should warn when DM fails but continue', async () => {
      // Arrange
      const userId = '123456789012345678';
      const guildId = '987654321098765432';
      const mockMember = createMockGuildMember({ id: userId });
      (mockMember as any).timeout = vi.fn().mockResolvedValue(undefined);
      (mockMember.send as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DM disabled'));

      const mockGuild = createMockGuild({ id: guildId });
      (mockGuild.members.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockMember);

      const client = createMockClient();
      (client.guilds.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockGuild);

      const mockMessage = createMockMessage();
      (mockMessage as any).embeds = [{
        toJSON: () => ({ title: 'Appeal', description: 'Test appeal' }),
      }];

      const interaction = createMockButtonInteraction({
        customId: `appeal_approve:${userId}:${guildId}`,
      });
      (interaction as any).message = mockMessage;

      // Act
      await antiSpamAppealReview.execute(interaction, client);

      // Assert
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.stringContaining('Could not DM user')
      );
      // Should still complete the approval
      expect(mockMessage.edit).toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('approved'),
        })
      );
    });
  });

  describe('execute - appeal_deny', () => {
    it('should deny appeal and notify user', async () => {
      // Arrange
      const userId = '123456789012345678';
      const guildId = '987654321098765432';
      const mockMember = createMockGuildMember({ id: userId });

      const mockGuild = createMockGuild({ id: guildId });
      (mockGuild.members.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockMember);

      const client = createMockClient();
      (client.guilds.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockGuild);

      const mockMessage = createMockMessage();
      (mockMessage as any).embeds = [{
        toJSON: () => ({ title: 'Appeal', description: 'Test appeal' }),
      }];

      const interaction = createMockButtonInteraction({
        customId: `appeal_deny:${userId}:${guildId}`,
      });
      (interaction as any).message = mockMessage;

      // Act
      await antiSpamAppealReview.execute(interaction, client);

      // Assert
      expect(mockMember.send).toHaveBeenCalledWith('Your appeal has been denied.');
      expect(mockMessage.edit).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array),
          components: [],
        })
      );
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('denied'),
          flags: 64,
        })
      );
    });

    it('should handle DM failure gracefully for denial', async () => {
      // Arrange
      const userId = '123456789012345678';
      const guildId = '987654321098765432';
      const mockMember = createMockGuildMember({ id: userId });
      (mockMember.send as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DM disabled'));

      const mockGuild = createMockGuild({ id: guildId });
      (mockGuild.members.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockMember);

      const client = createMockClient();
      (client.guilds.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockGuild);

      const mockMessage = createMockMessage();
      (mockMessage as any).embeds = [{
        toJSON: () => ({ title: 'Appeal', description: 'Test appeal' }),
      }];

      const interaction = createMockButtonInteraction({
        customId: `appeal_deny:${userId}:${guildId}`,
      });
      (interaction as any).message = mockMessage;

      // Act
      await antiSpamAppealReview.execute(interaction, client);

      // Assert
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.stringContaining('Could not DM user')
      );
      // Should still complete the denial
      expect(mockMessage.edit).toHaveBeenCalled();
    });
  });
});
