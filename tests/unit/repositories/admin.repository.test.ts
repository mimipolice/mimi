/**
 * admin.repository 單元測試
 *
 * 測試範圍：
 * - Auto-Reacts: setAutoreact, removeAutoreact, getAutoreacts (injectable functions)
 * - Keywords: addKeyword, removeKeyword, getKeywordsByGuild (injectable functions)
 * - Todos: addTodo, removeTodo, getTodos, clearTodos (injectable functions)
 *
 * 注意：
 * - 直接使用 mimiDLCDb 的函數 (getAllAutoreacts, getAntiSpam*, etc.) 需要整合測試
 * - 這些函數在 import 時就綁定了真實 DB，難以透過 vi.mock 正確攔截
 *
 * Mock 策略：
 * - 對 injectable functions 使用 createMockKysely 建立可測試的 mock
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================
// Mock 設定
// ============================================

// Shared mock functions for execute methods
const mockExecute = vi.fn();
const mockExecuteTakeFirst = vi.fn();

// Helper function to create injectable mock db
function createMockKysely() {
  const createChainableMock = () => {
    const chain: any = {};
    chain.values = vi.fn().mockReturnValue(chain);
    chain.set = vi.fn().mockReturnValue(chain);
    chain.selectAll = vi.fn().mockReturnValue(chain);
    chain.select = vi.fn().mockReturnValue(chain);
    chain.distinct = vi.fn().mockReturnValue(chain);
    chain.where = vi.fn().mockReturnValue(chain);
    chain.whereRef = vi.fn().mockReturnValue(chain);
    chain.orderBy = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockReturnValue(chain);
    chain.groupBy = vi.fn().mockReturnValue(chain);
    chain.execute = mockExecute;
    chain.executeTakeFirst = mockExecuteTakeFirst;
    chain.onConflict = vi.fn().mockImplementation((callback?: (oc: any) => any) => {
      const oc = {
        doNothing: vi.fn().mockReturnValue(chain),
        column: vi.fn().mockReturnValue({
          doUpdateSet: vi.fn().mockReturnValue(chain),
        }),
        columns: vi.fn().mockReturnValue({
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
  };
}

// Mock database and logger to prevent import errors
vi.mock('../../../src/shared/database/index.js', () => ({
  mimiDLCDb: {},
  gachaDB: {},
}));

vi.mock('../../../src/utils/logger.js', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ============================================
// Import after mocks
// ============================================

import {
  setAutoreact,
  removeAutoreact,
  getAutoreacts,
  addKeyword,
  removeKeyword,
  getKeywordsByGuild,
  addTodo,
  removeTodo,
  getTodos,
  clearTodos,
} from '../../../src/repositories/admin.repository.js';

describe('admin.repository', () => {
  let mockDb: ReturnType<typeof createMockKysely>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockKysely();
    mockExecute.mockResolvedValue([]);
    mockExecuteTakeFirst.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================
  // Auto-Reacts 測試 (injectable functions)
  // ============================================

  describe('setAutoreact()', () => {
    it('should insert autoreact with correct table name', async () => {
      // Act
      await setAutoreact(mockDb as any, 'guild-123', 'channel-456', '👍');

      // Assert
      expect(mockDb.insertInto).toHaveBeenCalledWith('auto_reacts');
      expect(mockExecute).toHaveBeenCalled();
    });

    it('should complete without error for valid input', async () => {
      // Act & Assert - should not throw
      await expect(
        setAutoreact(mockDb as any, 'guild-123', 'channel-456', '🎉')
      ).resolves.toBeUndefined();
    });

    it('should handle emoji strings correctly', async () => {
      // Act & Assert - various emoji types should work
      await expect(setAutoreact(mockDb as any, 'g', 'c', '👍')).resolves.toBeUndefined();
      await expect(setAutoreact(mockDb as any, 'g', 'c', '🎉')).resolves.toBeUndefined();
      await expect(setAutoreact(mockDb as any, 'g', 'c', '<:custom:123>')).resolves.toBeUndefined();
    });
  });

  describe('removeAutoreact()', () => {
    it('should delete autoreact by guild and channel', async () => {
      // Act
      await removeAutoreact(mockDb as any, 'guild-123', 'channel-456');

      // Assert
      expect(mockDb.deleteFrom).toHaveBeenCalledWith('auto_reacts');
      expect(mockExecute).toHaveBeenCalled();
    });

    it('should complete even if no rows exist', async () => {
      // Arrange
      mockExecute.mockResolvedValueOnce([]);

      // Act & Assert
      await expect(
        removeAutoreact(mockDb as any, 'non-existent-guild', 'channel')
      ).resolves.toBeUndefined();
    });
  });

  describe('getAutoreacts()', () => {
    it('should return autoreacts for a guild', async () => {
      // Arrange
      mockExecute.mockResolvedValueOnce([
        { channel_id: 'channel-1', emoji: '👍' },
        { channel_id: 'channel-2', emoji: '🎉' },
      ]);

      // Act
      const result = await getAutoreacts(mockDb as any, 'guild-123');

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].emoji).toBe('👍');
      expect(result[1].channel_id).toBe('channel-2');
      expect(mockDb.selectFrom).toHaveBeenCalledWith('auto_reacts');
    });

    it('should return empty array when no autoreacts exist', async () => {
      // Arrange
      mockExecute.mockResolvedValueOnce([]);

      // Act
      const result = await getAutoreacts(mockDb as any, 'guild-123');

      // Assert
      expect(result).toEqual([]);
    });
  });

  // ============================================
  // Keywords 測試
  // ============================================

  describe('addKeyword()', () => {
    it('should insert keyword with exact match type', async () => {
      // Act
      await addKeyword(mockDb as any, 'guild-123', 'hello', 'Hello there!', 'exact');

      // Assert
      expect(mockDb.insertInto).toHaveBeenCalledWith('keywords');
      expect(mockExecute).toHaveBeenCalled();
    });

    it('should insert keyword with contains match type', async () => {
      // Act
      await addKeyword(mockDb as any, 'guild-123', 'help', 'Need help?', 'contains');

      // Assert
      expect(mockDb.insertInto).toHaveBeenCalledWith('keywords');
    });

    it('should handle special characters in keyword and reply', async () => {
      // Act & Assert - should not throw
      await expect(
        addKeyword(mockDb as any, 'guild', '!@#$%', 'Reply with <script>!', 'exact')
      ).resolves.toBeUndefined();
    });
  });

  describe('removeKeyword()', () => {
    it('should delete keyword by guild and keyword', async () => {
      // Act
      await removeKeyword(mockDb as any, 'guild-123', 'hello');

      // Assert
      expect(mockDb.deleteFrom).toHaveBeenCalledWith('keywords');
      expect(mockExecute).toHaveBeenCalled();
    });
  });

  describe('getKeywordsByGuild()', () => {
    it('should return keywords for specific guild', async () => {
      // Arrange
      mockExecute.mockResolvedValueOnce([
        { id: 1, guild_id: 'guild-123', keyword: 'hi', reply: 'Hello!', match_type: 'exact' },
        { id: 2, guild_id: 'guild-123', keyword: 'bye', reply: 'Goodbye!', match_type: 'contains' },
      ]);

      // Act
      const result = await getKeywordsByGuild(mockDb as any, 'guild-123');

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].keyword).toBe('hi');
      expect(result[1].match_type).toBe('contains');
    });

    it('should return all keywords when guildId is "*"', async () => {
      // Arrange
      mockExecute.mockResolvedValueOnce([
        { id: 1, guild_id: 'guild-1', keyword: 'hi', reply: 'Hello!', match_type: 'exact' },
        { id: 2, guild_id: 'guild-2', keyword: 'bye', reply: 'Goodbye!', match_type: 'exact' },
      ]);

      // Act
      const result = await getKeywordsByGuild(mockDb as any, '*');

      // Assert
      expect(result).toHaveLength(2);
      expect(mockDb.selectFrom).toHaveBeenCalledWith('keywords');
    });

    it('should return empty array when no keywords exist', async () => {
      // Arrange
      mockExecute.mockResolvedValueOnce([]);

      // Act
      const result = await getKeywordsByGuild(mockDb as any, 'guild-123');

      // Assert
      expect(result).toEqual([]);
    });
  });

  // ============================================
  // Todos 測試
  // ============================================

  describe('addTodo()', () => {
    it('should insert todo item', async () => {
      // Act
      await addTodo(mockDb as any, 'user-123', 'Buy groceries');

      // Assert
      expect(mockDb.insertInto).toHaveBeenCalledWith('todos');
      expect(mockExecute).toHaveBeenCalled();
    });

    it('should handle long todo items', async () => {
      // Arrange
      const longItem = 'a'.repeat(1000);

      // Act & Assert - should not throw
      await expect(addTodo(mockDb as any, 'user-123', longItem)).resolves.toBeUndefined();
    });
  });

  describe('removeTodo()', () => {
    it('should delete todo and return deleted count', async () => {
      // Arrange
      mockExecuteTakeFirst.mockResolvedValueOnce({ numDeletedRows: 1n });

      // Act
      const result = await removeTodo(mockDb as any, 42, 'user-123');

      // Assert
      expect(result).toBe(1n);
      expect(mockDb.deleteFrom).toHaveBeenCalledWith('todos');
    });

    it('should return 0 when todo not found', async () => {
      // Arrange
      mockExecuteTakeFirst.mockResolvedValueOnce({ numDeletedRows: 0n });

      // Act
      const result = await removeTodo(mockDb as any, 999, 'user-123');

      // Assert
      expect(result).toBe(0n);
    });

    it('should return 0 when todo not owned by user', async () => {
      // Arrange - todo exists but belongs to different user
      mockExecuteTakeFirst.mockResolvedValueOnce({ numDeletedRows: 0n });

      // Act
      const result = await removeTodo(mockDb as any, 42, 'wrong-user');

      // Assert
      expect(result).toBe(0n);
    });
  });

  describe('getTodos()', () => {
    it('should return todos for user', async () => {
      // Arrange
      const createdAt = new Date('2024-01-01');
      mockExecute.mockResolvedValueOnce([
        { id: 1, item: 'First task', created_at: createdAt },
        { id: 2, item: 'Second task', created_at: new Date('2024-01-02') },
      ]);

      // Act
      const result = await getTodos(mockDb as any, 'user-123');

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].item).toBe('First task');
      expect(result[0].created_at).toEqual(createdAt);
    });

    it('should return empty array when user has no todos', async () => {
      // Arrange
      mockExecute.mockResolvedValueOnce([]);

      // Act
      const result = await getTodos(mockDb as any, 'user-123');

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('clearTodos()', () => {
    it('should delete all todos for user', async () => {
      // Act
      await clearTodos(mockDb as any, 'user-123');

      // Assert
      expect(mockDb.deleteFrom).toHaveBeenCalledWith('todos');
      expect(mockExecute).toHaveBeenCalled();
    });

    it('should complete even if user has no todos', async () => {
      // Arrange
      mockExecute.mockResolvedValueOnce([]);

      // Act & Assert
      await expect(clearTodos(mockDb as any, 'user-123')).resolves.toBeUndefined();
    });
  });
});
