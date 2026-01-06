/**
 * DiscordService 單元測試
 *
 * 測試範圍：
 * - createTicketChannel(): 建立 ticket 頻道、權限設定
 * - buildTicketContainer(): UI 建構、描述截斷
 * - buildTicketActionRow(): 按鈕狀態
 * - sendInitialMessages(): 訊息發送、錯誤回滾
 * - sendLogMessage(): Log 訊息發送
 * - archiveTicketChannel(): 頻道歸檔、權限修改
 * - deleteTicketChannel(): 頻道刪除
 * - addUserToChannel() / removeUserFromChannel(): 權限操作
 * - sendDMOnClose(): DM 發送
 *
 * Mock 策略：
 * - Discord.js: Guild, TextChannel, User, Client
 * - ticketDebug utilities: safeDeletePermissionOverwrite, safeEditPermissionOverwrite
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChannelType, ButtonStyle } from 'discord.js';

// ============================================
// Mock 設定 - 使用 vi.hoisted 確保持久化
// ============================================

const {
  mockLoggerDebug,
  mockLoggerInfo,
  mockLoggerWarn,
  mockLoggerError,
  mockSafeDeletePermissionOverwrite,
  mockSafeEditPermissionOverwrite,
  mockLogChannelPermissions,
} = vi.hoisted(() => ({
  mockLoggerDebug: vi.fn(),
  mockLoggerInfo: vi.fn(),
  mockLoggerWarn: vi.fn(),
  mockLoggerError: vi.fn(),
  mockSafeDeletePermissionOverwrite: vi.fn(),
  mockSafeEditPermissionOverwrite: vi.fn(),
  mockLogChannelPermissions: vi.fn(),
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

// Mock ticketDebug utilities
vi.mock('../../../src/utils/ticketDebug.js', () => ({
  safeDeletePermissionOverwrite: mockSafeDeletePermissionOverwrite,
  safeEditPermissionOverwrite: mockSafeEditPermissionOverwrite,
  logChannelPermissions: mockLogChannelPermissions,
}));

// Mock constants
vi.mock('../../../src/constants.js', () => ({
  DISCORD_BLURPLE: 0x5865f2,
  DISCORD_GREEN: 0x57f287,
  DISCORD_DEFAULT_AVATAR: 'https://cdn.discordapp.com/embed/avatars/0.png',
  TICKET_LOG_BANNER_URL: 'https://example.com/banner.png',
  EMOJIS: {
    ID: { toComponentEmoji: () => ({ name: 'id', id: '123' }) },
    OPEN: '📬',
    OPENTIME: '🕐',
    CLOSE: '📪',
    CLAIM: '🙋',
    REASON: '📝',
  },
}));

// ============================================
// 現在可以安全地 import
// ============================================

import { DiscordService } from '../../../src/services/DiscordService.js';
import { TicketAction } from '../../../src/types/ticket.js';

// ============================================
// 測試輔助函數
// ============================================

function createMockClient() {
  return {
    users: {
      fetch: vi.fn(),
    },
  };
}

function createMockUser(overrides: Partial<{
  id: string;
  username: string;
  displayAvatarURL: () => string;
  send: ReturnType<typeof vi.fn>;
}> = {}) {
  return {
    id: overrides.id ?? 'user-123',
    username: overrides.username ?? 'TestUser',
    displayAvatarURL: overrides.displayAvatarURL ?? vi.fn().mockReturnValue('https://cdn.discordapp.com/avatars/123/abc.png'),
    send: overrides.send ?? vi.fn().mockResolvedValue(undefined),
  };
}

function createMockGuild(overrides: Partial<{
  id: string;
  name: string;
  iconURL: () => string | null;
  roles: { everyone: { id: string } };
  channels: { create: ReturnType<typeof vi.fn>; fetch: ReturnType<typeof vi.fn> };
}> = {}) {
  return {
    id: overrides.id ?? 'guild-123',
    name: overrides.name ?? 'Test Guild',
    iconURL: overrides.iconURL ?? vi.fn().mockReturnValue('https://cdn.discordapp.com/icons/123/abc.png'),
    roles: overrides.roles ?? {
      everyone: { id: 'guild-123' },
    },
    channels: overrides.channels ?? {
      create: vi.fn(),
      fetch: vi.fn(),
    },
  };
}

function createMockTextChannel(overrides: Partial<{
  id: string;
  send: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  setParent: ReturnType<typeof vi.fn>;
  permissionOverwrites: { edit: ReturnType<typeof vi.fn> };
  guild: ReturnType<typeof createMockGuild>;
}> = {}) {
  const mockGuild = overrides.guild ?? createMockGuild();
  return {
    id: overrides.id ?? 'channel-123',
    send: overrides.send ?? vi.fn().mockResolvedValue({ id: 'message-123' }),
    delete: overrides.delete ?? vi.fn().mockResolvedValue(undefined),
    setParent: overrides.setParent ?? vi.fn().mockResolvedValue(undefined),
    permissionOverwrites: overrides.permissionOverwrites ?? {
      edit: vi.fn().mockResolvedValue(undefined),
    },
    guild: mockGuild,
  };
}

function createMockSettings(overrides: Partial<{
  staffRoleId: string | null;
  ticketCategoryId: string | null;
  archiveCategoryId: string | null;
  logChannelId: string | null;
}> = {}) {
  return {
    staffRoleId: overrides.staffRoleId ?? 'staff-role-123',
    ticketCategoryId: overrides.ticketCategoryId ?? 'category-123',
    archiveCategoryId: overrides.archiveCategoryId ?? 'archive-category-123',
    logChannelId: overrides.logChannelId ?? 'log-channel-123',
  };
}

function createMockTicket(overrides: Partial<{
  id: number;
  guildTicketId: number;
  createdAt: Date;
  claimedById: string | null;
}> = {}) {
  return {
    id: overrides.id ?? 1,
    guildTicketId: overrides.guildTicketId ?? 42,
    createdAt: overrides.createdAt ?? new Date('2024-01-15T10:00:00Z'),
    claimedById: overrides.claimedById ?? null,
  };
}

describe('DiscordService', () => {
  let discordService: DiscordService;
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockClient();
    discordService = new DiscordService(mockClient as any);

    // 預設 mock 行為
    mockSafeDeletePermissionOverwrite.mockResolvedValue(true);
    mockSafeEditPermissionOverwrite.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================
  // createTicketChannel() 測試
  // ============================================

  describe('createTicketChannel()', () => {
    it('should create channel with correct name and type', async () => {
      // Arrange
      const mockGuild = createMockGuild();
      const mockUser = createMockUser({ username: 'JohnDoe' });
      const mockSettings = createMockSettings();
      const mockChannel = createMockTextChannel();
      mockGuild.channels.create.mockResolvedValue(mockChannel);

      // Act
      const result = await discordService.createTicketChannel(
        mockGuild as any,
        mockUser as any,
        mockSettings as any,
        1
      );

      // Assert
      expect(mockGuild.channels.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'ticket-JohnDoe',
          type: ChannelType.GuildText,
          parent: 'category-123',
        })
      );
      expect(result).toBe(mockChannel);
    });

    it('should set permission overwrites for guild, user, and staff role', async () => {
      // Arrange
      const mockGuild = createMockGuild();
      const mockUser = createMockUser();
      const mockSettings = createMockSettings({ staffRoleId: 'staff-123' });
      const mockChannel = createMockTextChannel();
      mockGuild.channels.create.mockResolvedValue(mockChannel);

      // Act
      await discordService.createTicketChannel(
        mockGuild as any,
        mockUser as any,
        mockSettings as any,
        1
      );

      // Assert
      const callArgs = mockGuild.channels.create.mock.calls[0][0];
      expect(callArgs.permissionOverwrites).toHaveLength(3);
      expect(callArgs.permissionOverwrites[0]).toEqual({
        id: 'guild-123',
        deny: ['ViewChannel'],
      });
      expect(callArgs.permissionOverwrites[1]).toEqual({
        id: 'user-123',
        allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
      });
      expect(callArgs.permissionOverwrites[2]).toEqual({
        id: 'staff-123',
        allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
      });
    });

    it('should not add staff role permission if staffRoleId is null', async () => {
      // Arrange
      const mockGuild = createMockGuild();
      const mockUser = createMockUser();
      // Explicitly set staffRoleId to null and ensure it's not in settings
      const mockSettings = {
        staffRoleId: null,
        ticketCategoryId: 'category-123',
        archiveCategoryId: null,
        logChannelId: null,
      };
      const mockChannel = createMockTextChannel();
      mockGuild.channels.create.mockResolvedValue(mockChannel);

      // Act
      await discordService.createTicketChannel(
        mockGuild as any,
        mockUser as any,
        mockSettings as any,
        1
      );

      // Assert
      const callArgs = mockGuild.channels.create.mock.calls[0][0];
      // Should only have 2 permissions: @everyone deny, user allow (no staff role)
      expect(callArgs.permissionOverwrites).toHaveLength(2);
      expect(callArgs.permissionOverwrites.map((p: any) => p.id)).not.toContain(null);
    });

    it('should throw error and log when channel creation fails', async () => {
      // Arrange
      const mockGuild = createMockGuild();
      const mockUser = createMockUser();
      const mockSettings = createMockSettings();
      mockGuild.channels.create.mockRejectedValue(new Error('API Error'));

      // Act & Assert
      await expect(
        discordService.createTicketChannel(
          mockGuild as any,
          mockUser as any,
          mockSettings as any,
          1
        )
      ).rejects.toThrow('Could not create the ticket channel.');
      expect(mockLoggerError).toHaveBeenCalledWith(
        'Failed to create ticket channel:',
        expect.any(Error)
      );
    });
  });

  // ============================================
  // buildTicketContainer() 測試 (靜態方法)
  // ============================================

  describe('buildTicketContainer()', () => {
    it('should build container with user info', () => {
      // Arrange
      const mockUser = createMockUser();

      // Act
      const container = DiscordService.buildTicketContainer(mockUser as any);

      // Assert
      expect(container).toBeDefined();
      expect(container.toJSON()).toBeDefined();
    });

    it('should truncate description longer than 1024 characters', () => {
      // Arrange
      const mockUser = createMockUser();
      const longDescription = 'a'.repeat(1500);

      // Act
      DiscordService.buildTicketContainer(
        mockUser as any,
        'General',
        longDescription
      );

      // Assert
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.stringContaining('truncated from 1500 to 1024')
      );
    });

    it('should not truncate description under 1024 characters', () => {
      // Arrange
      const mockUser = createMockUser();
      const shortDescription = 'a'.repeat(500);

      // Act
      DiscordService.buildTicketContainer(
        mockUser as any,
        'General',
        shortDescription
      );

      // Assert
      expect(mockLoggerWarn).not.toHaveBeenCalled();
    });

    it('should use default description when not provided', () => {
      // Arrange
      const mockUser = createMockUser();

      // Act
      const container = DiscordService.buildTicketContainer(mockUser as any);

      // Assert
      expect(container).toBeDefined();
      // Container should be built successfully without description
    });

    it('should include claimed by section when claimedBy is provided', () => {
      // Arrange
      const mockUser = createMockUser();

      // Act
      const container = DiscordService.buildTicketContainer(
        mockUser as any,
        'Support',
        'Issue description',
        'claimer-456'
      );

      // Assert
      expect(container).toBeDefined();
    });
  });

  // ============================================
  // buildTicketActionRow() 測試 (靜態方法)
  // ============================================

  describe('buildTicketActionRow()', () => {
    it('should build action row with close and claim buttons', () => {
      // Act
      const row = DiscordService.buildTicketActionRow();

      // Assert
      const json = row.toJSON();
      expect(json.components).toHaveLength(2);
      expect(json.components[0].custom_id).toBe(TicketAction.CLOSE);
      expect(json.components[0].style).toBe(ButtonStyle.Danger);
      expect(json.components[1].custom_id).toBe(TicketAction.CLAIM);
      expect(json.components[1].style).toBe(ButtonStyle.Success);
    });

    it('should disable claim button when claimed is true', () => {
      // Act
      const row = DiscordService.buildTicketActionRow(true);

      // Assert
      const json = row.toJSON();
      expect(json.components[1].disabled).toBe(true);
    });

    it('should not disable claim button when claimed is false', () => {
      // Act
      const row = DiscordService.buildTicketActionRow(false);

      // Assert
      const json = row.toJSON();
      expect(json.components[1].disabled).toBe(false);
    });

    it('should use custom labels when provided', () => {
      // Act
      const row = DiscordService.buildTicketActionRow(
        false,
        'Custom Claim',
        'Custom Close'
      );

      // Assert
      const json = row.toJSON();
      expect(json.components[0].label).toBe('Custom Close');
      expect(json.components[1].label).toBe('Custom Claim');
    });
  });

  // ============================================
  // sendInitialMessages() 測試
  // ============================================

  describe('sendInitialMessages()', () => {
    it('should send container and mention messages', async () => {
      // Arrange
      const mockChannel = createMockTextChannel();
      const mockUser = createMockUser();
      const mockSettings = createMockSettings();

      // Act
      await discordService.sendInitialMessages(
        mockChannel as any,
        mockUser as any,
        mockSettings as any,
        'Support',
        'Need help'
      );

      // Assert
      expect(mockChannel.send).toHaveBeenCalledTimes(2);
    });

    it('should include staff role mention when staffRoleId exists', async () => {
      // Arrange
      const mockChannel = createMockTextChannel();
      const mockUser = createMockUser();
      const mockSettings = createMockSettings({ staffRoleId: 'staff-456' });

      // Act
      await discordService.sendInitialMessages(
        mockChannel as any,
        mockUser as any,
        mockSettings as any
      );

      // Assert
      const mentionCall = mockChannel.send.mock.calls.find(
        (call: any[]) => call[0].content?.includes('<@&staff-456>')
      );
      expect(mentionCall).toBeDefined();
    });

    it('should delete channel and throw error when send fails', async () => {
      // Arrange
      const mockChannel = createMockTextChannel();
      mockChannel.send.mockRejectedValue(new Error('Send failed'));
      const mockUser = createMockUser();
      const mockSettings = createMockSettings();

      // Act & Assert
      await expect(
        discordService.sendInitialMessages(
          mockChannel as any,
          mockUser as any,
          mockSettings as any
        )
      ).rejects.toThrow('Could not send messages to the new ticket channel.');
      expect(mockChannel.delete).toHaveBeenCalled();
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send initial messages'),
        expect.any(Error)
      );
    });

    it('should log error if channel deletion also fails', async () => {
      // Arrange
      const mockChannel = createMockTextChannel();
      mockChannel.send.mockRejectedValue(new Error('Send failed'));
      mockChannel.delete.mockRejectedValue(new Error('Delete failed'));
      const mockUser = createMockUser();
      const mockSettings = createMockSettings();

      // Act & Assert
      await expect(
        discordService.sendInitialMessages(
          mockChannel as any,
          mockUser as any,
          mockSettings as any
        )
      ).rejects.toThrow('Could not send messages to the new ticket channel.');
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to clean up channel'),
        expect.any(Error)
      );
    });
  });

  // ============================================
  // sendLogMessage() 測試
  // ============================================

  describe('sendLogMessage()', () => {
    it('should send log message to log channel', async () => {
      // Arrange
      const mockLogChannel = createMockTextChannel({ id: 'log-channel-123' });
      const mockGuild = createMockGuild();
      mockGuild.channels.fetch.mockResolvedValue(mockLogChannel);
      const mockOwner = createMockUser({ id: 'owner-123' });
      const mockCloser = createMockUser({ id: 'closer-456' });
      const mockTicket = createMockTicket();

      // Act
      const result = await discordService.sendLogMessage(
        mockGuild as any,
        'log-channel-123',
        mockTicket as any,
        mockOwner as any,
        mockCloser as any,
        'Resolved',
        'https://transcript.url'
      );

      // Assert
      expect(mockGuild.channels.fetch).toHaveBeenCalledWith('log-channel-123');
      expect(mockLogChannel.send).toHaveBeenCalled();
      expect(result).toBe('message-123');
    });

    it('should return null and log error when send fails', async () => {
      // Arrange
      const mockLogChannel = createMockTextChannel();
      mockLogChannel.send.mockRejectedValue(new Error('Send failed'));
      const mockGuild = createMockGuild();
      mockGuild.channels.fetch.mockResolvedValue(mockLogChannel);
      const mockOwner = createMockUser();
      const mockCloser = createMockUser();
      const mockTicket = createMockTicket();

      // Act
      const result = await discordService.sendLogMessage(
        mockGuild as any,
        'log-channel-123',
        mockTicket as any,
        mockOwner as any,
        mockCloser as any,
        'Resolved',
        null
      );

      // Assert
      expect(result).toBeNull();
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send log message'),
        expect.any(Error)
      );
    });

    it('should include transcript button when transcriptUrl is provided', async () => {
      // Arrange
      const mockLogChannel = createMockTextChannel();
      const mockGuild = createMockGuild();
      mockGuild.channels.fetch.mockResolvedValue(mockLogChannel);
      const mockOwner = createMockUser();
      const mockCloser = createMockUser();
      const mockTicket = createMockTicket();

      // Act
      await discordService.sendLogMessage(
        mockGuild as any,
        'log-channel-123',
        mockTicket as any,
        mockOwner as any,
        mockCloser as any,
        'Resolved',
        'https://transcript.url'
      );

      // Assert
      const sendCall = mockLogChannel.send.mock.calls[0][0];
      // Should have container + transcript button row + history button row
      expect(sendCall.components.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ============================================
  // archiveTicketChannel() 測試
  // ============================================

  describe('archiveTicketChannel()', () => {
    it('should remove @everyone view permission', async () => {
      // Arrange
      const mockChannel = createMockTextChannel();
      const mockOwner = createMockUser();
      const mockSettings = createMockSettings();

      // Act
      await discordService.archiveTicketChannel(
        mockChannel as any,
        mockOwner as any,
        mockSettings as any
      );

      // Assert
      expect(mockSafeEditPermissionOverwrite).toHaveBeenCalledWith(
        mockChannel,
        mockChannel.guild.roles.everyone.id,
        '@everyone',
        { ViewChannel: false }
      );
    });

    it('should throw error if @everyone permission removal fails', async () => {
      // Arrange
      const mockChannel = createMockTextChannel();
      const mockOwner = createMockUser();
      const mockSettings = createMockSettings();
      mockSafeEditPermissionOverwrite.mockResolvedValueOnce(false);

      // Act & Assert
      await expect(
        discordService.archiveTicketChannel(
          mockChannel as any,
          mockOwner as any,
          mockSettings as any
        )
      ).rejects.toThrow('Failed to secure channel');
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining('SECURITY CRITICAL')
      );
    });

    it('should delete owner permission overwrite', async () => {
      // Arrange
      const mockChannel = createMockTextChannel();
      const mockOwner = createMockUser({ id: 'owner-123', username: 'Owner' });
      const mockSettings = createMockSettings();

      // Act
      await discordService.archiveTicketChannel(
        mockChannel as any,
        mockOwner as any,
        mockSettings as any
      );

      // Assert
      expect(mockSafeDeletePermissionOverwrite).toHaveBeenCalledWith(
        mockChannel,
        'owner-123',
        'Owner Owner'
      );
    });

    it('should edit staff role permissions to read-only', async () => {
      // Arrange
      const mockChannel = createMockTextChannel();
      const mockOwner = createMockUser();
      const mockSettings = createMockSettings({ staffRoleId: 'staff-123' });

      // Act
      await discordService.archiveTicketChannel(
        mockChannel as any,
        mockOwner as any,
        mockSettings as any
      );

      // Assert
      expect(mockSafeEditPermissionOverwrite).toHaveBeenCalledWith(
        mockChannel,
        'staff-123',
        'Staff Role',
        {
          ViewChannel: true,
          SendMessages: false,
          ReadMessageHistory: true,
        }
      );
    });

    it('should move channel to archive category', async () => {
      // Arrange
      const mockChannel = createMockTextChannel();
      mockChannel.guild.channels.fetch.mockResolvedValue({ id: 'archive-cat' });
      const mockOwner = createMockUser();
      const mockSettings = createMockSettings({ archiveCategoryId: 'archive-cat' });

      // Act
      await discordService.archiveTicketChannel(
        mockChannel as any,
        mockOwner as any,
        mockSettings as any
      );

      // Assert
      expect(mockChannel.setParent).toHaveBeenCalledWith('archive-cat', {
        lockPermissions: false,
      });
    });

    it('should warn if archive category not found', async () => {
      // Arrange
      const mockChannel = createMockTextChannel();
      mockChannel.guild.channels.fetch.mockResolvedValue(null);
      const mockOwner = createMockUser();
      const mockSettings = createMockSettings({ archiveCategoryId: 'missing-cat' });

      // Act
      await discordService.archiveTicketChannel(
        mockChannel as any,
        mockOwner as any,
        mockSettings as any
      );

      // Assert
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.stringContaining('Archive category')
      );
      expect(mockChannel.setParent).not.toHaveBeenCalled();
    });

    it('should handle move failure gracefully (50 channel limit)', async () => {
      // Arrange
      const mockChannel = createMockTextChannel();
      mockChannel.guild.channels.fetch.mockResolvedValue({ id: 'archive-cat' });
      mockChannel.setParent.mockRejectedValue(new Error('Category full'));
      const mockOwner = createMockUser();
      const mockSettings = createMockSettings({ archiveCategoryId: 'archive-cat' });

      // Act - should not throw
      await discordService.archiveTicketChannel(
        mockChannel as any,
        mockOwner as any,
        mockSettings as any
      );

      // Assert
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to move channel'),
        expect.any(String)
      );
    });

    it('should skip archive move if archiveCategoryId is not set', async () => {
      // Arrange
      const mockChannel = createMockTextChannel();
      const mockOwner = createMockUser();
      // Explicitly null archive category
      const mockSettings = {
        staffRoleId: null,
        ticketCategoryId: 'category-123',
        archiveCategoryId: null,
        logChannelId: null,
      };

      // Act
      await discordService.archiveTicketChannel(
        mockChannel as any,
        mockOwner as any,
        mockSettings as any
      );

      // Assert
      expect(mockChannel.setParent).not.toHaveBeenCalled();
      // Just verify it doesn't try to move (no archive category)
    });
  });

  // ============================================
  // deleteTicketChannel() 測試
  // ============================================

  describe('deleteTicketChannel()', () => {
    it('should delete the channel successfully', async () => {
      // Arrange
      const mockChannel = createMockTextChannel();

      // Act
      await discordService.deleteTicketChannel(mockChannel as any);

      // Assert
      expect(mockChannel.delete).toHaveBeenCalledWith('Ticket closed - deleting ticket channel');
    });

    it('should throw error if channel deletion fails', async () => {
      // Arrange
      const mockChannel = createMockTextChannel();
      mockChannel.delete.mockRejectedValue(new Error('Missing Permissions'));

      // Act & Assert
      await expect(
        discordService.deleteTicketChannel(mockChannel as any)
      ).rejects.toThrow('Failed to delete ticket channel');
    });

    it('should log channel ID before deletion', async () => {
      // Arrange
      const mockChannel = createMockTextChannel();

      // Act
      await discordService.deleteTicketChannel(mockChannel as any);

      // Assert
      expect(mockLogChannelPermissions).toHaveBeenCalledWith(
        mockChannel,
        'Before Delete'
      );
    });
  });

  // ============================================
  // addUserToChannel() 測試
  // ============================================

  describe('addUserToChannel()', () => {
    it('should add ViewChannel permission for user', async () => {
      // Arrange
      const mockChannel = createMockTextChannel();
      const mockUser = createMockUser({ id: 'new-user-123' });

      // Act
      await discordService.addUserToChannel(mockChannel as any, mockUser as any);

      // Assert
      expect(mockChannel.permissionOverwrites.edit).toHaveBeenCalledWith(
        'new-user-123',
        { ViewChannel: true }
      );
    });
  });

  // ============================================
  // removeUserFromChannel() 測試
  // ============================================

  describe('removeUserFromChannel()', () => {
    it('should remove user permission overwrite', async () => {
      // Arrange
      const mockChannel = createMockTextChannel();
      const mockUser = createMockUser({ id: 'remove-user-123', username: 'ToRemove' });

      // Act
      await discordService.removeUserFromChannel(mockChannel as any, mockUser as any);

      // Assert
      expect(mockSafeDeletePermissionOverwrite).toHaveBeenCalledWith(
        mockChannel,
        'remove-user-123',
        'User ToRemove'
      );
    });

    it('should throw error if removal fails', async () => {
      // Arrange
      const mockChannel = createMockTextChannel();
      const mockUser = createMockUser({ username: 'FailUser' });
      mockSafeDeletePermissionOverwrite.mockResolvedValueOnce(false);

      // Act & Assert
      await expect(
        discordService.removeUserFromChannel(mockChannel as any, mockUser as any)
      ).rejects.toThrow('Failed to remove user FailUser from channel');
    });
  });

  // ============================================
  // sendDMOnClose() 測試
  // ============================================

  describe('sendDMOnClose()', () => {
    it('should send DM to ticket owner', async () => {
      // Arrange
      const mockGuild = createMockGuild();
      const mockOwner = createMockUser();
      const mockCloser = createMockUser({ id: 'closer-456' });
      const mockTicket = createMockTicket();

      // Act
      await discordService.sendDMOnClose(
        mockGuild as any,
        mockTicket as any,
        mockOwner as any,
        mockCloser as any,
        'Issue resolved',
        'https://transcript.url'
      );

      // Assert
      expect(mockOwner.send).toHaveBeenCalled();
    });

    it('should log warning if DM fails (user has DMs disabled)', async () => {
      // Arrange
      const mockGuild = createMockGuild();
      const mockOwner = createMockUser();
      mockOwner.send.mockRejectedValue(new Error('Cannot send DM'));
      const mockCloser = createMockUser();
      const mockTicket = createMockTicket();

      // Act
      await discordService.sendDMOnClose(
        mockGuild as any,
        mockTicket as any,
        mockOwner as any,
        mockCloser as any,
        'Resolved',
        null
      );

      // Assert
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.stringContaining('Could not DM user'),
        expect.any(Error)
      );
    });

    it('should include transcript button when transcriptUrl is provided', async () => {
      // Arrange
      const mockGuild = createMockGuild();
      const mockOwner = createMockUser();
      const mockCloser = createMockUser();
      const mockTicket = createMockTicket();

      // Act
      await discordService.sendDMOnClose(
        mockGuild as any,
        mockTicket as any,
        mockOwner as any,
        mockCloser as any,
        'Resolved',
        'https://transcript.url'
      );

      // Assert
      const sendCall = mockOwner.send.mock.calls[0][0];
      expect(sendCall.components.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ============================================
  // fetchUser() 測試
  // ============================================

  describe('fetchUser()', () => {
    it('should fetch user from client', async () => {
      // Arrange
      const expectedUser = createMockUser({ id: 'fetched-user-123' });
      mockClient.users.fetch.mockResolvedValue(expectedUser);

      // Act
      const result = await discordService.fetchUser('fetched-user-123');

      // Assert
      expect(mockClient.users.fetch).toHaveBeenCalledWith('fetched-user-123');
      expect(result).toBe(expectedUser);
    });
  });
});
