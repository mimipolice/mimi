/**
 * StoryForumService 單元測試
 *
 * 測試範圍：
 * - Thread 管理: registerThread, getThreadInfo
 * - 訂閱系統: subscribe, unsubscribe, isUserSubscribed, getThreadSubscribers
 * - 通知系統: notifySubscribers
 * - 訂閱入口: createSubscriptionEntry, sendSubscriptionEntryMessage, hasSubscriptionEntry
 * - 權限管理: addPermission, removePermission, hasPermission (5人限制)
 * - 作者偏好: getAuthorPreference, setAuthorPreference
 *
 * Mock 策略：
 * - Kysely: 使用 createMockKysely 建立完整 mock
 * - Discord.js Client: mock channels.fetch, send 等方法
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================
// Mock 設定 - 使用 vi.hoisted 確保持久化
// ============================================

const {
  mockLoggerDebug,
  mockLoggerInfo,
  mockLoggerWarn,
  mockLoggerError,
  mockConfig,
} = vi.hoisted(() => ({
  mockLoggerDebug: vi.fn(),
  mockLoggerInfo: vi.fn(),
  mockLoggerWarn: vi.fn(),
  mockLoggerError: vi.fn(),
  mockConfig: {
    discord: {
      guildId: 'test-guild-123',
    },
  },
}));

// Mock logger
vi.mock('../../../src/utils/logger.js', () => ({
  default: {
    debug: mockLoggerDebug,
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    error: mockLoggerError,
  },
}));

// Mock config
vi.mock('../../../src/config.js', () => ({
  default: mockConfig,
}));

// ============================================
// Import after mocks
// ============================================

import { StoryForumService } from '../../../src/services/StoryForumService.js';

// ============================================
// Kysely Mock Helper
// ============================================

function createMockKysely() {
  const mockExecute = vi.fn().mockResolvedValue([]);
  const mockExecuteTakeFirst = vi.fn().mockResolvedValue(undefined);

  const createChainableMock = () => {
    const chain: any = {};

    // Build the chain object with self-references
    chain.values = vi.fn().mockReturnValue(chain);
    chain.set = vi.fn().mockReturnValue(chain);
    chain.selectAll = vi.fn().mockReturnValue(chain);
    chain.select = vi.fn().mockReturnValue(chain);
    chain.where = vi.fn().mockReturnValue(chain);
    chain.execute = mockExecute;
    chain.executeTakeFirst = mockExecuteTakeFirst;
    chain.onConflict = vi.fn().mockImplementation((callback?: (oc: any) => any) => {
      const oc = {
        doNothing: vi.fn().mockReturnValue(chain),
        column: vi.fn().mockReturnValue({
          doUpdateSet: vi.fn().mockReturnValue(chain),
        }),
      };
      if (callback) callback(oc);
      return chain;
    });

    return chain;
  };

  return {
    insertInto: vi.fn().mockImplementation(() => createChainableMock()),
    selectFrom: vi.fn().mockImplementation(() => createChainableMock()),
    updateTable: vi.fn().mockImplementation(() => createChainableMock()),
    deleteFrom: vi.fn().mockImplementation(() => createChainableMock()),
    _mockExecute: mockExecute,
    _mockExecuteTakeFirst: mockExecuteTakeFirst,
  };
}

// ============================================
// Discord Mock Helpers
// ============================================

function createMockThread(overrides: Partial<{
  id: string;
  ownerId: string;
  guild: { id: string };
  send: ReturnType<typeof vi.fn>;
  messages: { fetch: ReturnType<typeof vi.fn> };
  isThread: () => boolean;
}> = {}) {
  return {
    id: overrides.id ?? 'thread-123',
    ownerId: overrides.ownerId ?? 'owner-123',
    guild: overrides.guild ?? { id: 'test-guild-123' },
    send: overrides.send ?? vi.fn().mockResolvedValue({ id: 'message-123' }),
    messages: overrides.messages ?? {
      fetch: vi.fn().mockResolvedValue({
        id: 'message-123',
        edit: vi.fn().mockResolvedValue(undefined),
      }),
    },
    isThread: overrides.isThread ?? (() => true),
  };
}

function createMockClient(overrides: Partial<{
  channels: { fetch: ReturnType<typeof vi.fn> };
}> = {}) {
  return {
    channels: overrides.channels ?? {
      fetch: vi.fn(),
    },
  };
}

describe('StoryForumService', () => {
  let service: StoryForumService;
  let mockDb: ReturnType<typeof createMockKysely>;
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockKysely();
    mockClient = createMockClient();
    service = new StoryForumService(mockDb as any, mockClient as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================
  // registerThread() 測試
  // ============================================

  describe('registerThread()', () => {
    it('should register thread from matching guild', async () => {
      // Arrange
      const mockThread = createMockThread();

      // Act
      await service.registerThread(mockThread as any);

      // Assert
      expect(mockDb.insertInto).toHaveBeenCalledWith('story_forum_threads');
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        expect.stringContaining('Registering new story thread')
      );
    });

    it('should skip registration for non-matching guild', async () => {
      // Arrange
      const mockThread = createMockThread({
        guild: { id: 'different-guild-456' },
      });

      // Act
      await service.registerThread(mockThread as any);

      // Assert
      expect(mockDb.insertInto).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // getThreadInfo() 測試
  // ============================================

  describe('getThreadInfo()', () => {
    it('should return thread info when found', async () => {
      // Arrange
      const expectedInfo = {
        thread_id: 'thread-123',
        author_id: 'author-456',
        status: 'validated',
      };
      mockDb._mockExecuteTakeFirst.mockResolvedValueOnce(expectedInfo);

      // Act
      const result = await service.getThreadInfo('thread-123');

      // Assert
      expect(mockDb.selectFrom).toHaveBeenCalledWith('story_forum_threads');
      expect(result).toEqual(expectedInfo);
    });

    it('should return undefined when thread not found', async () => {
      // Arrange
      mockDb._mockExecuteTakeFirst.mockResolvedValueOnce(undefined);

      // Act
      const result = await service.getThreadInfo('non-existent');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  // ============================================
  // subscribeToThread() 測試
  // ============================================

  describe('subscribeToThread()', () => {
    it('should subscribe user to validated thread', async () => {
      // Arrange
      mockDb._mockExecuteTakeFirst.mockResolvedValueOnce({
        thread_id: 'thread-123',
        status: 'validated',
      });

      // Act
      const result = await service.subscribeToThread('thread-123', 'user-456', 'release');

      // Assert
      expect(result).toBe(true);
      expect(mockDb.insertInto).toHaveBeenCalledWith('story_forum_subscriptions');
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        expect.stringContaining('subscribed to thread')
      );
    });

    it('should return false for non-validated thread', async () => {
      // Arrange
      mockDb._mockExecuteTakeFirst.mockResolvedValueOnce({
        thread_id: 'thread-123',
        status: 'pending',
      });

      // Act
      const result = await service.subscribeToThread('thread-123', 'user-456');

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when thread not found', async () => {
      // Arrange
      mockDb._mockExecuteTakeFirst.mockResolvedValueOnce(undefined);

      // Act
      const result = await service.subscribeToThread('non-existent', 'user-456');

      // Assert
      expect(result).toBe(false);
    });

    it('should use default subscription type "release"', async () => {
      // Arrange
      mockDb._mockExecuteTakeFirst.mockResolvedValueOnce({
        thread_id: 'thread-123',
        status: 'validated',
      });

      // Act
      await service.subscribeToThread('thread-123', 'user-456');

      // Assert
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        expect.stringContaining('type release')
      );
    });

    it('should return false and log error on database error', async () => {
      // Arrange
      mockDb._mockExecuteTakeFirst.mockRejectedValueOnce(new Error('DB Error'));

      // Act
      const result = await service.subscribeToThread('thread-123', 'user-456');

      // Assert
      expect(result).toBe(false);
      expect(mockLoggerError).toHaveBeenCalled();
    });
  });

  // ============================================
  // unsubscribeFromThread() 測試
  // ============================================

  describe('unsubscribeFromThread()', () => {
    it('should unsubscribe user from thread', async () => {
      // Arrange
      mockDb._mockExecuteTakeFirst.mockResolvedValueOnce({ numDeletedRows: 1n });

      // Act
      const result = await service.unsubscribeFromThread('thread-123', 'user-456');

      // Assert
      expect(result).toBe(true);
      expect(mockDb.deleteFrom).toHaveBeenCalledWith('story_forum_subscriptions');
    });

    it('should return false when no rows deleted', async () => {
      // Arrange
      mockDb._mockExecuteTakeFirst.mockResolvedValueOnce({ numDeletedRows: 0n });

      // Act
      const result = await service.unsubscribeFromThread('thread-123', 'user-456');

      // Assert
      expect(result).toBe(false);
    });

    it('should filter by subscription type when provided', async () => {
      // Arrange
      mockDb._mockExecuteTakeFirst.mockResolvedValueOnce({ numDeletedRows: 1n });

      // Act
      await service.unsubscribeFromThread('thread-123', 'user-456', 'test');

      // Assert
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        expect.stringContaining('type: test')
      );
    });
  });

  // ============================================
  // getThreadSubscribers() 測試
  // ============================================

  describe('getThreadSubscribers()', () => {
    it('should return list of subscriber user IDs', async () => {
      // Arrange
      mockDb._mockExecute.mockResolvedValueOnce([
        { user_id: 'user-1' },
        { user_id: 'user-2' },
        { user_id: 'user-3' },
      ]);

      // Act
      const result = await service.getThreadSubscribers('thread-123');

      // Assert
      expect(result).toEqual(['user-1', 'user-2', 'user-3']);
    });

    it('should deduplicate subscriber IDs', async () => {
      // Arrange
      mockDb._mockExecute.mockResolvedValueOnce([
        { user_id: 'user-1' },
        { user_id: 'user-1' },
        { user_id: 'user-2' },
      ]);

      // Act
      const result = await service.getThreadSubscribers('thread-123');

      // Assert
      expect(result).toEqual(['user-1', 'user-2']);
    });

    it('should return empty array on error', async () => {
      // Arrange
      mockDb._mockExecute.mockRejectedValueOnce(new Error('DB Error'));

      // Act
      const result = await service.getThreadSubscribers('thread-123');

      // Assert
      expect(result).toEqual([]);
      expect(mockLoggerError).toHaveBeenCalled();
    });
  });

  // ============================================
  // isUserSubscribed() 測試
  // ============================================

  describe('isUserSubscribed()', () => {
    it('should return true when user is subscribed', async () => {
      // Arrange
      mockDb._mockExecuteTakeFirst.mockResolvedValueOnce({
        thread_id: 'thread-123',
        user_id: 'user-456',
      });

      // Act
      const result = await service.isUserSubscribed('thread-123', 'user-456');

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when user is not subscribed', async () => {
      // Arrange
      mockDb._mockExecuteTakeFirst.mockResolvedValueOnce(undefined);

      // Act
      const result = await service.isUserSubscribed('thread-123', 'user-456');

      // Assert
      expect(result).toBe(false);
    });
  });

  // ============================================
  // notifySubscribers() 測試
  // ============================================

  describe('notifySubscribers()', () => {
    it('should notify subscribers excluding author', async () => {
      // Arrange
      const mockThread = createMockThread();
      // First call: release subscribers
      mockDb._mockExecute.mockResolvedValueOnce([
        { user_id: 'user-1' },
        { user_id: 'user-2' },
      ]);
      // Second call: author_all subscribers
      mockDb._mockExecute.mockResolvedValueOnce([
        { user_id: 'user-3' },
      ]);

      // Act
      const count = await service.notifySubscribers(
        mockThread as any,
        'author-123',
        'release',
        'https://discord.com/message/123'
      );

      // Assert
      expect(count).toBe(3);
      expect(mockThread.send).toHaveBeenCalled();
    });

    it('should exclude author from notifications', async () => {
      // Arrange
      const mockThread = createMockThread();
      mockDb._mockExecute.mockResolvedValueOnce([
        { user_id: 'author-123' }, // Should be excluded
        { user_id: 'user-1' },
      ]);
      mockDb._mockExecute.mockResolvedValueOnce([]);

      // Act
      const count = await service.notifySubscribers(
        mockThread as any,
        'author-123',
        'release',
        'https://discord.com/message/123'
      );

      // Assert
      expect(count).toBe(1); // Only user-1, not author
    });

    it('should return 0 when no subscribers', async () => {
      // Arrange
      const mockThread = createMockThread();
      mockDb._mockExecute.mockResolvedValueOnce([]);
      mockDb._mockExecute.mockResolvedValueOnce([]);

      // Act
      const count = await service.notifySubscribers(
        mockThread as any,
        'author-123',
        'release',
        'https://discord.com/message/123'
      );

      // Assert
      expect(count).toBe(0);
      expect(mockThread.send).not.toHaveBeenCalled();
    });

    it('should return 0 on error', async () => {
      // Arrange
      const mockThread = createMockThread();
      mockDb._mockExecute.mockRejectedValueOnce(new Error('DB Error'));

      // Act
      const count = await service.notifySubscribers(
        mockThread as any,
        'author-123',
        'release',
        'https://discord.com/message/123'
      );

      // Assert
      expect(count).toBe(0);
      expect(mockLoggerError).toHaveBeenCalled();
    });
  });

  // ============================================
  // getSubscriberCount() 測試
  // ============================================

  describe('getSubscriberCount()', () => {
    it('should return subscriber count', async () => {
      // Arrange
      mockDb._mockExecuteTakeFirst.mockResolvedValueOnce({ count: 42 });

      // Act
      const count = await service.getSubscriberCount('thread-123');

      // Assert
      expect(count).toBe(42);
    });

    it('should return 0 when no subscribers', async () => {
      // Arrange
      mockDb._mockExecuteTakeFirst.mockResolvedValueOnce({ count: 0 });

      // Act
      const count = await service.getSubscriberCount('thread-123');

      // Assert
      expect(count).toBe(0);
    });

    it('should return 0 on error', async () => {
      // Arrange
      mockDb._mockExecuteTakeFirst.mockRejectedValueOnce(new Error('DB Error'));

      // Act
      const count = await service.getSubscriberCount('thread-123');

      // Assert
      expect(count).toBe(0);
      expect(mockLoggerError).toHaveBeenCalled();
    });
  });

  // ============================================
  // createSubscriptionEntry() 測試
  // ============================================

  describe('createSubscriptionEntry()', () => {
    it('should create subscription entry', async () => {
      // Act
      const result = await service.createSubscriptionEntry('thread-123');

      // Assert
      expect(result).toBe(true);
      expect(mockDb.insertInto).toHaveBeenCalledWith('story_forum_subscription_entries');
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        expect.stringContaining('Created subscription entry')
      );
    });

    it('should return false on error', async () => {
      // Arrange
      mockDb.insertInto = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflict: vi.fn().mockReturnValue({
            doNothing: vi.fn().mockReturnValue({
              execute: vi.fn().mockRejectedValue(new Error('DB Error')),
            }),
          }),
        }),
      });

      // Act
      const result = await service.createSubscriptionEntry('thread-123');

      // Assert
      expect(result).toBe(false);
      expect(mockLoggerError).toHaveBeenCalled();
    });
  });

  // ============================================
  // hasSubscriptionEntry() 測試
  // ============================================

  describe('hasSubscriptionEntry()', () => {
    it('should return true when enabled entry exists', async () => {
      // Arrange
      mockDb._mockExecuteTakeFirst.mockResolvedValueOnce({
        thread_id: 'thread-123',
        enabled: true,
      });

      // Act
      const result = await service.hasSubscriptionEntry('thread-123');

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when entry is disabled', async () => {
      // Arrange
      mockDb._mockExecuteTakeFirst.mockResolvedValueOnce({
        thread_id: 'thread-123',
        enabled: false,
      });

      // Act
      const result = await service.hasSubscriptionEntry('thread-123');

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when no entry exists', async () => {
      // Arrange
      mockDb._mockExecuteTakeFirst.mockResolvedValueOnce(undefined);

      // Act
      const result = await service.hasSubscriptionEntry('thread-123');

      // Assert
      expect(result).toBe(false);
    });
  });

  // ============================================
  // addPermission() 測試
  // ============================================

  describe('addPermission()', () => {
    it('should add permission when under limit', async () => {
      // Arrange - getThreadInfo for hasPermission check
      mockDb._mockExecuteTakeFirst.mockResolvedValueOnce({
        thread_id: 'thread-123',
        author_id: 'author-456',
      });
      // getPermissionCount - count query
      mockDb._mockExecuteTakeFirst.mockResolvedValueOnce({ count: 2 });

      // Act
      const result = await service.addPermission('thread-123', 'user-789', 'author-456');

      // Assert
      expect(result).toBe(true);
      expect(mockDb.insertInto).toHaveBeenCalledWith('story_forum_permissions');
    });

    it('should return false when at 5 person limit', async () => {
      // Arrange
      mockDb._mockExecuteTakeFirst.mockResolvedValueOnce({
        thread_id: 'thread-123',
        author_id: 'author-456',
      });
      mockDb._mockExecuteTakeFirst.mockResolvedValueOnce({ count: 4 }); // 4 + author = 5

      // Act
      const result = await service.addPermission('thread-123', 'user-789', 'author-456');

      // Assert
      expect(result).toBe(false);
    });
  });

  // ============================================
  // removePermission() 測試
  // ============================================

  describe('removePermission()', () => {
    it('should remove permission', async () => {
      // Arrange
      mockDb._mockExecuteTakeFirst.mockResolvedValueOnce({ numDeletedRows: 1n });

      // Act
      const result = await service.removePermission('thread-123', 'user-456');

      // Assert
      expect(result).toBe(true);
      expect(mockDb.deleteFrom).toHaveBeenCalledWith('story_forum_permissions');
    });

    it('should return false when no rows deleted', async () => {
      // Arrange
      mockDb._mockExecuteTakeFirst.mockResolvedValueOnce({ numDeletedRows: 0n });

      // Act
      const result = await service.removePermission('thread-123', 'user-456');

      // Assert
      expect(result).toBe(false);
    });
  });

  // ============================================
  // hasPermission() 測試
  // ============================================

  describe('hasPermission()', () => {
    it('should return true for thread author', async () => {
      // Arrange
      mockDb._mockExecuteTakeFirst.mockResolvedValueOnce({
        thread_id: 'thread-123',
        author_id: 'user-456',
      });

      // Act
      const result = await service.hasPermission('thread-123', 'user-456');

      // Assert
      expect(result).toBe(true);
    });

    it('should return true for user with granted permission', async () => {
      // Arrange - thread info (different author)
      mockDb._mockExecuteTakeFirst.mockResolvedValueOnce({
        thread_id: 'thread-123',
        author_id: 'author-789',
      });
      // permission check
      mockDb._mockExecuteTakeFirst.mockResolvedValueOnce({
        thread_id: 'thread-123',
        user_id: 'user-456',
      });

      // Act
      const result = await service.hasPermission('thread-123', 'user-456');

      // Assert
      expect(result).toBe(true);
    });

    it('should return false for user without permission', async () => {
      // Arrange
      mockDb._mockExecuteTakeFirst.mockResolvedValueOnce({
        thread_id: 'thread-123',
        author_id: 'author-789',
      });
      mockDb._mockExecuteTakeFirst.mockResolvedValueOnce(undefined);

      // Act
      const result = await service.hasPermission('thread-123', 'user-456');

      // Assert
      expect(result).toBe(false);
    });
  });

  // ============================================
  // getAuthorPreference() 測試
  // ============================================

  describe('getAuthorPreference()', () => {
    it('should return preference when set', async () => {
      // Arrange
      mockDb._mockExecuteTakeFirst.mockResolvedValueOnce({ ask_on_post: false });

      // Act
      const result = await service.getAuthorPreference('user-123');

      // Assert
      expect(result).toBe(false);
    });

    it('should return true (default) when no preference set', async () => {
      // Arrange
      mockDb._mockExecuteTakeFirst.mockResolvedValueOnce(undefined);

      // Act
      const result = await service.getAuthorPreference('user-123');

      // Assert
      expect(result).toBe(true);
    });

    it('should return true on error', async () => {
      // Arrange
      mockDb._mockExecuteTakeFirst.mockRejectedValueOnce(new Error('DB Error'));

      // Act
      const result = await service.getAuthorPreference('user-123');

      // Assert
      expect(result).toBe(true);
      expect(mockLoggerError).toHaveBeenCalled();
    });
  });

  // ============================================
  // setAuthorPreference() 測試
  // ============================================

  describe('setAuthorPreference()', () => {
    it('should set author preference', async () => {
      // Act
      const result = await service.setAuthorPreference('user-123', false);

      // Assert
      expect(result).toBe(true);
      expect(mockDb.insertInto).toHaveBeenCalledWith('story_forum_author_preferences');
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        expect.stringContaining('Updated author preference')
      );
    });

    it('should return false on error', async () => {
      // Arrange
      mockDb.insertInto = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflict: vi.fn().mockReturnValue({
            column: vi.fn().mockReturnValue({
              doUpdateSet: vi.fn().mockReturnValue({
                execute: vi.fn().mockRejectedValue(new Error('DB Error')),
              }),
            }),
          }),
        }),
      });

      // Act
      const result = await service.setAuthorPreference('user-123', false);

      // Assert
      expect(result).toBe(false);
      expect(mockLoggerError).toHaveBeenCalled();
    });
  });

  // ============================================
  // askAboutSubscriptionEntry() 測試
  // ============================================

  describe('askAboutSubscriptionEntry()', () => {
    it('should send prompt message to thread', async () => {
      // Arrange
      const mockThread = createMockThread();

      // Act
      await service.askAboutSubscriptionEntry(mockThread as any, 'author-123');

      // Assert
      expect(mockThread.send).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('<@author-123>'),
          embeds: expect.any(Array),
          components: expect.any(Array),
        })
      );
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        expect.stringContaining('Asked author')
      );
    });

    it('should log error on failure', async () => {
      // Arrange
      const mockThread = createMockThread();
      mockThread.send.mockRejectedValueOnce(new Error('Send failed'));

      // Act
      await service.askAboutSubscriptionEntry(mockThread as any, 'author-123');

      // Assert
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining('Error asking about subscription entry'),
        expect.any(Error)
      );
    });
  });

  // ============================================
  // getPermissionCount() 測試
  // ============================================

  describe('getPermissionCount()', () => {
    it('should return count including author', async () => {
      // Arrange - getThreadInfo
      mockDb._mockExecuteTakeFirst.mockResolvedValueOnce({
        thread_id: 'thread-123',
        author_id: 'author-456',
      });
      // count query
      mockDb._mockExecuteTakeFirst.mockResolvedValueOnce({ count: 3 });

      // Act
      const count = await service.getPermissionCount('thread-123');

      // Assert
      expect(count).toBe(4); // 1 (author) + 3 (permissions)
    });

    it('should return 1 (just author) on error', async () => {
      // Arrange
      mockDb._mockExecuteTakeFirst.mockRejectedValueOnce(new Error('DB Error'));

      // Act
      const count = await service.getPermissionCount('thread-123');

      // Assert
      expect(count).toBe(1);
      expect(mockLoggerError).toHaveBeenCalled();
    });
  });
});
