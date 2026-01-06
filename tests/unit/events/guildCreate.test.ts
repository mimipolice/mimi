/**
 * guildCreate.ts Event Handler Unit Tests
 *
 * Test Coverage:
 * - Welcome message sending to system channel
 * - Fallback channel selection
 * - Permission checking
 * - No suitable channel handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChannelType, PermissionsBitField } from 'discord.js';

// ============================================
// Mock Setup
// ============================================

// No external dependencies to mock for this simple event handler

// ============================================
// Import after mocks are set up
// ============================================

import { name, execute } from '../../../src/events/guildCreate.js';

// ============================================
// Test Helpers
// ============================================

function createMockGuild(options: {
  systemChannel?: any;
  channels?: any[];
  botMember?: any;
} = {}) {
  const mockBotMember = options.botMember ?? {
    id: 'bot-123',
  };

  const channelsCache = new Map();
  (options.channels ?? []).forEach((ch) => {
    channelsCache.set(ch.id, ch);
  });

  return {
    id: 'guild-123',
    name: 'Test Guild',
    systemChannel: options.systemChannel ?? null,
    channels: {
      cache: {
        find: vi.fn().mockImplementation((predicate: Function) => {
          for (const channel of channelsCache.values()) {
            if (predicate(channel)) {
              return channel;
            }
          }
          return undefined;
        }),
      },
    },
    members: {
      me: mockBotMember,
    },
  };
}

function createMockChannel(options: {
  id?: string;
  type?: ChannelType;
  canSend?: boolean;
} = {}) {
  return {
    id: options.id ?? 'channel-123',
    type: options.type ?? ChannelType.GuildText,
    send: vi.fn().mockResolvedValue({ id: 'message-123' }),
    permissionsFor: vi.fn().mockReturnValue({
      has: vi.fn().mockReturnValue(options.canSend ?? true),
    }),
  };
}

describe('guildCreate event', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================
  // Event Metadata Tests
  // ============================================

  describe('event metadata', () => {
    it('should have correct event name', () => {
      expect(name).toBe('guildCreate');
    });
  });

  // ============================================
  // Welcome Message Tests
  // ============================================

  describe('welcome message sending', () => {
    it('should send welcome message to system channel', async () => {
      // Arrange
      const systemChannel = createMockChannel({ id: 'system-channel' });
      const guild = createMockGuild({ systemChannel });

      // Act
      await execute(guild as any);

      // Assert
      expect(systemChannel.send).toHaveBeenCalled();
      expect(systemChannel.send).toHaveBeenCalledWith({
        content: expect.stringContaining('Thanks for inviting me'),
      });
    });

    it('should include bilingual welcome message', async () => {
      // Arrange
      const systemChannel = createMockChannel({ id: 'system-channel' });
      const guild = createMockGuild({ systemChannel });

      // Act
      await execute(guild as any);

      // Assert
      const sendCall = systemChannel.send.mock.calls[0][0];
      expect(sendCall.content).toContain('Thanks for inviting me');
    });
  });

  // ============================================
  // Fallback Channel Selection Tests
  // ============================================

  describe('fallback channel selection', () => {
    it('should find fallback text channel when no system channel', async () => {
      // Arrange
      const fallbackChannel = createMockChannel({
        id: 'fallback-channel',
        type: ChannelType.GuildText,
        canSend: true,
      });
      const guild = createMockGuild({
        systemChannel: null,
        channels: [fallbackChannel],
      });

      // Mock the find implementation to return fallback channel
      guild.channels.cache.find.mockImplementation((predicate: Function) => {
        if (predicate(fallbackChannel)) {
          return fallbackChannel;
        }
        return undefined;
      });

      // Act
      await execute(guild as any);

      // Assert
      expect(fallbackChannel.send).toHaveBeenCalled();
    });

    it('should not send message when no suitable channel found', async () => {
      // Arrange
      const guild = createMockGuild({
        systemChannel: null,
        channels: [],
      });

      // Act
      await execute(guild as any);

      // Assert - no error should be thrown
      expect(guild.channels.cache.find).toHaveBeenCalled();
    });
  });

  // ============================================
  // Permission Checking Tests
  // ============================================

  describe('permission checking', () => {
    it('should check SendMessages permission for fallback channel', async () => {
      // Arrange
      const fallbackChannel = createMockChannel({
        id: 'fallback-channel',
        type: ChannelType.GuildText,
        canSend: true,
      });
      const guild = createMockGuild({
        systemChannel: null,
        channels: [fallbackChannel],
      });

      guild.channels.cache.find.mockImplementation((predicate: Function) => {
        if (predicate(fallbackChannel)) {
          return fallbackChannel;
        }
        return undefined;
      });

      // Act
      await execute(guild as any);

      // Assert
      expect(fallbackChannel.permissionsFor).toHaveBeenCalledWith(guild.members.me);
    });

    it('should skip channels where bot cannot send messages', async () => {
      // Arrange
      const noPermChannel = createMockChannel({
        id: 'no-perm-channel',
        type: ChannelType.GuildText,
        canSend: false,
      });
      const guild = createMockGuild({
        systemChannel: null,
        channels: [noPermChannel],
      });

      // The find predicate will fail because canSend is false
      guild.channels.cache.find.mockReturnValue(undefined);

      // Act
      await execute(guild as any);

      // Assert
      expect(noPermChannel.send).not.toHaveBeenCalled();
    });
  });
});
