/**
 * Story Buttons 單元測試
 *
 * 合併測試 storyEntryPrompt 和 storySubscribe
 *
 * 測試範圍：
 * - storyEntryPrompt: 處理故事入口提示按鈕（yes/no/never）
 * - storySubscribe: 處理故事訂閱/取消訂閱按鈕
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// Mock 設定 - 使用 vi.hoisted 確保持久化
// ============================================

const {
  mockCreateSubscriptionEntry,
  mockSendSubscriptionEntryMessage,
  mockSetAuthorPreference,
  mockSubscribeToThread,
  mockUnsubscribeFromThread,
  mockGetSubscriberCount,
  mockLoggerError,
  mockLoggerWarn,
} = vi.hoisted(() => ({
  mockCreateSubscriptionEntry: vi.fn(),
  mockSendSubscriptionEntryMessage: vi.fn(),
  mockSetAuthorPreference: vi.fn(),
  mockSubscribeToThread: vi.fn(),
  mockUnsubscribeFromThread: vi.fn(),
  mockGetSubscriberCount: vi.fn(),
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

// ============================================
// 現在可以安全地 import
// ============================================

import storyEntryPrompt from '../../../../src/interactions/buttons/storyEntryPrompt.js';
import storySubscribe from '../../../../src/interactions/buttons/storySubscribe.js';
import { createMockButtonInteraction, createMockClient, createMockMessage } from '../../../helpers/discord-mocks.js';
import type { Services, Databases } from '../../../../src/interfaces/Command.js';

describe('storyEntryPrompt', () => {
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
      storyForumService: {
        createSubscriptionEntry: mockCreateSubscriptionEntry,
        sendSubscriptionEntryMessage: mockSendSubscriptionEntryMessage,
        setAuthorPreference: mockSetAuthorPreference,
      },
    } as unknown as Services;

    mockDatabases = {} as Databases;

    mockCreateSubscriptionEntry.mockResolvedValue(true);
    mockSendSubscriptionEntryMessage.mockResolvedValue(true);
    mockSetAuthorPreference.mockResolvedValue(true);
  });

  describe('name', () => {
    it('should match story_entry buttons with regex', () => {
      expect(storyEntryPrompt.name).toBeInstanceOf(RegExp);
      expect((storyEntryPrompt.name as RegExp).test('story_entry_yes:thread123:user456')).toBe(true);
      expect((storyEntryPrompt.name as RegExp).test('story_entry_no:thread123:user456')).toBe(true);
      expect((storyEntryPrompt.name as RegExp).test('story_entry_never:thread123:user456')).toBe(true);
    });
  });

  describe('execute - story_entry_yes', () => {
    it('should create subscription entry and send message', async () => {
      // Arrange
      const authorId = 'author-123';
      const threadId = 'thread-456';
      const interaction = createMockButtonInteraction({
        customId: `story_entry_yes:${threadId}:${authorId}`,
        userId: authorId,
      });
      const client = createMockClient();

      // Act
      await storyEntryPrompt.execute(interaction, client, mockServices, mockDatabases);

      // Assert
      expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
      expect(mockCreateSubscriptionEntry).toHaveBeenCalledWith(threadId);
      expect(mockSendSubscriptionEntryMessage).toHaveBeenCalledWith(threadId);
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('成功創建'),
        })
      );
      expect(interaction.message.delete).toHaveBeenCalled();
    });

    it('should reject when user is not the author', async () => {
      // Arrange
      const authorId = 'author-123';
      const differentUserId = 'different-user-456';
      const threadId = 'thread-456';
      const interaction = createMockButtonInteraction({
        customId: `story_entry_yes:${threadId}:${authorId}`,
        userId: differentUserId,
      });
      const client = createMockClient();

      // Act
      await storyEntryPrompt.execute(interaction, client, mockServices, mockDatabases);

      // Assert
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          ephemeral: true,
          content: expect.stringContaining('只有貼文作者'),
        })
      );
      expect(mockCreateSubscriptionEntry).not.toHaveBeenCalled();
    });

    it('should handle subscription entry creation failure', async () => {
      // Arrange
      const authorId = 'author-123';
      const threadId = 'thread-456';
      mockCreateSubscriptionEntry.mockResolvedValue(false);
      const interaction = createMockButtonInteraction({
        customId: `story_entry_yes:${threadId}:${authorId}`,
        userId: authorId,
      });
      const client = createMockClient();

      // Act
      await storyEntryPrompt.execute(interaction, client, mockServices, mockDatabases);

      // Assert
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('創建訂閱入口失敗'),
        })
      );
    });

    it('should handle message sending failure', async () => {
      // Arrange
      const authorId = 'author-123';
      const threadId = 'thread-456';
      mockSendSubscriptionEntryMessage.mockResolvedValue(false);
      const interaction = createMockButtonInteraction({
        customId: `story_entry_yes:${threadId}:${authorId}`,
        userId: authorId,
      });
      const client = createMockClient();

      // Act
      await storyEntryPrompt.execute(interaction, client, mockServices, mockDatabases);

      // Assert
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('發送訂閱入口訊息失敗'),
        })
      );
    });
  });

  describe('execute - story_entry_no', () => {
    it('should decline without setting preference', async () => {
      // Arrange
      const authorId = 'author-123';
      const threadId = 'thread-456';
      const interaction = createMockButtonInteraction({
        customId: `story_entry_no:${threadId}:${authorId}`,
        userId: authorId,
      });
      const client = createMockClient();

      // Act
      await storyEntryPrompt.execute(interaction, client, mockServices, mockDatabases);

      // Assert
      expect(mockSetAuthorPreference).not.toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('這次不創建'),
        })
      );
      expect(interaction.message.delete).toHaveBeenCalled();
    });
  });

  describe('execute - story_entry_never', () => {
    it('should set author preference to never ask again', async () => {
      // Arrange
      const authorId = 'author-123';
      const threadId = 'thread-456';
      const interaction = createMockButtonInteraction({
        customId: `story_entry_never:${threadId}:${authorId}`,
        userId: authorId,
      });
      const client = createMockClient();

      // Act
      await storyEntryPrompt.execute(interaction, client, mockServices, mockDatabases);

      // Assert
      expect(mockSetAuthorPreference).toHaveBeenCalledWith(authorId, false);
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('不再提醒'),
        })
      );
      expect(interaction.message.delete).toHaveBeenCalled();
    });

    it('should handle preference setting failure', async () => {
      // Arrange
      const authorId = 'author-123';
      const threadId = 'thread-456';
      mockSetAuthorPreference.mockResolvedValue(false);
      const interaction = createMockButtonInteraction({
        customId: `story_entry_never:${threadId}:${authorId}`,
        userId: authorId,
      });
      const client = createMockClient();

      // Act
      await storyEntryPrompt.execute(interaction, client, mockServices, mockDatabases);

      // Assert
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('設定偏好失敗'),
        })
      );
    });
  });

  describe('error handling', () => {
    it('should handle errors and reply with error message', async () => {
      // Arrange
      const authorId = 'author-123';
      const threadId = 'thread-456';
      mockCreateSubscriptionEntry.mockRejectedValue(new Error('Database error'));
      const interaction = createMockButtonInteraction({
        customId: `story_entry_yes:${threadId}:${authorId}`,
        userId: authorId,
      });
      const client = createMockClient();

      // Act
      await storyEntryPrompt.execute(interaction, client, mockServices, mockDatabases);

      // Assert
      expect(mockLoggerError).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('發生錯誤'),
        })
      );
    });
  });
});

describe('storySubscribe', () => {
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
      storyForumService: {
        subscribeToThread: mockSubscribeToThread,
        unsubscribeFromThread: mockUnsubscribeFromThread,
        getSubscriberCount: mockGetSubscriberCount,
        sendSubscriptionEntryMessage: mockSendSubscriptionEntryMessage,
      },
    } as unknown as Services;

    mockDatabases = {} as Databases;

    mockSubscribeToThread.mockResolvedValue(true);
    mockUnsubscribeFromThread.mockResolvedValue(true);
    mockGetSubscriberCount.mockResolvedValue(10);
    mockSendSubscriptionEntryMessage.mockResolvedValue(true);
  });

  describe('name', () => {
    it('should match subscribe/unsubscribe buttons with regex', () => {
      expect(storySubscribe.name).toBeInstanceOf(RegExp);
      expect((storySubscribe.name as RegExp).test('story_subscribe:thread123:release')).toBe(true);
      expect((storySubscribe.name as RegExp).test('story_subscribe:thread123:test')).toBe(true);
      expect((storySubscribe.name as RegExp).test('story_subscribe:thread123:author_all')).toBe(true);
      expect((storySubscribe.name as RegExp).test('story_unsubscribe:thread123')).toBe(true);
    });
  });

  describe('execute - story_subscribe', () => {
    it('should subscribe to release updates', async () => {
      // Arrange
      const threadId = 'thread-456';
      const userId = 'user-123';
      const interaction = createMockButtonInteraction({
        customId: `story_subscribe:${threadId}:release`,
        userId,
      });
      const client = createMockClient();

      // Act
      await storySubscribe.execute(interaction, client, mockServices, mockDatabases);

      // Assert
      expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
      expect(mockSubscribeToThread).toHaveBeenCalledWith(threadId, userId, 'release');
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('成功訂閱'),
        })
      );
    });

    it('should subscribe to test updates', async () => {
      // Arrange
      const threadId = 'thread-456';
      const userId = 'user-123';
      const interaction = createMockButtonInteraction({
        customId: `story_subscribe:${threadId}:test`,
        userId,
      });
      const client = createMockClient();

      // Act
      await storySubscribe.execute(interaction, client, mockServices, mockDatabases);

      // Assert
      expect(mockSubscribeToThread).toHaveBeenCalledWith(threadId, userId, 'test');
    });

    it('should subscribe to author_all updates', async () => {
      // Arrange
      const threadId = 'thread-456';
      const userId = 'user-123';
      const interaction = createMockButtonInteraction({
        customId: `story_subscribe:${threadId}:author_all`,
        userId,
      });
      const client = createMockClient();

      // Act
      await storySubscribe.execute(interaction, client, mockServices, mockDatabases);

      // Assert
      expect(mockSubscribeToThread).toHaveBeenCalledWith(threadId, userId, 'author_all');
    });

    it('should reject invalid subscription type', async () => {
      // Arrange
      const threadId = 'thread-456';
      const interaction = createMockButtonInteraction({
        customId: `story_subscribe:${threadId}`, // Missing type
        userId: 'user-123',
      });
      const client = createMockClient();

      // Act
      await storySubscribe.execute(interaction, client, mockServices, mockDatabases);

      // Assert
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('無效的訂閱類型'),
        })
      );
    });

    it('should handle already subscribed', async () => {
      // Arrange
      mockSubscribeToThread.mockResolvedValue(false);
      const threadId = 'thread-456';
      const interaction = createMockButtonInteraction({
        customId: `story_subscribe:${threadId}:release`,
        userId: 'user-123',
      });
      const client = createMockClient();

      // Act
      await storySubscribe.execute(interaction, client, mockServices, mockDatabases);

      // Assert
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('訂閱失敗'),
        })
      );
    });

    it('should display subscriber counts after subscribing', async () => {
      // Arrange
      mockGetSubscriberCount.mockImplementation((_threadId, type) => {
        if (type === 'release') return Promise.resolve(15);
        if (type === 'test') return Promise.resolve(5);
        if (type === 'author_all') return Promise.resolve(3);
        return Promise.resolve(0);
      });
      const threadId = 'thread-456';
      const interaction = createMockButtonInteraction({
        customId: `story_subscribe:${threadId}:release`,
        userId: 'user-123',
      });
      const client = createMockClient();

      // Act
      await storySubscribe.execute(interaction, client, mockServices, mockDatabases);

      // Assert
      expect(mockGetSubscriberCount).toHaveBeenCalledWith(threadId, 'release');
      expect(mockGetSubscriberCount).toHaveBeenCalledWith(threadId, 'test');
      expect(mockGetSubscriberCount).toHaveBeenCalledWith(threadId, 'author_all');
    });
  });

  describe('execute - story_unsubscribe', () => {
    it('should unsubscribe from all types', async () => {
      // Arrange
      const threadId = 'thread-456';
      const userId = 'user-123';
      const interaction = createMockButtonInteraction({
        customId: `story_unsubscribe:${threadId}`,
        userId,
      });
      const client = createMockClient();

      // Act
      await storySubscribe.execute(interaction, client, mockServices, mockDatabases);

      // Assert
      expect(mockUnsubscribeFromThread).toHaveBeenCalledWith(threadId, userId);
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('取消所有訂閱'),
        })
      );
    });

    it('should handle not subscribed', async () => {
      // Arrange
      mockUnsubscribeFromThread.mockResolvedValue(false);
      const threadId = 'thread-456';
      const interaction = createMockButtonInteraction({
        customId: `story_unsubscribe:${threadId}`,
        userId: 'user-123',
      });
      const client = createMockClient();

      // Act
      await storySubscribe.execute(interaction, client, mockServices, mockDatabases);

      // Assert
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('取消訂閱失敗'),
        })
      );
    });
  });

  describe('error handling', () => {
    it('should handle errors gracefully', async () => {
      // Arrange
      mockSubscribeToThread.mockRejectedValue(new Error('Database error'));
      const threadId = 'thread-456';
      const interaction = createMockButtonInteraction({
        customId: `story_subscribe:${threadId}:release`,
        userId: 'user-123',
      });
      const client = createMockClient();

      // Act
      await storySubscribe.execute(interaction, client, mockServices, mockDatabases);

      // Assert
      expect(mockLoggerError).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('發生錯誤'),
        })
      );
    });
  });
});
