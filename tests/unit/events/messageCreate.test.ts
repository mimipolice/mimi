/**
 * messageCreate.ts Event Handler Unit Tests
 *
 * Test Coverage:
 * - Early return conditions (bot, DM, system messages)
 * - Message command routing (?qs, ?qc, etc.)
 * - Story forum command handling
 * - Forum solve command handling
 * - Anti-spam processing
 * - Autoreact logic
 * - Keyword reply logic
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Events, ChannelType, TextChannel, NewsChannel, ThreadChannel } from 'discord.js';

// ============================================
// Mock Setup - Using vi.hoisted for persistence
// ============================================

const {
  mockLoggerDebug,
  mockLoggerWarn,
  mockLoggerError,
  mockGetKeywordsForGuild,
  mockGetAutoreactsForGuild,
  mockHandleAntiSpam,
  mockHandleStoryForumCommand,
  mockForumServiceHandleSolveCommand,
} = vi.hoisted(() => ({
  mockLoggerDebug: vi.fn(),
  mockLoggerWarn: vi.fn(),
  mockLoggerError: vi.fn(),
  mockGetKeywordsForGuild: vi.fn().mockResolvedValue([]),
  mockGetAutoreactsForGuild: vi.fn().mockResolvedValue([]),
  mockHandleAntiSpam: vi.fn().mockResolvedValue(undefined),
  mockHandleStoryForumCommand: vi.fn().mockResolvedValue(false),
  mockForumServiceHandleSolveCommand: vi.fn().mockResolvedValue(undefined),
}));

// Mock logger
vi.mock('../../../src/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: mockLoggerWarn,
    error: mockLoggerError,
    debug: mockLoggerDebug,
  },
}));

// Mock shared/cache
vi.mock('../../../src/shared/cache.js', () => ({
  getKeywordsForGuild: mockGetKeywordsForGuild,
  getAutoreactsForGuild: mockGetAutoreactsForGuild,
}));

// Mock anti-spam handler
vi.mock('../../../src/features/anti-spam/handler.js', () => ({
  handleAntiSpam: mockHandleAntiSpam,
}));

// Mock storyForumCommandHandler
vi.mock('../../../src/events/handlers/storyForumCommandHandler.js', () => ({
  handleStoryForumCommand: mockHandleStoryForumCommand,
}));

// Mock message commands (these are imported at module level)
// The paths should match the actual import paths in messageCreate.ts
vi.mock('../../../src/commands/admin/qs/index.js', () => ({
  default: { name: 'qs', aliases: [], execute: vi.fn() },
}));
vi.mock('../../../src/commands/public/qc/index.js', () => ({
  default: { name: 'qc', aliases: [], execute: vi.fn() },
}));
vi.mock('../../../src/commands/admin/unqs/index.js', () => ({
  default: { name: 'unqs', aliases: [], execute: vi.fn() },
}));
vi.mock('../../../src/commands/public/top/index.js', () => ({
  default: { name: 'top', aliases: [], execute: vi.fn() },
}));
vi.mock('../../../src/commands/admin/forum/index.js', () => ({
  default: { name: 'forum', aliases: [], execute: vi.fn() },
}));

// Mock database to prevent connection errors
vi.mock('../../../src/shared/database/index.js', () => ({
  gachaPool: {},
  gachaDB: {},
  mimiDLCPool: {},
  mimiDLCDb: {},
}));

// ============================================
// Import after mocks are set up
// ============================================

const messageCreateModule = await import('../../../src/events/messageCreate.js');
const messageCreateEvent = messageCreateModule.default ?? messageCreateModule;

// ============================================
// Test Helpers
// ============================================

function createMockServices() {
  return {
    localizationManager: {},
    settingsManager: {},
    ticketManager: {},
    helpService: {},
    forumService: {
      handleSolveCommand: mockForumServiceHandleSolveCommand,
    },
    cacheService: {},
    storyForumService: {},
  };
}

function createMockDatabases() {
  return {
    gachaDb: {},
    ticketDb: {},
  };
}

function createMockMessage(options: {
  isBot?: boolean;
  guildId?: string | null;
  isSystem?: boolean;
  content?: string;
  channelId?: string;
  channelType?: ChannelType;
  authorId?: string;
  authorTag?: string;
} = {}) {
  const channelId = options.channelId ?? 'channel-123';

  // Create a mock channel that passes instanceof TextChannel check
  const channel = Object.create(TextChannel.prototype, {
    id: { value: channelId, writable: true },
    type: { value: options.channelType ?? ChannelType.GuildText, writable: true },
  });

  return {
    author: {
      id: options.authorId ?? 'user-123',
      tag: options.authorTag ?? 'TestUser#1234',
      bot: options.isBot ?? false,
    },
    guild: options.guildId === null ? null : {
      id: options.guildId ?? 'guild-123',
    },
    system: options.isSystem ?? false,
    content: options.content ?? 'Hello world',
    channel,
    reply: vi.fn().mockResolvedValue(undefined),
    react: vi.fn().mockResolvedValue(undefined),
  };
}

describe('messageCreate event', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetKeywordsForGuild.mockResolvedValue([]);
    mockGetAutoreactsForGuild.mockResolvedValue([]);
    mockHandleStoryForumCommand.mockResolvedValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================
  // Event Metadata Tests
  // ============================================

  describe('event metadata', () => {
    it('should have correct event name', () => {
      expect(messageCreateEvent.name).toBe(Events.MessageCreate);
    });

    it('should not be a one-time event', () => {
      expect(messageCreateEvent.once).toBe(false);
    });
  });

  // ============================================
  // Early Return Condition Tests
  // ============================================

  describe('early return conditions', () => {
    it('should return early for bot messages', async () => {
      // Arrange
      const message = createMockMessage({ isBot: true });
      const client = {};
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await messageCreateEvent.execute(message as any, client as any, services as any, databases as any);

      // Assert
      expect(mockGetKeywordsForGuild).not.toHaveBeenCalled();
      expect(mockHandleAntiSpam).not.toHaveBeenCalled();
    });

    it('should return early for DM messages', async () => {
      // Arrange
      const message = createMockMessage({ guildId: null });
      const client = {};
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await messageCreateEvent.execute(message as any, client as any, services as any, databases as any);

      // Assert
      expect(mockGetKeywordsForGuild).not.toHaveBeenCalled();
    });

    it('should return early for system messages', async () => {
      // Arrange
      const message = createMockMessage({ isSystem: true });
      const client = {};
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await messageCreateEvent.execute(message as any, client as any, services as any, databases as any);

      // Assert
      expect(mockGetKeywordsForGuild).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // Story Forum Command Tests
  // ============================================

  describe('story forum command handling', () => {
    it('should call handleStoryForumCommand for all messages', async () => {
      // Arrange
      const message = createMockMessage({ content: '?pin' });
      const client = {};
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await messageCreateEvent.execute(message as any, client as any, services as any, databases as any);

      // Assert
      expect(mockHandleStoryForumCommand).toHaveBeenCalledWith(message, services);
    });

    it('should stop processing if story forum command was handled', async () => {
      // Arrange
      mockHandleStoryForumCommand.mockResolvedValue(true);
      const message = createMockMessage({ content: '?pin' });
      const client = {};
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await messageCreateEvent.execute(message as any, client as any, services as any, databases as any);

      // Assert
      expect(mockForumServiceHandleSolveCommand).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // Forum Solve Command Tests
  // ============================================

  describe('forum solve command handling', () => {
    it('should call forumService.handleSolveCommand', async () => {
      // Arrange
      const message = createMockMessage({ content: '?solved' });
      const client = {};
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await messageCreateEvent.execute(message as any, client as any, services as any, databases as any);

      // Assert
      expect(mockForumServiceHandleSolveCommand).toHaveBeenCalledWith(message);
    });
  });

  // ============================================
  // Anti-Spam Tests
  // ============================================

  describe('anti-spam handling', () => {
    it('should call handleAntiSpam for all messages', async () => {
      // Arrange
      const message = createMockMessage();
      const client = {};
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await messageCreateEvent.execute(message as any, client as any, services as any, databases as any);

      // Assert
      expect(mockHandleAntiSpam).toHaveBeenCalledWith(message);
    });

    it('should log error when anti-spam throws', async () => {
      // Arrange
      const error = new Error('Anti-spam error');
      mockHandleAntiSpam.mockRejectedValueOnce(error);
      const message = createMockMessage();
      const client = {};
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await messageCreateEvent.execute(message as any, client as any, services as any, databases as any);

      // Assert
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining('Error in handleAntiSpam'),
        expect.any(Error)
      );
    });
  });

  // ============================================
  // Autoreact Tests
  // ============================================

  describe('autoreact logic', () => {
    it('should add reaction when channel matches autoreact config', async () => {
      // Arrange
      mockGetAutoreactsForGuild.mockResolvedValue([
        { channel_id: 'channel-123', emoji: '123' },
      ]);
      const message = createMockMessage({ channelId: 'channel-123' });
      const client = {};
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await messageCreateEvent.execute(message as any, client as any, services as any, databases as any);

      // Assert
      expect(message.react).toHaveBeenCalledWith('123');
    });

    it('should not add reaction when channel does not match', async () => {
      // Arrange
      mockGetAutoreactsForGuild.mockResolvedValue([
        { channel_id: 'other-channel', emoji: '123' },
      ]);
      const message = createMockMessage({ channelId: 'channel-123' });
      const client = {};
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await messageCreateEvent.execute(message as any, client as any, services as any, databases as any);

      // Assert
      expect(message.react).not.toHaveBeenCalled();
    });

    it('should log warning for invalid emoji', async () => {
      // Arrange
      mockGetAutoreactsForGuild.mockResolvedValue([
        { channel_id: 'channel-123', emoji: 'invalid_emoji' },
      ]);
      const message = createMockMessage({ channelId: 'channel-123' });
      message.react.mockRejectedValue({ code: 10014 });
      const client = {};
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await messageCreateEvent.execute(message as any, client as any, services as any, databases as any);

      // Assert
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid emoji in autoreact')
      );
    });

    it('should log error for other react errors', async () => {
      // Arrange
      mockGetAutoreactsForGuild.mockResolvedValue([
        { channel_id: 'channel-123', emoji: '123' },
      ]);
      const message = createMockMessage({ channelId: 'channel-123' });
      message.react.mockRejectedValue({ code: 50001 });
      const client = {};
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await messageCreateEvent.execute(message as any, client as any, services as any, databases as any);

      // Assert
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining('Error adding autoreact'),
        expect.anything()
      );
    });
  });

  // ============================================
  // Keyword Reply Tests
  // ============================================

  describe('keyword reply logic', () => {
    it('should reply when exact match keyword is found', async () => {
      // Arrange
      mockGetKeywordsForGuild.mockResolvedValue([
        { keyword: 'hello', match_type: 'exact', reply: 'Hi there!' },
      ]);
      const message = createMockMessage({ content: 'hello' });
      const client = {};
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await messageCreateEvent.execute(message as any, client as any, services as any, databases as any);

      // Assert
      expect(message.reply).toHaveBeenCalledWith('Hi there!');
    });

    it('should not reply when exact match does not match exactly', async () => {
      // Arrange
      mockGetKeywordsForGuild.mockResolvedValue([
        { keyword: 'hello', match_type: 'exact', reply: 'Hi there!' },
      ]);
      const message = createMockMessage({ content: 'hello world' });
      const client = {};
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await messageCreateEvent.execute(message as any, client as any, services as any, databases as any);

      // Assert
      expect(message.reply).not.toHaveBeenCalled();
    });

    it('should reply when contains match keyword is found', async () => {
      // Arrange
      mockGetKeywordsForGuild.mockResolvedValue([
        { keyword: 'help', match_type: 'contains', reply: 'How can I help?' },
      ]);
      const message = createMockMessage({ content: 'I need help please' });
      const client = {};
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await messageCreateEvent.execute(message as any, client as any, services as any, databases as any);

      // Assert
      expect(message.reply).toHaveBeenCalledWith('How can I help?');
    });

    it('should not reply when contains match is not found', async () => {
      // Arrange
      mockGetKeywordsForGuild.mockResolvedValue([
        { keyword: 'help', match_type: 'contains', reply: 'How can I help?' },
      ]);
      const message = createMockMessage({ content: 'Hello world' });
      const client = {};
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await messageCreateEvent.execute(message as any, client as any, services as any, databases as any);

      // Assert
      expect(message.reply).not.toHaveBeenCalled();
    });

    it('should return early after first keyword match', async () => {
      // Arrange
      mockGetKeywordsForGuild.mockResolvedValue([
        { keyword: 'hello', match_type: 'exact', reply: 'First reply' },
        { keyword: 'hello', match_type: 'exact', reply: 'Second reply' },
      ]);
      const message = createMockMessage({ content: 'hello' });
      const client = {};
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await messageCreateEvent.execute(message as any, client as any, services as any, databases as any);

      // Assert
      expect(message.reply).toHaveBeenCalledTimes(1);
      expect(message.reply).toHaveBeenCalledWith('First reply');
    });

    it('should not process keywords when list is empty', async () => {
      // Arrange
      mockGetKeywordsForGuild.mockResolvedValue([]);
      const message = createMockMessage({ content: 'hello' });
      const client = {};
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await messageCreateEvent.execute(message as any, client as any, services as any, databases as any);

      // Assert
      expect(message.reply).not.toHaveBeenCalled();
    });
  });
});
