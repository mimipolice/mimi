/**
 * TicketManager 單元測試
 *
 * 測試範圍：
 * - create(): 建立新 Ticket（包含驗證、頻道建立、資料庫寫入）
 * - close(): 關閉 Ticket（包含 transcript、日誌、歸檔）
 * - claim(): 認領 Ticket（包含權限檢查）
 * - findTicketByChannel(): 查詢 Ticket
 * - purge(): 清除所有 Tickets
 * - addUser()/removeUser(): 新增/移除使用者
 *
 * Mock 策略：
 * - SettingsManager: mock getSettings, clearCache
 * - DiscordService: mock 所有 Discord 操作
 * - TicketRepository: mock 透過 vi.mock
 * - Interactions: 使用 discord-mocks helper
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================
// Mock 設定 - 使用 vi.hoisted 確保持久化
// ============================================

const {
  mockGetSettings,
  mockClearCache,
  mockCreateTicketChannel,
  mockSendInitialMessages,
  mockFetchUser,
  mockSendLogMessage,
  mockArchiveTicketChannel,
  mockDeleteTicketChannel,
  mockSendDMOnClose,
  mockAddUserToChannel,
  mockRemoveUserFromChannel,
  mockFindOpenTicketByOwner,
  mockFindTicketByChannel,
  mockCreateTicket,
  mockGetNextGuildTicketId,
  mockCloseTicket,
  mockClaimTicket,
  mockPurgeTickets,
  mockLoggerError,
  mockLoggerInfo,
  mockLoggerWarn,
  mockGenerateTranscript,
  mockGetTicketTypeByTypeId,
} = vi.hoisted(() => ({
  mockGetSettings: vi.fn(),
  mockClearCache: vi.fn(),
  mockCreateTicketChannel: vi.fn(),
  mockSendInitialMessages: vi.fn(),
  mockFetchUser: vi.fn(),
  mockSendLogMessage: vi.fn(),
  mockArchiveTicketChannel: vi.fn(),
  mockDeleteTicketChannel: vi.fn(),
  mockSendDMOnClose: vi.fn(),
  mockAddUserToChannel: vi.fn(),
  mockRemoveUserFromChannel: vi.fn(),
  mockFindOpenTicketByOwner: vi.fn(),
  mockFindTicketByChannel: vi.fn(),
  mockCreateTicket: vi.fn(),
  mockGetNextGuildTicketId: vi.fn(),
  mockCloseTicket: vi.fn(),
  mockClaimTicket: vi.fn(),
  mockPurgeTickets: vi.fn(),
  mockLoggerError: vi.fn(),
  mockLoggerInfo: vi.fn(),
  mockLoggerWarn: vi.fn(),
  mockGenerateTranscript: vi.fn(),
  mockGetTicketTypeByTypeId: vi.fn(),
}));

// Mock SettingsManager
vi.mock('../../../src/services/SettingsManager.js', () => ({
  SettingsManager: class MockSettingsManager {
    getSettings = mockGetSettings;
    clearCache = mockClearCache;
  },
}));

// Mock DiscordService
vi.mock('../../../src/services/DiscordService.js', () => ({
  DiscordService: class MockDiscordService {
    createTicketChannel = mockCreateTicketChannel;
    sendInitialMessages = mockSendInitialMessages;
    fetchUser = mockFetchUser;
    sendLogMessage = mockSendLogMessage;
    archiveTicketChannel = mockArchiveTicketChannel;
    deleteTicketChannel = mockDeleteTicketChannel;
    sendDMOnClose = mockSendDMOnClose;
    addUserToChannel = mockAddUserToChannel;
    removeUserFromChannel = mockRemoveUserFromChannel;
  },
}));

// Mock TicketRepository
vi.mock('../../../src/repositories/ticket.repository.js', () => ({
  TicketRepository: class MockTicketRepository {
    findOpenTicketByOwner = mockFindOpenTicketByOwner;
    findTicketByChannel = mockFindTicketByChannel;
    createTicket = mockCreateTicket;
    getNextGuildTicketId = mockGetNextGuildTicketId;
    closeTicket = mockCloseTicket;
    claimTicket = mockClaimTicket;
    purgeTickets = mockPurgeTickets;
  },
  getTicketTypeByTypeId: mockGetTicketTypeByTypeId,
}));

// Mock transcript utility
vi.mock('../../../src/utils/transcript/transcript.js', () => ({
  generateTranscript: mockGenerateTranscript,
}));

// Mock sanitize utility
vi.mock('../../../src/utils/sanitize.js', () => ({
  sanitize: vi.fn((str: string) => str),
}));

// Mock logger
vi.mock('../../../src/utils/logger.js', () => ({
  default: {
    debug: vi.fn(),
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    error: mockLoggerError,
  },
}));

// Mock database
vi.mock('../../../src/shared/database/index.js', () => ({
  mimiDLCDb: {},
}));

// ============================================
// 現在可以安全地 import
// ============================================

import { TicketManager } from '../../../src/services/TicketManager.js';
import { SettingsManager } from '../../../src/services/SettingsManager.js';
import { DiscordService } from '../../../src/services/DiscordService.js';
import { TicketStatus } from '../../../src/types/ticket.js';
import {
  createMockButtonInteraction,
  createMockModalSubmitInteraction,
  createMockGuild,
  createMockUser,
  createMockTextChannel,
  createMockGuildMember,
} from '../../helpers/discord-mocks.js';
import {
  FIXTURE_OPEN_TICKET,
  FIXTURE_CLOSED_TICKET,
  FIXTURE_CLAIMED_TICKET,
  createTicketFixture,
} from '../../fixtures/tickets.js';
import { FIXTURE_COMPLETE_SETTINGS, createSettingsFixture } from '../../fixtures/guild-settings.js';
import { createMockKysely } from '../../helpers/kysely-mocks.js';

describe('TicketManager', () => {
  let ticketManager: TicketManager;
  let mockDb: ReturnType<typeof createMockKysely>;
  let mockSettingsManager: SettingsManager;
  let mockDiscordService: DiscordService;

  beforeEach(() => {
    vi.clearAllMocks();

    // 建立 mock 實例
    mockDb = createMockKysely();
    mockSettingsManager = new SettingsManager(mockDb as any);
    mockDiscordService = new DiscordService({} as any);

    // 建立 TicketManager 實例
    ticketManager = new TicketManager(
      mockDb as any,
      mockSettingsManager,
      mockDiscordService
    );

    // 設定預設 mock 回傳值
    mockGetSettings.mockResolvedValue(FIXTURE_COMPLETE_SETTINGS);
    mockFindOpenTicketByOwner.mockResolvedValue(undefined);
    mockGetNextGuildTicketId.mockResolvedValue(1);
    mockCreateTicketChannel.mockResolvedValue(createMockTextChannel({ id: 'new-ticket-channel' }));
    mockCreateTicket.mockResolvedValue(undefined);
    mockSendInitialMessages.mockResolvedValue(undefined);
    mockFetchUser.mockResolvedValue(createMockUser({ id: 'owner-123' }));
    mockGenerateTranscript.mockResolvedValue('https://example.com/transcript.html');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================
  // create() 測試
  // ============================================

  describe('create()', () => {
    it('should create ticket successfully', async () => {
      // Arrange
      const interaction = createMockButtonInteraction({
        guildId: 'guild-123',
        userId: 'user-123',
      });

      // Act
      await ticketManager.create(interaction);

      // Assert
      expect(mockGetSettings).toHaveBeenCalledWith('guild-123');
      expect(mockFindOpenTicketByOwner).toHaveBeenCalledWith('guild-123', 'user-123');
      expect(mockGetNextGuildTicketId).toHaveBeenCalledWith('guild-123');
      expect(mockCreateTicketChannel).toHaveBeenCalled();
      expect(mockCreateTicket).toHaveBeenCalled();
      expect(mockSendInitialMessages).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.stringContaining('Your ticket has been created')
      );
    });

    it('should reject when not in guild', async () => {
      // Arrange
      const interaction = createMockButtonInteraction();
      (interaction.inGuild as any).mockReturnValue(false);
      (interaction as any).guild = null;

      // Act
      await ticketManager.create(interaction);

      // Assert
      expect(interaction.editReply).toHaveBeenCalledWith(
        'This command can only be used in a server.'
      );
    });

    it('should reject when settings not configured', async () => {
      // Arrange
      mockGetSettings.mockResolvedValue(null);
      const interaction = createMockButtonInteraction();

      // Act
      await ticketManager.create(interaction);

      // Assert
      expect(interaction.editReply).toHaveBeenCalledWith(
        'The ticket system has not been configured yet.'
      );
    });

    it('should reject when user already has open ticket', async () => {
      // Arrange
      mockFindOpenTicketByOwner.mockResolvedValue(FIXTURE_OPEN_TICKET);
      const interaction = createMockButtonInteraction({
        userId: FIXTURE_OPEN_TICKET.ownerId,
      });

      // Act
      await ticketManager.create(interaction);

      // Assert
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.stringContaining('You already have an open ticket')
      );
    });

    it('should handle FK violation error and clear cache', async () => {
      // Arrange
      const error = new Error('FK violation') as any;
      error.code = '23503';
      mockCreateTicketChannel.mockRejectedValue(error);
      const interaction = createMockButtonInteraction({ guildId: 'guild-123' });

      // Act
      await ticketManager.create(interaction);

      // Assert
      expect(mockClearCache).toHaveBeenCalledWith('guild-123');
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('configuration error'),
        })
      );
    });

    it('should pass ticket type label, emoji and issue description', async () => {
      // Arrange
      const interaction = createMockButtonInteraction({ guildId: 'guild-123' });
      mockGetTicketTypeByTypeId.mockResolvedValue({
        id: 1,
        guild_id: 'guild-123',
        type_id: 'technical',
        label: '技術問題',
        style: 'Primary',
        emoji: '🔧',
      });

      // Act
      await ticketManager.create(interaction, 'My issue description', 'technical');

      // Assert
      expect(mockGetTicketTypeByTypeId).toHaveBeenCalledWith('guild-123', 'technical');
      expect(mockSendInitialMessages).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        '技術問題',
        'My issue description',
        '🔧'
      );
    });
  });

  // ============================================
  // close() 測試
  // ============================================

  describe('close()', () => {
    beforeEach(() => {
      mockFindTicketByChannel.mockResolvedValue(FIXTURE_OPEN_TICKET);
      mockCloseTicket.mockResolvedValue(undefined);
      mockArchiveTicketChannel.mockResolvedValue(undefined);
      mockDeleteTicketChannel.mockResolvedValue(undefined);
      mockSendLogMessage.mockResolvedValue('log-message-123');
      mockSendDMOnClose.mockResolvedValue(undefined);
    });

    it('should close ticket successfully with archive when archiveCategoryId is set', async () => {
      // Arrange
      const interaction = createMockModalSubmitInteraction({
        guildId: 'guild-123',
        channelId: FIXTURE_OPEN_TICKET.channelId,
      });

      // Act
      await ticketManager.close(interaction, 'Issue resolved');

      // Assert
      expect(mockFindTicketByChannel).toHaveBeenCalledWith(FIXTURE_OPEN_TICKET.channelId);
      expect(mockCloseTicket).toHaveBeenCalled();
      expect(mockArchiveTicketChannel).toHaveBeenCalled();
      expect(mockDeleteTicketChannel).not.toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith('Ticket closed.');
    });

    it('should delete channel when archiveCategoryId is not set', async () => {
      // Arrange
      const settingsWithoutArchive = createSettingsFixture({ archiveCategoryId: null });
      mockGetSettings.mockResolvedValue(settingsWithoutArchive);
      const interaction = createMockModalSubmitInteraction({
        guildId: 'guild-123',
        channelId: FIXTURE_OPEN_TICKET.channelId,
      });

      // Act
      await ticketManager.close(interaction, 'Issue resolved');

      // Assert
      expect(mockCloseTicket).toHaveBeenCalled();
      expect(mockDeleteTicketChannel).toHaveBeenCalled();
      expect(mockArchiveTicketChannel).not.toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith('Ticket closed. Deleting channel...');
    });

    it('should reject when not in guild', async () => {
      // Arrange
      const interaction = createMockModalSubmitInteraction();
      (interaction.inGuild as any).mockReturnValue(false);

      // Act
      await ticketManager.close(interaction, 'reason');

      // Assert
      expect(interaction.editReply).toHaveBeenCalledWith(
        'This command can only be used in a ticket channel.'
      );
    });

    it('should reject when channel is not a ticket', async () => {
      // Arrange
      mockFindTicketByChannel.mockResolvedValue(undefined);
      const interaction = createMockModalSubmitInteraction();

      // Act
      await ticketManager.close(interaction, 'reason');

      // Assert
      expect(interaction.editReply).toHaveBeenCalledWith(
        'This is not a valid ticket channel.'
      );
    });

    it('should reject when ticket already closed', async () => {
      // Arrange
      mockFindTicketByChannel.mockResolvedValue(FIXTURE_CLOSED_TICKET);
      const interaction = createMockModalSubmitInteraction({
        channelId: FIXTURE_CLOSED_TICKET.channelId,
      });

      // Act
      await ticketManager.close(interaction, 'reason');

      // Assert
      expect(interaction.editReply).toHaveBeenCalledWith(
        'This ticket is already closed.'
      );
    });

    it('should continue even if log message fails', async () => {
      // Arrange
      mockSendLogMessage.mockRejectedValue(new Error('Log failed'));
      const interaction = createMockModalSubmitInteraction({
        channelId: FIXTURE_OPEN_TICKET.channelId,
      });

      // Act
      await ticketManager.close(interaction, 'reason');

      // Assert
      expect(mockCloseTicket).toHaveBeenCalled();
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send log message'),
        expect.any(Error)
      );
    });

    it('should report partial success when archive fails', async () => {
      // Arrange
      mockArchiveTicketChannel.mockRejectedValue(new Error('Archive failed'));
      const interaction = createMockModalSubmitInteraction({
        channelId: FIXTURE_OPEN_TICKET.channelId,
      });

      // Act
      await ticketManager.close(interaction, 'reason');

      // Assert
      expect(mockCloseTicket).toHaveBeenCalled(); // DB 已更新
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.stringContaining('issue archiving')
      );
    });

    it('should report partial success when delete fails', async () => {
      // Arrange
      const settingsWithoutArchive = createSettingsFixture({ archiveCategoryId: null });
      mockGetSettings.mockResolvedValue(settingsWithoutArchive);
      mockDeleteTicketChannel.mockRejectedValue(new Error('Delete failed'));
      const interaction = createMockModalSubmitInteraction({
        channelId: FIXTURE_OPEN_TICKET.channelId,
      });

      // Act
      await ticketManager.close(interaction, 'reason');

      // Assert
      expect(mockCloseTicket).toHaveBeenCalled(); // DB 已更新
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.stringContaining('issue deleting')
      );
    });

    it('should fallback to archive when no transcript is available', async () => {
      // Arrange
      const settingsWithoutArchive = createSettingsFixture({ archiveCategoryId: null });
      mockGetSettings.mockResolvedValue(settingsWithoutArchive);
      mockGenerateTranscript.mockResolvedValue(null); // No transcript
      const interaction = createMockModalSubmitInteraction({
        channelId: FIXTURE_OPEN_TICKET.channelId,
      });

      // Act
      await ticketManager.close(interaction, 'reason');

      // Assert
      expect(mockCloseTicket).toHaveBeenCalled();
      expect(mockArchiveTicketChannel).toHaveBeenCalled();
      expect(mockDeleteTicketChannel).not.toHaveBeenCalled();
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.stringContaining('No valid transcript saved')
      );
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.stringContaining('transcript not available')
      );
    });

    it('should fallback to archive when transcript URL is empty string', async () => {
      // Arrange
      const settingsWithoutArchive = createSettingsFixture({ archiveCategoryId: null });
      mockGetSettings.mockResolvedValue(settingsWithoutArchive);
      mockGenerateTranscript.mockResolvedValue(''); // Empty string
      const interaction = createMockModalSubmitInteraction({
        channelId: FIXTURE_OPEN_TICKET.channelId,
      });

      // Act
      await ticketManager.close(interaction, 'reason');

      // Assert
      expect(mockCloseTicket).toHaveBeenCalled();
      expect(mockArchiveTicketChannel).toHaveBeenCalled();
      expect(mockDeleteTicketChannel).not.toHaveBeenCalled();
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.stringContaining('No valid transcript saved')
      );
    });

    it('should fallback to archive when transcript URL is whitespace only', async () => {
      // Arrange
      const settingsWithoutArchive = createSettingsFixture({ archiveCategoryId: null });
      mockGetSettings.mockResolvedValue(settingsWithoutArchive);
      mockGenerateTranscript.mockResolvedValue('   '); // Whitespace only
      const interaction = createMockModalSubmitInteraction({
        channelId: FIXTURE_OPEN_TICKET.channelId,
      });

      // Act
      await ticketManager.close(interaction, 'reason');

      // Assert
      expect(mockArchiveTicketChannel).toHaveBeenCalled();
      expect(mockDeleteTicketChannel).not.toHaveBeenCalled();
    });

    it('should fallback to archive when transcript URL lacks http prefix', async () => {
      // Arrange
      const settingsWithoutArchive = createSettingsFixture({ archiveCategoryId: null });
      mockGetSettings.mockResolvedValue(settingsWithoutArchive);
      mockGenerateTranscript.mockResolvedValue('ftp://example.com/transcript.html'); // Invalid protocol
      const interaction = createMockModalSubmitInteraction({
        channelId: FIXTURE_OPEN_TICKET.channelId,
      });

      // Act
      await ticketManager.close(interaction, 'reason');

      // Assert
      expect(mockArchiveTicketChannel).toHaveBeenCalled();
      expect(mockDeleteTicketChannel).not.toHaveBeenCalled();
    });

    it('should delete channel when transcript URL is valid https', async () => {
      // Arrange
      const settingsWithoutArchive = createSettingsFixture({ archiveCategoryId: null });
      mockGetSettings.mockResolvedValue(settingsWithoutArchive);
      mockGenerateTranscript.mockResolvedValue('https://example.com/transcript.html');
      const interaction = createMockModalSubmitInteraction({
        channelId: FIXTURE_OPEN_TICKET.channelId,
      });

      // Act
      await ticketManager.close(interaction, 'reason');

      // Assert
      expect(mockDeleteTicketChannel).toHaveBeenCalled();
      expect(mockArchiveTicketChannel).not.toHaveBeenCalled();
    });

    it('should delete channel when transcript URL is valid http', async () => {
      // Arrange
      const settingsWithoutArchive = createSettingsFixture({ archiveCategoryId: null });
      mockGetSettings.mockResolvedValue(settingsWithoutArchive);
      mockGenerateTranscript.mockResolvedValue('http://localhost:3000/transcript.html');
      const interaction = createMockModalSubmitInteraction({
        channelId: FIXTURE_OPEN_TICKET.channelId,
      });

      // Act
      await ticketManager.close(interaction, 'reason');

      // Assert
      expect(mockDeleteTicketChannel).toHaveBeenCalled();
      expect(mockArchiveTicketChannel).not.toHaveBeenCalled();
    });

    it('should report error when settings is null', async () => {
      // Arrange - settings null means configuration is missing
      mockGetSettings.mockResolvedValue(null);
      const interaction = createMockModalSubmitInteraction({
        channelId: FIXTURE_OPEN_TICKET.channelId,
      });

      // Act
      await ticketManager.close(interaction, 'reason');

      // Assert
      expect(mockCloseTicket).toHaveBeenCalled();
      expect(mockArchiveTicketChannel).not.toHaveBeenCalled();
      expect(mockDeleteTicketChannel).not.toHaveBeenCalled();
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.stringContaining('has no settings configured')
      );
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.stringContaining('server not configured')
      );
    });

    it('should continue even if DM fails', async () => {
      // Arrange
      mockSendDMOnClose.mockRejectedValue(new Error('DM failed'));
      const interaction = createMockModalSubmitInteraction({
        channelId: FIXTURE_OPEN_TICKET.channelId,
      });

      // Act
      await ticketManager.close(interaction, 'reason');

      // Assert
      expect(interaction.editReply).toHaveBeenCalledWith('Ticket closed.');
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send DM'),
        expect.any(Error)
      );
    });
  });

  // ============================================
  // claim() 測試
  // ============================================

  describe('claim()', () => {
    it('should claim ticket successfully', async () => {
      // Arrange
      mockFindTicketByChannel.mockResolvedValue(FIXTURE_OPEN_TICKET);
      const interaction = createMockButtonInteraction({
        channelId: FIXTURE_OPEN_TICKET.channelId,
        memberRoles: [FIXTURE_COMPLETE_SETTINGS.staffRoleId!],
      });

      // Act
      const result = await ticketManager.claim(interaction);

      // Assert
      expect(mockClaimTicket).toHaveBeenCalledWith(
        FIXTURE_OPEN_TICKET.channelId,
        interaction.user.id
      );
      expect(result).toEqual(FIXTURE_OPEN_TICKET);
    });

    it('should throw when not in guild', async () => {
      // Arrange
      const interaction = createMockButtonInteraction();
      (interaction.inGuild as any).mockReturnValue(false);

      // Act & Assert
      await expect(ticketManager.claim(interaction)).rejects.toThrow(
        'This command can only be used in a server.'
      );
    });

    it('should throw when user lacks staff role', async () => {
      // Arrange
      const interaction = createMockButtonInteraction({
        memberRoles: [], // 沒有 staff 角色
      });

      // Act & Assert
      await expect(ticketManager.claim(interaction)).rejects.toThrow(
        'You do not have permission to claim this ticket.'
      );
    });

    it('should throw when channel is not a ticket', async () => {
      // Arrange
      mockFindTicketByChannel.mockResolvedValue(undefined);
      const interaction = createMockButtonInteraction({
        memberRoles: [FIXTURE_COMPLETE_SETTINGS.staffRoleId!],
      });

      // Act & Assert
      await expect(ticketManager.claim(interaction)).rejects.toThrow(
        'This is not a valid ticket channel.'
      );
    });

    it('should throw when ticket already claimed', async () => {
      // Arrange
      mockFindTicketByChannel.mockResolvedValue(FIXTURE_CLAIMED_TICKET);
      const interaction = createMockButtonInteraction({
        channelId: FIXTURE_CLAIMED_TICKET.channelId,
        memberRoles: [FIXTURE_COMPLETE_SETTINGS.staffRoleId!],
      });

      // Act & Assert
      await expect(ticketManager.claim(interaction)).rejects.toThrow(
        'This ticket has already been claimed.'
      );
    });
  });

  // ============================================
  // findTicketByChannel() 測試
  // ============================================

  describe('findTicketByChannel()', () => {
    it('should delegate to repository', async () => {
      // Arrange
      mockFindTicketByChannel.mockResolvedValue(FIXTURE_OPEN_TICKET);

      // Act
      const result = await ticketManager.findTicketByChannel('channel-123');

      // Assert
      expect(mockFindTicketByChannel).toHaveBeenCalledWith('channel-123');
      expect(result).toEqual(FIXTURE_OPEN_TICKET);
    });
  });

  // ============================================
  // purge() 測試
  // ============================================

  describe('purge()', () => {
    it('should delegate to repository', async () => {
      // Arrange
      mockPurgeTickets.mockResolvedValue(undefined);

      // Act
      await ticketManager.purge('guild-123');

      // Assert
      expect(mockPurgeTickets).toHaveBeenCalledWith('guild-123');
    });
  });

  // ============================================
  // addUser() / removeUser() 測試
  // ============================================

  describe('addUser()', () => {
    it('should add user to ticket channel', async () => {
      // Arrange
      mockFindTicketByChannel.mockResolvedValue(FIXTURE_OPEN_TICKET);
      mockAddUserToChannel.mockResolvedValue(undefined);
      const channel = createMockTextChannel({ id: FIXTURE_OPEN_TICKET.channelId });
      const user = createMockUser({ id: 'new-user-123' });

      // Act
      await ticketManager.addUser(channel, user);

      // Assert
      expect(mockAddUserToChannel).toHaveBeenCalledWith(channel, user);
    });

    it('should throw when channel is not a ticket', async () => {
      // Arrange
      mockFindTicketByChannel.mockResolvedValue(undefined);
      const channel = createMockTextChannel({ id: 'non-ticket-channel' });
      const user = createMockUser();

      // Act & Assert
      await expect(ticketManager.addUser(channel, user)).rejects.toThrow(
        'This is not a valid ticket channel.'
      );
    });
  });

  describe('removeUser()', () => {
    it('should remove user from ticket channel', async () => {
      // Arrange
      mockFindTicketByChannel.mockResolvedValue(FIXTURE_OPEN_TICKET);
      mockRemoveUserFromChannel.mockResolvedValue(undefined);
      const channel = createMockTextChannel({ id: FIXTURE_OPEN_TICKET.channelId });
      const user = createMockUser({ id: 'user-to-remove' });

      // Act
      await ticketManager.removeUser(channel, user);

      // Assert
      expect(mockRemoveUserFromChannel).toHaveBeenCalledWith(channel, user);
    });

    it('should throw when channel is not a ticket', async () => {
      // Arrange
      mockFindTicketByChannel.mockResolvedValue(undefined);
      const channel = createMockTextChannel({ id: 'non-ticket-channel' });
      const user = createMockUser();

      // Act & Assert
      await expect(ticketManager.removeUser(channel, user)).rejects.toThrow(
        'This is not a valid ticket channel.'
      );
    });
  });
});
