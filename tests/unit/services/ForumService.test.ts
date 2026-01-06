/**
 * ForumService 單元測試
 *
 * 測試範圍：
 * - handleSolveCommand(): 處理 ?solved 指令
 *   - 權限檢查（貼文擁有者 vs 管理員）
 *   - 論壇標籤操作
 *   - 錯誤處理
 *
 * Mock 策略：
 * - Discord Message, ThreadChannel, ForumChannel
 * - Config: mock guildId
 * - Logger: mock 錯誤日誌
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChannelType, Collection } from 'discord.js';

// ============================================
// Mock 設定 - 使用 vi.hoisted 確保持久化
// ============================================

const { mockLoggerError, mockGuildId } = vi.hoisted(() => ({
  mockLoggerError: vi.fn(),
  mockGuildId: 'test-guild-123',
}));

// Mock config
vi.mock('../../../src/config.js', () => ({
  default: {
    discord: {
      guildId: mockGuildId,
    },
  },
}));

// Mock logger
vi.mock('../../../src/utils/logger.js', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: mockLoggerError,
  },
}));

// ============================================
// 現在可以安全地 import
// ============================================

import { ForumService } from '../../../src/services/ForumService.js';

// ============================================
// 測試輔助函數
// ============================================

function createMockForumChannel(options: {
  tags?: Array<{ id: string; name: string }>;
} = {}) {
  return {
    type: ChannelType.GuildForum,
    availableTags: options.tags ?? [
      { id: 'tag-solved', name: 'Solved' },
      { id: 'tag-help', name: 'Help' },
    ],
  };
}

function createMockThread(options: {
  parentType?: number;
  appliedTags?: string[];
  starterMessageAuthor?: string;
  parent?: any;
} = {}) {
  const mockSetAppliedTags = vi.fn().mockResolvedValue(undefined);
  const mockSetLocked = vi.fn().mockResolvedValue(undefined);
  const mockFetchStarterMessage = vi.fn().mockResolvedValue({
    author: { id: options.starterMessageAuthor ?? 'owner-123' },
  });

  return {
    isThread: () => true,
    id: 'thread-123',
    appliedTags: options.appliedTags ?? [],
    parent: options.parent ?? createMockForumChannel(),
    setAppliedTags: mockSetAppliedTags,
    setLocked: mockSetLocked,
    fetchStarterMessage: mockFetchStarterMessage,
  };
}

function createMockMessage(options: {
  guildId?: string | null;
  content?: string;
  authorId?: string;
  isThread?: boolean;
  channel?: any;
  hasManageThreads?: boolean;
} = {}) {
  const mockReply = vi.fn().mockResolvedValue(undefined);
  const mockReact = vi.fn().mockResolvedValue(undefined);

  const thread = options.channel ?? createMockThread({
    starterMessageAuthor: options.authorId ?? 'user-123',
  });

  return {
    guild: options.guildId === null ? null : {
      id: options.guildId ?? mockGuildId,
      members: {
        fetch: vi.fn().mockResolvedValue({
          permissions: {
            has: vi.fn().mockReturnValue(options.hasManageThreads ?? false),
          },
        }),
      },
    },
    channel: {
      isThread: () => options.isThread ?? true,
      ...thread,
    },
    content: options.content ?? '?solved',
    author: {
      id: options.authorId ?? 'user-123',
    },
    reply: mockReply,
    react: mockReact,
  };
}

describe('ForumService', () => {
  let forumService: ForumService;

  beforeEach(() => {
    vi.clearAllMocks();
    forumService = new ForumService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================
  // handleSolveCommand() 測試
  // ============================================

  describe('handleSolveCommand()', () => {
    describe('early return conditions', () => {
      it('should return early when not in a guild', async () => {
        // Arrange
        const message = createMockMessage({ guildId: null });

        // Act
        await forumService.handleSolveCommand(message as any);

        // Assert
        expect(message.reply).not.toHaveBeenCalled();
        expect(message.react).not.toHaveBeenCalled();
      });

      it('should return early when in wrong guild', async () => {
        // Arrange
        const message = createMockMessage({ guildId: 'different-guild' });

        // Act
        await forumService.handleSolveCommand(message as any);

        // Assert
        expect(message.reply).not.toHaveBeenCalled();
      });

      it('should return early when not in a thread', async () => {
        // Arrange
        const message = createMockMessage({ isThread: false });

        // Act
        await forumService.handleSolveCommand(message as any);

        // Assert
        expect(message.reply).not.toHaveBeenCalled();
      });

      it('should return early when content is not ?solved', async () => {
        // Arrange
        const message = createMockMessage({ content: 'Hello world' });

        // Act
        await forumService.handleSolveCommand(message as any);

        // Assert
        expect(message.reply).not.toHaveBeenCalled();
      });

      it('should return early when content has extra text', async () => {
        // Arrange
        const message = createMockMessage({ content: '?solved please' });

        // Act
        await forumService.handleSolveCommand(message as any);

        // Assert
        expect(message.reply).not.toHaveBeenCalled();
      });

      it('should return early when starter message cannot be fetched', async () => {
        // Arrange
        const thread = createMockThread();
        thread.fetchStarterMessage.mockRejectedValue(new Error('Not found'));
        const message = createMockMessage({ channel: thread });

        // Act
        await forumService.handleSolveCommand(message as any);

        // Assert
        expect(message.reply).not.toHaveBeenCalled();
        expect(message.react).not.toHaveBeenCalled();
      });
    });

    describe('permission checking', () => {
      it('should allow thread owner to solve', async () => {
        // Arrange
        const authorId = 'owner-123';
        const thread = createMockThread({ starterMessageAuthor: authorId });
        const message = createMockMessage({
          authorId,
          channel: thread,
          hasManageThreads: false,
        });

        // Act
        await forumService.handleSolveCommand(message as any);

        // Assert
        expect(thread.setAppliedTags).toHaveBeenCalled();
        expect(thread.setLocked).toHaveBeenCalled();
        expect(message.react).toHaveBeenCalledWith('✅');
      });

      it('should allow admin to solve any thread', async () => {
        // Arrange
        const thread = createMockThread({ starterMessageAuthor: 'different-user' });
        const message = createMockMessage({
          authorId: 'admin-123',
          channel: thread,
          hasManageThreads: true,
        });

        // Act
        await forumService.handleSolveCommand(message as any);

        // Assert
        expect(thread.setAppliedTags).toHaveBeenCalled();
        expect(thread.setLocked).toHaveBeenCalled();
        expect(message.react).toHaveBeenCalledWith('✅');
      });

      it('should deny non-owner non-admin users', async () => {
        // Arrange
        const thread = createMockThread({ starterMessageAuthor: 'owner-123' });
        const message = createMockMessage({
          authorId: 'random-user',
          channel: thread,
          hasManageThreads: false,
        });

        // Act
        await forumService.handleSolveCommand(message as any);

        // Assert
        expect(thread.setAppliedTags).not.toHaveBeenCalled();
        expect(message.react).not.toHaveBeenCalled();
      });
    });

    describe('forum channel validation', () => {
      it('should return early when parent is not a forum channel', async () => {
        // Arrange
        const thread = createMockThread({
          starterMessageAuthor: 'user-123',
          parent: { type: ChannelType.GuildText },
        });
        const message = createMockMessage({
          authorId: 'user-123',
          channel: thread,
        });

        // Act
        await forumService.handleSolveCommand(message as any);

        // Assert
        expect(thread.setAppliedTags).not.toHaveBeenCalled();
      });

      it('should reply when Solved tag does not exist', async () => {
        // Arrange
        const forumChannel = createMockForumChannel({
          tags: [{ id: 'tag-1', name: 'Help' }], // No 'Solved' tag
        });
        const thread = createMockThread({
          starterMessageAuthor: 'user-123',
          parent: forumChannel,
        });
        const message = createMockMessage({
          authorId: 'user-123',
          channel: thread,
        });

        // Act
        await forumService.handleSolveCommand(message as any);

        // Assert
        expect(message.reply).toHaveBeenCalledWith(
          expect.stringContaining("此論壇沒有 'Solved' 標籤")
        );
      });

      it('should find Solved tag case-insensitively', async () => {
        // Arrange
        const forumChannel = createMockForumChannel({
          tags: [{ id: 'tag-solved', name: 'SOLVED' }], // Uppercase
        });
        const thread = createMockThread({
          starterMessageAuthor: 'user-123',
          parent: forumChannel,
        });
        const message = createMockMessage({
          authorId: 'user-123',
          channel: thread,
        });

        // Act
        await forumService.handleSolveCommand(message as any);

        // Assert
        expect(thread.setAppliedTags).toHaveBeenCalled();
      });
    });

    describe('tagging and locking', () => {
      it('should add Solved tag to thread', async () => {
        // Arrange
        const thread = createMockThread({
          starterMessageAuthor: 'user-123',
          appliedTags: ['tag-help'],
        });
        const message = createMockMessage({
          authorId: 'user-123',
          channel: thread,
        });

        // Act
        await forumService.handleSolveCommand(message as any);

        // Assert
        expect(thread.setAppliedTags).toHaveBeenCalledWith(
          expect.arrayContaining(['tag-help', 'tag-solved'])
        );
      });

      it('should not duplicate Solved tag', async () => {
        // Arrange
        const thread = createMockThread({
          starterMessageAuthor: 'user-123',
          appliedTags: ['tag-solved', 'tag-help'],
        });
        const message = createMockMessage({
          authorId: 'user-123',
          channel: thread,
        });

        // Act
        await forumService.handleSolveCommand(message as any);

        // Assert
        const callArgs = thread.setAppliedTags.mock.calls[0][0];
        const solvedCount = callArgs.filter((t: string) => t === 'tag-solved').length;
        expect(solvedCount).toBe(1);
      });

      it('should lock the thread after solving', async () => {
        // Arrange
        const thread = createMockThread({ starterMessageAuthor: 'user-123' });
        const message = createMockMessage({
          authorId: 'user-123',
          channel: thread,
        });

        // Act
        await forumService.handleSolveCommand(message as any);

        // Assert
        expect(thread.setLocked).toHaveBeenCalledWith(true);
      });

      it('should react with checkmark on success', async () => {
        // Arrange
        const thread = createMockThread({ starterMessageAuthor: 'user-123' });
        const message = createMockMessage({
          authorId: 'user-123',
          channel: thread,
        });

        // Act
        await forumService.handleSolveCommand(message as any);

        // Assert
        expect(message.react).toHaveBeenCalledWith('✅');
      });
    });

    describe('error handling', () => {
      it('should log and reply on setAppliedTags error', async () => {
        // Arrange
        const thread = createMockThread({ starterMessageAuthor: 'user-123' });
        thread.setAppliedTags.mockRejectedValue(new Error('API error'));
        const message = createMockMessage({
          authorId: 'user-123',
          channel: thread,
        });

        // Act
        await forumService.handleSolveCommand(message as any);

        // Assert
        expect(mockLoggerError).toHaveBeenCalledWith(
          expect.stringContaining('Failed to solve thread'),
          expect.any(Error)
        );
        expect(message.reply).toHaveBeenCalledWith(
          expect.stringContaining('發生錯誤')
        );
      });

      it('should log and reply on setLocked error', async () => {
        // Arrange
        const thread = createMockThread({ starterMessageAuthor: 'user-123' });
        thread.setLocked.mockRejectedValue(new Error('Permission denied'));
        const message = createMockMessage({
          authorId: 'user-123',
          channel: thread,
        });

        // Act
        await forumService.handleSolveCommand(message as any);

        // Assert
        expect(mockLoggerError).toHaveBeenCalled();
        expect(message.reply).toHaveBeenCalledWith(
          expect.stringContaining('發生錯誤')
        );
      });
    });
  });
});
