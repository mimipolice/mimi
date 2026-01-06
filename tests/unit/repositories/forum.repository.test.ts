/**
 * forum.repository 單元測試
 *
 * 測試範圍：
 * - setSolution: 設定或更新 thread 的解答
 * - getSolution: 取得 thread 的解答
 * - getSolutionsByTag: 依 tag 搜尋解答
 * - removeSolution: 移除 thread 的解答
 * - getAllTags: 取得所有 unique tags
 *
 * Mock 策略：
 * - 使用 injectable Kysely mock (這個 repository 使用 DI 模式！)
 * - 每個函數接受 db 參數，可以直接傳入 mock
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================
// Mock 設定
// ============================================

const mockExecute = vi.fn();
const mockExecuteTakeFirst = vi.fn();

function createMockKysely() {
  const createChainableMock = () => {
    const chain: any = {};
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
  };
}

// Mock Kysely sql tag
vi.mock('kysely', async (importOriginal) => {
  const original = await importOriginal<typeof import('kysely')>();
  return {
    ...original,
    sql: Object.assign(
      (strings: TemplateStringsArray, ...values: any[]) => ({
        execute: mockExecute,
      }),
      {
        raw: vi.fn((str: string) => str),
      }
    ),
  };
});

// ============================================
// Import after mocks
// ============================================

import {
  setSolution,
  getSolution,
  getSolutionsByTag,
  removeSolution,
  getAllTags,
  ForumPostSolution,
} from '../../../src/repositories/forum.repository.js';

describe('forum.repository', () => {
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
  // setSolution() 測試
  // ============================================

  describe('setSolution()', () => {
    it('should insert solution with correct table name', async () => {
      // Act
      await setSolution(mockDb as any, 'thread-123', 'message-456', 'author-789', ['tag1', 'tag2']);

      // Assert
      expect(mockDb.insertInto).toHaveBeenCalledWith('forum_post_solutions');
      expect(mockExecute).toHaveBeenCalled();
    });

    it('should handle upsert on conflict', async () => {
      // Act
      await setSolution(mockDb as any, 'thread-123', 'message-456', 'author-789', null);

      // Assert
      expect(mockDb.insertInto).toHaveBeenCalled();
      expect(mockExecute).toHaveBeenCalled();
    });

    it('should handle null tags', async () => {
      // Act & Assert - should not throw
      await expect(
        setSolution(mockDb as any, 'thread-123', 'message-456', 'author-789', null)
      ).resolves.toBeUndefined();
    });

    it('should handle empty tags array', async () => {
      // Act & Assert
      await expect(
        setSolution(mockDb as any, 'thread-123', 'message-456', 'author-789', [])
      ).resolves.toBeUndefined();
    });

    it('should handle multiple tags', async () => {
      // Act & Assert
      await expect(
        setSolution(mockDb as any, 'thread-123', 'message-456', 'author-789', ['bug', 'fixed', 'v2'])
      ).resolves.toBeUndefined();
    });
  });

  // ============================================
  // getSolution() 測試
  // ============================================

  describe('getSolution()', () => {
    it('should return solution when found', async () => {
      // Arrange
      const expectedSolution: ForumPostSolution = {
        thread_id: 'thread-123',
        message_id: 'message-456',
        author_id: 'author-789',
        tags: ['bug', 'resolved'],
      };
      mockExecuteTakeFirst.mockResolvedValueOnce(expectedSolution);

      // Act
      const result = await getSolution(mockDb as any, 'thread-123');

      // Assert
      expect(mockDb.selectFrom).toHaveBeenCalledWith('forum_post_solutions');
      expect(result).toEqual(expectedSolution);
    });

    it('should return null when solution not found', async () => {
      // Arrange
      mockExecuteTakeFirst.mockResolvedValueOnce(undefined);

      // Act
      const result = await getSolution(mockDb as any, 'non-existent');

      // Assert
      expect(result).toBeNull();
    });

    it('should return solution with null tags', async () => {
      // Arrange
      const expectedSolution: ForumPostSolution = {
        thread_id: 'thread-123',
        message_id: 'message-456',
        author_id: 'author-789',
        tags: null,
      };
      mockExecuteTakeFirst.mockResolvedValueOnce(expectedSolution);

      // Act
      const result = await getSolution(mockDb as any, 'thread-123');

      // Assert
      expect(result).not.toBeNull();
      expect(result?.tags).toBeNull();
    });
  });

  // ============================================
  // getSolutionsByTag() 測試
  // ============================================

  describe('getSolutionsByTag()', () => {
    it('should return solutions matching tag', async () => {
      // Arrange
      const solutions: ForumPostSolution[] = [
        { thread_id: 'thread-1', message_id: 'msg-1', author_id: 'author-1', tags: ['bug'] },
        { thread_id: 'thread-2', message_id: 'msg-2', author_id: 'author-2', tags: ['bug', 'critical'] },
      ];
      mockExecute.mockResolvedValueOnce(solutions);

      // Act
      const result = await getSolutionsByTag(mockDb as any, 'bug');

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].thread_id).toBe('thread-1');
      expect(result[1].thread_id).toBe('thread-2');
    });

    it('should return empty array when no solutions match tag', async () => {
      // Arrange
      mockExecute.mockResolvedValueOnce([]);

      // Act
      const result = await getSolutionsByTag(mockDb as any, 'non-existent-tag');

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle special characters in tag', async () => {
      // Arrange
      mockExecute.mockResolvedValueOnce([]);

      // Act & Assert - should not throw
      await expect(
        getSolutionsByTag(mockDb as any, "tag-with-special'chars")
      ).resolves.toEqual([]);
    });
  });

  // ============================================
  // removeSolution() 測試
  // ============================================

  describe('removeSolution()', () => {
    it('should delete solution by thread_id', async () => {
      // Act
      await removeSolution(mockDb as any, 'thread-123');

      // Assert
      expect(mockDb.deleteFrom).toHaveBeenCalledWith('forum_post_solutions');
      expect(mockExecute).toHaveBeenCalled();
    });

    it('should complete even if no solution exists', async () => {
      // Arrange
      mockExecute.mockResolvedValueOnce([]);

      // Act & Assert
      await expect(removeSolution(mockDb as any, 'non-existent')).resolves.toBeUndefined();
    });
  });

  // ============================================
  // getAllTags() 測試
  // ============================================

  describe('getAllTags()', () => {
    it('should return all unique tags', async () => {
      // Arrange
      mockExecute.mockResolvedValueOnce({
        rows: [{ tag: 'bug' }, { tag: 'feature' }, { tag: 'help' }],
      });

      // Act
      const result = await getAllTags(mockDb as any);

      // Assert
      expect(result).toEqual(['bug', 'feature', 'help']);
    });

    it('should return empty array when no tags exist', async () => {
      // Arrange
      mockExecute.mockResolvedValueOnce({ rows: [] });

      // Act
      const result = await getAllTags(mockDb as any);

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle single tag', async () => {
      // Arrange
      mockExecute.mockResolvedValueOnce({ rows: [{ tag: 'only-tag' }] });

      // Act
      const result = await getAllTags(mockDb as any);

      // Assert
      expect(result).toEqual(['only-tag']);
    });
  });

  // ============================================
  // ForumPostSolution interface 測試
  // ============================================

  describe('ForumPostSolution interface', () => {
    it('should have correct shape', () => {
      const solution: ForumPostSolution = {
        thread_id: 'thread-123456789012345678',
        message_id: 'message-123456789012345678',
        author_id: 'author-123456789012345678',
        tags: ['bug', 'fixed'],
      };

      expect(solution.thread_id).toBe('thread-123456789012345678');
      expect(solution.message_id).toBe('message-123456789012345678');
      expect(solution.author_id).toBe('author-123456789012345678');
      expect(solution.tags).toEqual(['bug', 'fixed']);
    });

    it('should allow null tags', () => {
      const solution: ForumPostSolution = {
        thread_id: 'thread-123',
        message_id: 'message-456',
        author_id: 'author-789',
        tags: null,
      };

      expect(solution.tags).toBeNull();
    });

    it('should allow empty tags array', () => {
      const solution: ForumPostSolution = {
        thread_id: 'thread-123',
        message_id: 'message-456',
        author_id: 'author-789',
        tags: [],
      };

      expect(solution.tags).toEqual([]);
    });
  });
});
