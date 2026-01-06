/**
 * confirmPurge 單元測試
 *
 * 測試範圍：
 * - execute(): 確認清除所有工單記錄
 * - 權限檢查：原始用戶、管理員權限
 * - 錯誤處理
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PermissionFlagsBits } from 'discord.js';

// ============================================
// Mock 設定 - 使用 vi.hoisted 確保持久化
// ============================================

const { mockPurge, mockLoggerError } = vi.hoisted(() => ({
  mockPurge: vi.fn(),
  mockLoggerError: vi.fn(),
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
  createUnauthorizedReply: vi.fn().mockReturnValue({
    content: 'Unauthorized',
    flags: 64,
  }),
}));

// ============================================
// 現在可以安全地 import
// ============================================

import confirmPurge from '../../../../src/interactions/buttons/confirmPurge.js';
import { createMockButtonInteraction, createMockClient } from '../../../helpers/discord-mocks.js';
import type { Services } from '../../../../src/interfaces/Command.js';

describe('confirmPurge', () => {
  let mockServices: Services;

  beforeEach(() => {
    vi.clearAllMocks();

    mockServices = {
      localizationManager: {
        get: vi.fn().mockReturnValue('translated'),
      },
      ticketManager: {
        purge: mockPurge,
      },
      settingsManager: {},
      helpService: {},
      forumService: {},
      cacheService: {},
      storyForumService: {},
    } as unknown as Services;

    mockPurge.mockResolvedValue(undefined);
  });

  describe('name', () => {
    it('should have correct button name pattern', () => {
      expect(confirmPurge.name).toBe('confirm_purge:');
    });
  });

  describe('execute', () => {
    it('should purge tickets successfully when original user confirms', async () => {
      // Arrange
      const userId = 'admin-user-123';
      const guildId = 'guild-123';
      const interaction = createMockButtonInteraction({
        customId: `confirm_purge:${userId}`,
        userId,
        guildId,
      });
      // Mock admin permissions
      (interaction as any).memberPermissions = {
        has: vi.fn().mockReturnValue(true),
      };
      // Mock component for disabling
      (interaction as any).component = {
        toJSON: () => ({ type: 2, custom_id: `confirm_purge:${userId}` }),
      };
      const client = createMockClient();

      // Act
      await confirmPurge.execute(interaction, client, mockServices);

      // Assert
      expect(interaction.deferUpdate).toHaveBeenCalled();
      expect(mockPurge).toHaveBeenCalledWith(guildId);
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('permanently deleted'),
        })
      );
    });

    it('should reject when different user tries to confirm', async () => {
      // Arrange
      const originalUserId = 'admin-user-123';
      const differentUserId = 'different-user-456';
      const interaction = createMockButtonInteraction({
        customId: `confirm_purge:${originalUserId}`,
        userId: differentUserId,
      });
      const client = createMockClient();

      // Act
      await confirmPurge.execute(interaction, client, mockServices);

      // Assert
      expect(interaction.deferUpdate).toHaveBeenCalled();
      expect(interaction.followUp).toHaveBeenCalled();
      expect(mockPurge).not.toHaveBeenCalled();
    });

    it('should throw MissingPermissionsError when user lacks admin permission', async () => {
      // Arrange
      const userId = 'user-123';
      const interaction = createMockButtonInteraction({
        customId: `confirm_purge:${userId}`,
        userId,
      });
      // Mock no admin permissions
      (interaction as any).memberPermissions = {
        has: vi.fn().mockReturnValue(false),
      };
      const client = createMockClient();

      // Act & Assert
      await expect(
        confirmPurge.execute(interaction, client, mockServices)
      ).rejects.toThrow('You no longer have permission to do this.');
    });

    it('should handle purge error and show error message', async () => {
      // Arrange
      const userId = 'admin-user-123';
      const interaction = createMockButtonInteraction({
        customId: `confirm_purge:${userId}`,
        userId,
      });
      (interaction as any).memberPermissions = {
        has: vi.fn().mockReturnValue(true),
      };
      (interaction as any).component = {
        toJSON: () => ({ type: 2, custom_id: `confirm_purge:${userId}` }),
      };
      mockPurge.mockRejectedValue(new Error('Database error'));
      const client = createMockClient();

      // Act
      await confirmPurge.execute(interaction, client, mockServices);

      // Assert
      expect(mockLoggerError).toHaveBeenCalledWith(
        'Failed to purge tickets:',
        expect.any(Error)
      );
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('error occurred'),
          components: [],
        })
      );
    });

    it('should disable button after successful purge', async () => {
      // Arrange
      const userId = 'admin-user-123';
      const interaction = createMockButtonInteraction({
        customId: `confirm_purge:${userId}`,
        userId,
        guildId: 'guild-123',
      });
      (interaction as any).memberPermissions = {
        has: vi.fn().mockReturnValue(true),
      };
      (interaction as any).component = {
        toJSON: () => ({ type: 2, custom_id: `confirm_purge:${userId}`, disabled: false }),
      };
      const client = createMockClient();

      // Act
      await confirmPurge.execute(interaction, client, mockServices);

      // Assert
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          components: expect.any(Array),
        })
      );
    });
  });
});
