/**
 * threadCreate.ts Event Handler Unit Tests
 *
 * Test Coverage:
 * - Guild filtering (dev server only)
 * - Forum channel type filtering
 * - Story forum registration
 * - Subscription entry prompt
 * - Forum autotag logic
 * - Starter message pinning
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Events, ChannelType } from 'discord.js';

// ============================================
// Mock Setup - Using vi.hoisted for persistence
// ============================================

const {
  mockLoggerInfo,
  mockLoggerError,
  mockConfigGuildId,
  mockSettingsManagerGetSettings,
  mockStoryForumServiceRegisterThread,
  mockStoryForumServiceGetAuthorPreference,
  mockStoryForumServiceAskAboutSubscriptionEntry,
} = vi.hoisted(() => ({
  mockLoggerInfo: vi.fn(),
  mockLoggerError: vi.fn(),
  mockConfigGuildId: 'dev-guild-123',
  mockSettingsManagerGetSettings: vi.fn(),
  mockStoryForumServiceRegisterThread: vi.fn().mockResolvedValue(undefined),
  mockStoryForumServiceGetAuthorPreference: vi.fn().mockResolvedValue(false),
  mockStoryForumServiceAskAboutSubscriptionEntry: vi.fn().mockResolvedValue(undefined),
}));

// Mock config
vi.mock('../../../src/config.js', () => ({
  default: {
    discord: {
      guildId: mockConfigGuildId,
    },
  },
}));

// Mock logger
vi.mock('../../../src/utils/logger.js', () => ({
  default: {
    info: mockLoggerInfo,
    warn: vi.fn(),
    error: mockLoggerError,
    debug: vi.fn(),
  },
}));

// ============================================
// Import after mocks are set up
// ============================================

const threadCreateModule = await import('../../../src/events/threadCreate.js');
const threadCreateEvent = threadCreateModule.default ?? threadCreateModule;

// ============================================
// Test Helpers
// ============================================

function createMockServices() {
  return {
    localizationManager: {},
    settingsManager: {
      getSettings: mockSettingsManagerGetSettings,
    },
    ticketManager: {},
    helpService: {},
    forumService: {},
    cacheService: {},
    storyForumService: {
      registerThread: mockStoryForumServiceRegisterThread,
      getAuthorPreference: mockStoryForumServiceGetAuthorPreference,
      askAboutSubscriptionEntry: mockStoryForumServiceAskAboutSubscriptionEntry,
    },
  };
}

function createMockDatabases() {
  return {
    gachaDb: {},
    ticketDb: {},
  };
}

function createMockThread(options: {
  guildId?: string;
  parentType?: ChannelType;
  parentId?: string;
  ownerId?: string;
  appliedTags?: string[];
} = {}) {
  const parentId = options.parentId ?? 'forum-channel-123';

  return {
    id: 'thread-123',
    name: 'Test Thread',
    guild: {
      id: options.guildId ?? mockConfigGuildId,
      name: 'Test Guild',
    },
    parent: options.parentType === undefined
      ? { type: ChannelType.GuildForum }
      : options.parentType === null
        ? null
        : { type: options.parentType },
    parentId,
    ownerId: options.ownerId ?? 'owner-123',
    appliedTags: options.appliedTags ?? [],
    setAppliedTags: vi.fn().mockResolvedValue(undefined),
    fetchStarterMessage: vi.fn().mockResolvedValue({
      id: 'starter-message-123',
      pinned: false,
      pin: vi.fn().mockResolvedValue(undefined),
    }),
  };
}

describe('threadCreate event', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockSettingsManagerGetSettings.mockResolvedValue({
      story_forum_channels: [],
      forum_autotags: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // ============================================
  // Event Metadata Tests
  // ============================================

  describe('event metadata', () => {
    it('should have correct event name', () => {
      expect(threadCreateEvent.name).toBe(Events.ThreadCreate);
    });

    it('should not be a one-time event', () => {
      expect(threadCreateEvent.once).toBe(false);
    });
  });

  // ============================================
  // Guild Filtering Tests
  // ============================================

  describe('guild filtering', () => {
    it('should return early for non-dev guild', async () => {
      // Arrange
      const thread = createMockThread({ guildId: 'other-guild-456' });
      const newlyCreated = true;
      const client = {};
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await threadCreateEvent.execute(thread as any, newlyCreated, client as any, services as any, databases as any);

      // Assert
      expect(mockSettingsManagerGetSettings).not.toHaveBeenCalled();
      expect(thread.fetchStarterMessage).not.toHaveBeenCalled();
    });

    it('should process threads in dev guild', async () => {
      // Arrange
      const thread = createMockThread({ guildId: mockConfigGuildId });
      const newlyCreated = true;
      const client = {};
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await threadCreateEvent.execute(thread as any, newlyCreated, client as any, services as any, databases as any);

      // Advance timers for the setTimeout calls
      await vi.advanceTimersByTimeAsync(3000);

      // Assert
      expect(mockSettingsManagerGetSettings).toHaveBeenCalled();
    });
  });

  // ============================================
  // Forum Channel Type Filtering Tests
  // ============================================

  describe('forum channel type filtering', () => {
    it('should return early for non-forum parent channel', async () => {
      // Arrange
      const thread = createMockThread({ parentType: ChannelType.GuildText });
      const newlyCreated = true;
      const client = {};
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await threadCreateEvent.execute(thread as any, newlyCreated, client as any, services as any, databases as any);

      // Assert
      expect(mockSettingsManagerGetSettings).not.toHaveBeenCalled();
    });

    it('should process threads with forum parent channel', async () => {
      // Arrange
      const thread = createMockThread({ parentType: ChannelType.GuildForum });
      const newlyCreated = true;
      const client = {};
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await threadCreateEvent.execute(thread as any, newlyCreated, client as any, services as any, databases as any);

      // Advance timers
      await vi.advanceTimersByTimeAsync(3000);

      // Assert
      expect(mockSettingsManagerGetSettings).toHaveBeenCalled();
    });
  });

  // ============================================
  // Story Forum Registration Tests
  // ============================================

  describe('story forum registration', () => {
    it('should register thread when in story forum channel', async () => {
      // Arrange
      mockSettingsManagerGetSettings.mockResolvedValue({
        story_forum_channels: ['forum-channel-123'],
        forum_autotags: null,
      });
      const thread = createMockThread({
        parentId: 'forum-channel-123',
        ownerId: 'owner-123',
      });
      const newlyCreated = true;
      const client = {};
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await threadCreateEvent.execute(thread as any, newlyCreated, client as any, services as any, databases as any);

      // Advance timers
      await vi.advanceTimersByTimeAsync(3000);

      // Assert
      expect(mockStoryForumServiceRegisterThread).toHaveBeenCalledWith(thread);
    });

    it('should not register thread when not in story forum channel', async () => {
      // Arrange
      mockSettingsManagerGetSettings.mockResolvedValue({
        story_forum_channels: ['other-forum-channel'],
        forum_autotags: null,
      });
      const thread = createMockThread({ parentId: 'forum-channel-123' });
      const newlyCreated = true;
      const client = {};
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await threadCreateEvent.execute(thread as any, newlyCreated, client as any, services as any, databases as any);

      // Advance timers
      await vi.advanceTimersByTimeAsync(3000);

      // Assert
      expect(mockStoryForumServiceRegisterThread).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // Subscription Entry Prompt Tests
  // ============================================

  describe('subscription entry prompt', () => {
    it('should ask about subscription entry when author preference is true', async () => {
      // Arrange
      mockSettingsManagerGetSettings.mockResolvedValue({
        story_forum_channels: ['forum-channel-123'],
        forum_autotags: null,
      });
      mockStoryForumServiceGetAuthorPreference.mockResolvedValue(true);
      const thread = createMockThread({
        parentId: 'forum-channel-123',
        ownerId: 'owner-123',
      });
      const newlyCreated = true;
      const client = {};
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await threadCreateEvent.execute(thread as any, newlyCreated, client as any, services as any, databases as any);

      // Advance timers for both setTimeouts
      await vi.advanceTimersByTimeAsync(5000);

      // Assert
      expect(mockStoryForumServiceAskAboutSubscriptionEntry).toHaveBeenCalledWith(
        thread,
        'owner-123'
      );
    });

    it('should not ask about subscription entry when author preference is false', async () => {
      // Arrange
      mockSettingsManagerGetSettings.mockResolvedValue({
        story_forum_channels: ['forum-channel-123'],
        forum_autotags: null,
      });
      mockStoryForumServiceGetAuthorPreference.mockResolvedValue(false);
      const thread = createMockThread({ parentId: 'forum-channel-123' });
      const newlyCreated = true;
      const client = {};
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await threadCreateEvent.execute(thread as any, newlyCreated, client as any, services as any, databases as any);

      // Advance timers
      await vi.advanceTimersByTimeAsync(5000);

      // Assert
      expect(mockStoryForumServiceAskAboutSubscriptionEntry).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // Forum Autotag Tests
  // ============================================

  describe('forum autotag logic', () => {
    it('should apply autotag when configured', async () => {
      // Arrange
      mockSettingsManagerGetSettings.mockResolvedValue({
        story_forum_channels: [],
        forum_autotags: JSON.stringify({
          'forum-channel-123': 'tag-456',
        }),
      });
      const thread = createMockThread({
        parentId: 'forum-channel-123',
        appliedTags: ['existing-tag'],
      });
      const newlyCreated = true;
      const client = {};
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await threadCreateEvent.execute(thread as any, newlyCreated, client as any, services as any, databases as any);

      // Advance timers
      await vi.advanceTimersByTimeAsync(3000);

      // Assert
      expect(thread.setAppliedTags).toHaveBeenCalledWith(
        expect.arrayContaining(['existing-tag', 'tag-456'])
      );
    });

    it('should not duplicate existing tag', async () => {
      // Arrange
      mockSettingsManagerGetSettings.mockResolvedValue({
        story_forum_channels: [],
        forum_autotags: JSON.stringify({
          'forum-channel-123': 'tag-456',
        }),
      });
      const thread = createMockThread({
        parentId: 'forum-channel-123',
        appliedTags: ['tag-456'],
      });
      const newlyCreated = true;
      const client = {};
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await threadCreateEvent.execute(thread as any, newlyCreated, client as any, services as any, databases as any);

      // Advance timers
      await vi.advanceTimersByTimeAsync(3000);

      // Assert
      const callArgs = thread.setAppliedTags.mock.calls[0][0];
      const tagCount = callArgs.filter((t: string) => t === 'tag-456').length;
      expect(tagCount).toBe(1);
    });
  });

  // ============================================
  // Starter Message Pinning Tests
  // ============================================

  describe('starter message pinning', () => {
    it('should pin unpinned starter message', async () => {
      // Arrange
      mockSettingsManagerGetSettings.mockResolvedValue({
        story_forum_channels: [],
        forum_autotags: null,
      });
      const mockStarterMessage = {
        id: 'starter-123',
        pinned: false,
        pin: vi.fn().mockResolvedValue(undefined),
      };
      const thread = createMockThread();
      thread.fetchStarterMessage.mockResolvedValue(mockStarterMessage);
      const newlyCreated = true;
      const client = {};
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await threadCreateEvent.execute(thread as any, newlyCreated, client as any, services as any, databases as any);

      // Advance timers
      await vi.advanceTimersByTimeAsync(3000);

      // Assert
      expect(mockStarterMessage.pin).toHaveBeenCalled();
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        expect.stringContaining('Pinned starter message in thread')
      );
    });

    it('should not pin already pinned starter message', async () => {
      // Arrange
      mockSettingsManagerGetSettings.mockResolvedValue({
        story_forum_channels: [],
        forum_autotags: null,
      });
      const mockStarterMessage = {
        id: 'starter-123',
        pinned: true,
        pin: vi.fn(),
      };
      const thread = createMockThread();
      thread.fetchStarterMessage.mockResolvedValue(mockStarterMessage);
      const newlyCreated = true;
      const client = {};
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await threadCreateEvent.execute(thread as any, newlyCreated, client as any, services as any, databases as any);

      // Advance timers
      await vi.advanceTimersByTimeAsync(3000);

      // Assert
      expect(mockStarterMessage.pin).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // Error Handling Tests
  // ============================================

  describe('error handling', () => {
    it('should log error when thread registration fails', async () => {
      // Arrange
      mockSettingsManagerGetSettings.mockResolvedValue({
        story_forum_channels: ['forum-channel-123'],
        forum_autotags: null,
      });
      const error = new Error('Registration failed');
      mockStoryForumServiceRegisterThread.mockRejectedValueOnce(error);
      const thread = createMockThread({ parentId: 'forum-channel-123' });
      const newlyCreated = true;
      const client = {};
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await threadCreateEvent.execute(thread as any, newlyCreated, client as any, services as any, databases as any);

      // Advance timers
      await vi.advanceTimersByTimeAsync(3000);

      // Assert
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to register thread'),
        expect.any(Error)
      );
    });

    it('should log error when pinning starter message fails', async () => {
      // Arrange
      mockSettingsManagerGetSettings.mockResolvedValue({
        story_forum_channels: [],
        forum_autotags: null,
      });
      const thread = createMockThread();
      thread.fetchStarterMessage.mockRejectedValue(new Error('Fetch failed'));
      const newlyCreated = true;
      const client = {};
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await threadCreateEvent.execute(thread as any, newlyCreated, client as any, services as any, databases as any);

      // Advance timers
      await vi.advanceTimersByTimeAsync(3000);

      // Assert
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to pin starter message'),
        expect.any(Error)
      );
    });
  });
});
