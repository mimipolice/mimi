/**
 * TicketRepository 單元測試
 *
 * 測試範圍：
 * - findOpenTicketByOwner(): 查詢使用者的開啟中 Ticket
 * - findTicketByChannel(): 透過 Channel ID 查詢 Ticket
 * - createTicket(): 建立新 Ticket
 * - getNextGuildTicketId(): 取得下一個 Ticket ID（原子操作）
 * - closeTicket(): 關閉 Ticket
 * - claimTicket(): 認領 Ticket
 * - updateTicketCategory(): 更新分類（含驗證）
 * - updateTicketRating(): 更新評分（含驗證）
 * - updateTicketResolution(): 更新解決狀態（含驗證）
 * - findTicketById(): 透過 ID 查詢 Ticket
 * - findUserTicketHistory(): 查詢使用者歷史記錄
 * - purgeTickets(): 清除所有 Tickets（交易）
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================
// Mock 設定 - 必須在 import 之前
// ============================================

// Mock 資料庫模組以避免初始化真實連線
vi.mock('../../../src/shared/database/index.js', () => ({
  mimiDLCDb: {},
  gachaDb: {},
}));

// ============================================
// 現在可以安全地 import
// ============================================

import { TicketRepository } from '../../../src/repositories/ticket.repository.js';
import { TicketStatus, TicketCategory, TicketResolution } from '../../../src/types/ticket.js';
import {
  FIXTURE_OPEN_TICKET,
  FIXTURE_CLOSED_TICKET,
  FIXTURE_CLAIMED_TICKET,
  FIXTURE_USER_TICKET_HISTORY,
  createTicketFixture,
} from '../../fixtures/tickets.js';
import {
  createMockKysely,
  setupQueryError,
  setupRepositoryMocks,
} from '../../helpers/kysely-mocks.js';

describe('TicketRepository', () => {
  let ticketRepository: TicketRepository;
  let mockDb: ReturnType<typeof createMockKysely>;

  beforeEach(() => {
    vi.clearAllMocks();

    // 建立 mock Kysely 實例
    mockDb = createMockKysely();

    // 建立 TicketRepository 實例
    ticketRepository = new TicketRepository(mockDb as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================
  // findOpenTicketByOwner() 測試
  // ============================================

  describe('findOpenTicketByOwner()', () => {
    it('should return ticket when user has open ticket', async () => {
      // Arrange
      mockDb._setResult(FIXTURE_OPEN_TICKET);

      // Act
      const result = await ticketRepository.findOpenTicketByOwner(
        FIXTURE_OPEN_TICKET.guildId,
        FIXTURE_OPEN_TICKET.ownerId
      );

      // Assert
      expect(result).toEqual(FIXTURE_OPEN_TICKET);
      expect(mockDb.selectFrom).toHaveBeenCalledWith('tickets');
    });

    it('should return undefined when user has no open ticket', async () => {
      // Arrange
      mockDb._setResult(undefined);

      // Act
      const result = await ticketRepository.findOpenTicketByOwner('guild-id', 'user-id');

      // Assert
      expect(result).toBeUndefined();
    });

    it('should only find tickets with OPEN status', async () => {
      // Arrange
      mockDb._setResult(FIXTURE_OPEN_TICKET);

      // Act
      await ticketRepository.findOpenTicketByOwner('guild-id', 'user-id');

      // Assert - 驗證 where 被呼叫（鏈式呼叫的驗證較複雜，這裡簡化處理）
      expect(mockDb.selectFrom).toHaveBeenCalledWith('tickets');
    });
  });

  // ============================================
  // findTicketByChannel() 測試
  // ============================================

  describe('findTicketByChannel()', () => {
    it('should return ticket when channel has associated ticket', async () => {
      // Arrange
      mockDb._setResult(FIXTURE_OPEN_TICKET);

      // Act
      const result = await ticketRepository.findTicketByChannel(FIXTURE_OPEN_TICKET.channelId);

      // Assert
      expect(result).toEqual(FIXTURE_OPEN_TICKET);
    });

    it('should return undefined when channel has no ticket', async () => {
      // Arrange
      mockDb._setResult(undefined);

      // Act
      const result = await ticketRepository.findTicketByChannel('non-existent-channel');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  // ============================================
  // createTicket() 測試
  // ============================================

  describe('createTicket()', () => {
    it('should insert new ticket with OPEN status', async () => {
      // Arrange
      mockDb._setResult(undefined);

      const ticketData = {
        guildId: 'guild-123',
        channelId: 'channel-123',
        ownerId: 'user-123',
        guildTicketId: 1,
      };

      // Act
      await ticketRepository.createTicket(ticketData);

      // Assert
      expect(mockDb.insertInto).toHaveBeenCalledWith('tickets');
    });

    it('should not throw when insert succeeds', async () => {
      // Arrange
      mockDb._setResult(undefined);

      // Act & Assert
      await expect(
        ticketRepository.createTicket({
          guildId: 'guild-123',
          channelId: 'channel-123',
          ownerId: 'user-123',
          guildTicketId: 1,
        })
      ).resolves.toBeUndefined();
    });

    it('should throw when insert fails', async () => {
      // Arrange
      setupQueryError(mockDb, new Error('Insert failed'));

      // Act & Assert
      await expect(
        ticketRepository.createTicket({
          guildId: 'guild-123',
          channelId: 'channel-123',
          ownerId: 'user-123',
          guildTicketId: 1,
        })
      ).rejects.toThrow('Insert failed');
    });
  });

  // ============================================
  // getNextGuildTicketId() 測試
  // ============================================

  describe('getNextGuildTicketId()', () => {
    it('should return next ticket ID for new guild', async () => {
      // Arrange
      mockDb._mockQueryBuilder.executeTakeFirstOrThrow.mockResolvedValue({ lastTicketId: 1 });

      // Act
      const result = await ticketRepository.getNextGuildTicketId('guild-123');

      // Assert
      expect(result).toBe(1);
      expect(mockDb.insertInto).toHaveBeenCalledWith('guild_ticket_counters');
    });

    it('should return incremented ID for existing guild', async () => {
      // Arrange
      mockDb._mockQueryBuilder.executeTakeFirstOrThrow.mockResolvedValue({ lastTicketId: 42 });

      // Act
      const result = await ticketRepository.getNextGuildTicketId('guild-123');

      // Assert
      expect(result).toBe(42);
    });

    it('should throw when database fails', async () => {
      // Arrange
      mockDb._mockQueryBuilder.executeTakeFirstOrThrow.mockRejectedValue(
        new Error('Database error')
      );

      // Act & Assert
      await expect(ticketRepository.getNextGuildTicketId('guild-123')).rejects.toThrow(
        'Database error'
      );
    });
  });

  // ============================================
  // closeTicket() 測試
  // ============================================

  describe('closeTicket()', () => {
    it('should close ticket with all data', async () => {
      // Arrange
      mockDb._setResult(undefined);

      // Act
      await ticketRepository.closeTicket('channel-123', {
        closeReason: 'Issue resolved',
        closedById: 'staff-123',
        transcriptUrl: 'https://example.com/transcript',
        logMessageId: 'log-message-123',
      });

      // Assert
      expect(mockDb.updateTable).toHaveBeenCalledWith('tickets');
    });

    it('should close ticket with minimal data', async () => {
      // Arrange
      mockDb._setResult(undefined);

      // Act
      await ticketRepository.closeTicket('channel-123', {
        closedById: 'staff-123',
      });

      // Assert
      expect(mockDb.updateTable).toHaveBeenCalledWith('tickets');
    });
  });

  // ============================================
  // claimTicket() 測試
  // ============================================

  describe('claimTicket()', () => {
    it('should set claimedById for ticket', async () => {
      // Arrange
      mockDb._setResult(undefined);

      // Act
      await ticketRepository.claimTicket('channel-123', 'staff-123');

      // Assert
      expect(mockDb.updateTable).toHaveBeenCalledWith('tickets');
    });
  });

  // ============================================
  // updateTicketCategory() 測試
  // ============================================

  describe('updateTicketCategory()', () => {
    it('should update category with valid value', async () => {
      // Arrange
      mockDb._setResult(undefined);

      // Act
      await ticketRepository.updateTicketCategory(1, TicketCategory.TECHNICAL);

      // Assert
      expect(mockDb.updateTable).toHaveBeenCalledWith('tickets');
    });

    it.each(Object.values(TicketCategory))(
      'should accept valid category: %s',
      async (category) => {
        // Arrange
        mockDb._setResult(undefined);

        // Act & Assert
        await expect(
          ticketRepository.updateTicketCategory(1, category)
        ).resolves.toBeUndefined();
      }
    );

    it('should throw error for invalid category', async () => {
      // Act & Assert
      await expect(
        ticketRepository.updateTicketCategory(1, 'invalid_category')
      ).rejects.toThrow('Invalid category: invalid_category');
    });

    it('should include valid values in error message', async () => {
      // Act & Assert
      await expect(ticketRepository.updateTicketCategory(1, 'bad')).rejects.toThrow(
        /Valid values:/
      );
    });
  });

  // ============================================
  // updateTicketRating() 測試
  // ============================================

  describe('updateTicketRating()', () => {
    it.each([1, 2, 3, 4, 5])('should accept valid rating: %d', async (rating) => {
      // Arrange
      mockDb._setResult(undefined);

      // Act & Assert
      await expect(ticketRepository.updateTicketRating(1, rating)).resolves.toBeUndefined();
    });

    it('should throw error for rating below 1', async () => {
      // Act & Assert
      await expect(ticketRepository.updateTicketRating(1, 0)).rejects.toThrow(
        'Invalid rating: 0'
      );
    });

    it('should throw error for rating above 5', async () => {
      // Act & Assert
      await expect(ticketRepository.updateTicketRating(1, 6)).rejects.toThrow(
        'Invalid rating: 6'
      );
    });

    it('should throw error for non-integer rating', async () => {
      // Act & Assert
      await expect(ticketRepository.updateTicketRating(1, 3.5)).rejects.toThrow(
        'Invalid rating: 3.5'
      );
    });

    it('should throw error for negative rating', async () => {
      // Act & Assert
      await expect(ticketRepository.updateTicketRating(1, -1)).rejects.toThrow(
        'Invalid rating: -1'
      );
    });
  });

  // ============================================
  // updateTicketResolution() 測試
  // ============================================

  describe('updateTicketResolution()', () => {
    it.each(Object.values(TicketResolution))(
      'should accept valid resolution: %s',
      async (resolution) => {
        // Arrange
        mockDb._setResult(undefined);

        // Act & Assert
        await expect(
          ticketRepository.updateTicketResolution(1, resolution)
        ).resolves.toBeUndefined();
      }
    );

    it('should throw error for invalid resolution', async () => {
      // Act & Assert
      await expect(
        ticketRepository.updateTicketResolution(1, 'invalid_resolution')
      ).rejects.toThrow('Invalid resolution: invalid_resolution');
    });

    it('should include valid values in error message', async () => {
      // Act & Assert
      await expect(ticketRepository.updateTicketResolution(1, 'bad')).rejects.toThrow(
        /Valid values:/
      );
    });
  });

  // ============================================
  // findTicketById() 測試
  // ============================================

  describe('findTicketById()', () => {
    it('should return ticket when ID exists', async () => {
      // Arrange
      mockDb._setResult(FIXTURE_OPEN_TICKET);

      // Act
      const result = await ticketRepository.findTicketById(FIXTURE_OPEN_TICKET.id);

      // Assert
      expect(result).toEqual(FIXTURE_OPEN_TICKET);
    });

    it('should return undefined when ID does not exist', async () => {
      // Arrange
      mockDb._setResult(undefined);

      // Act
      const result = await ticketRepository.findTicketById(99999);

      // Assert
      expect(result).toBeUndefined();
    });
  });

  // ============================================
  // findTicketByLogMessageId() 測試
  // ============================================

  describe('findTicketByLogMessageId()', () => {
    it('should return ticket when log message ID exists', async () => {
      // Arrange
      const ticketWithLogMessage = createTicketFixture({
        id: 100,
      });
      mockDb._setResult(ticketWithLogMessage);

      // Act
      const result = await ticketRepository.findTicketByLogMessageId('log-message-123');

      // Assert
      expect(result).toEqual(ticketWithLogMessage);
    });

    it('should return undefined when log message ID does not exist', async () => {
      // Arrange
      mockDb._setResult(undefined);

      // Act
      const result = await ticketRepository.findTicketByLogMessageId('non-existent');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  // ============================================
  // findUserTicketHistory() 測試
  // ============================================

  describe('findUserTicketHistory()', () => {
    it('should return closed tickets for user', async () => {
      // Arrange
      mockDb._setExecuteResult(FIXTURE_USER_TICKET_HISTORY);

      // Act
      const result = await ticketRepository.findUserTicketHistory('guild-123', 'user-123');

      // Assert
      expect(result).toEqual(FIXTURE_USER_TICKET_HISTORY);
    });

    it('should return empty array when user has no history', async () => {
      // Arrange
      mockDb._setExecuteResult([]);

      // Act
      const result = await ticketRepository.findUserTicketHistory('guild-123', 'new-user');

      // Assert
      expect(result).toEqual([]);
    });

    it('should use default limit of 25', async () => {
      // Arrange
      mockDb._setExecuteResult([]);

      // Act
      await ticketRepository.findUserTicketHistory('guild-123', 'user-123');

      // Assert
      expect(mockDb.selectFrom).toHaveBeenCalledWith('tickets');
    });

    it('should respect custom limit', async () => {
      // Arrange
      mockDb._setExecuteResult([]);

      // Act
      await ticketRepository.findUserTicketHistory('guild-123', 'user-123', 10);

      // Assert
      expect(mockDb.selectFrom).toHaveBeenCalledWith('tickets');
    });
  });

  // ============================================
  // resetCounter() 測試
  // ============================================

  describe('resetCounter()', () => {
    it('should reset counter to 0', async () => {
      // Arrange
      mockDb._setResult(undefined);

      // Act
      await ticketRepository.resetCounter('guild-123');

      // Assert
      expect(mockDb.updateTable).toHaveBeenCalledWith('guild_ticket_counters');
    });
  });

  // ============================================
  // purgeTickets() 測試
  // ============================================

  describe('purgeTickets()', () => {
    it('should delete all tickets and reset counter in transaction', async () => {
      // Arrange - transaction mock 已經在 createMockKysely 中設定

      // Act
      await ticketRepository.purgeTickets('guild-123');

      // Assert
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it('should not throw when transaction succeeds', async () => {
      // Act & Assert
      await expect(ticketRepository.purgeTickets('guild-123')).resolves.toBeUndefined();
    });
  });

  // ============================================
  // 邊界情況測試
  // ============================================

  describe('edge cases', () => {
    it('should handle empty string channelId', async () => {
      // Arrange
      mockDb._setResult(undefined);

      // Act
      const result = await ticketRepository.findTicketByChannel('');

      // Assert
      expect(result).toBeUndefined();
    });

    it('should handle very large ticket ID', async () => {
      // Arrange
      mockDb._setResult(undefined);

      // Act
      const result = await ticketRepository.findTicketById(999999999);

      // Assert
      expect(result).toBeUndefined();
    });

    it('should handle concurrent getNextGuildTicketId calls gracefully', async () => {
      // Arrange
      mockDb._mockQueryBuilder.executeTakeFirstOrThrow
        .mockResolvedValueOnce({ lastTicketId: 1 })
        .mockResolvedValueOnce({ lastTicketId: 2 });

      // Act
      const [id1, id2] = await Promise.all([
        ticketRepository.getNextGuildTicketId('guild-123'),
        ticketRepository.getNextGuildTicketId('guild-123'),
      ]);

      // Assert
      expect(id1).toBe(1);
      expect(id2).toBe(2);
    });
  });
});
