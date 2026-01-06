/**
 * messageReactionAdd.ts Event Handler Unit Tests
 *
 * Test Coverage:
 * - Bot reaction filtering
 * - Partial reaction handling
 * - Error handling for partial fetches
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Events } from 'discord.js';

// ============================================
// Mock Setup - Using vi.hoisted for persistence
// ============================================

const { mockLoggerError } = vi.hoisted(() => ({
  mockLoggerError: vi.fn(),
}));

// Mock logger
vi.mock('../../../src/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: mockLoggerError,
    debug: vi.fn(),
  },
}));

// ============================================
// Import after mocks are set up
// ============================================

import { name, once, execute } from '../../../src/events/messageReactionAdd.js';

// ============================================
// Test Helpers
// ============================================

function createMockReaction(options: {
  partial?: boolean;
  fetchSuccess?: boolean;
} = {}) {
  return {
    partial: options.partial ?? false,
    fetch: options.fetchSuccess !== false
      ? vi.fn().mockResolvedValue({})
      : vi.fn().mockRejectedValue(new Error('Failed to fetch')),
  };
}

function createMockUser(options: {
  isBot?: boolean;
} = {}) {
  return {
    bot: options.isBot ?? false,
    id: 'user-123',
    tag: 'TestUser#1234',
  };
}

function createMockServices() {
  return {
    localizationManager: {},
    settingsManager: {},
    ticketManager: {},
    helpService: {},
    forumService: {},
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

describe('messageReactionAdd event', () => {
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
      expect(name).toBe(Events.MessageReactionAdd);
    });

    it('should not be a one-time event', () => {
      expect(once).toBe(false);
    });
  });

  // ============================================
  // Bot Filtering Tests
  // ============================================

  describe('bot filtering', () => {
    it('should return early for bot reactions', async () => {
      // Arrange
      const reaction = createMockReaction();
      const user = createMockUser({ isBot: true });
      const client = {};
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await execute(reaction as any, user as any, client as any, services as any, databases as any);

      // Assert
      expect(reaction.fetch).not.toHaveBeenCalled();
    });

    it('should process non-bot reactions', async () => {
      // Arrange
      const reaction = createMockReaction({ partial: true });
      const user = createMockUser({ isBot: false });
      const client = {};
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await execute(reaction as any, user as any, client as any, services as any, databases as any);

      // Assert
      expect(reaction.fetch).toHaveBeenCalled();
    });
  });

  // ============================================
  // Partial Reaction Handling Tests
  // ============================================

  describe('partial reaction handling', () => {
    it('should fetch partial reaction data', async () => {
      // Arrange
      const reaction = createMockReaction({ partial: true });
      const user = createMockUser();
      const client = {};
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await execute(reaction as any, user as any, client as any, services as any, databases as any);

      // Assert
      expect(reaction.fetch).toHaveBeenCalled();
    });

    it('should not fetch non-partial reaction data', async () => {
      // Arrange
      const reaction = createMockReaction({ partial: false });
      const user = createMockUser();
      const client = {};
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await execute(reaction as any, user as any, client as any, services as any, databases as any);

      // Assert
      expect(reaction.fetch).not.toHaveBeenCalled();
    });

    it('should log error and return when partial fetch fails', async () => {
      // Arrange
      const reaction = createMockReaction({ partial: true, fetchSuccess: false });
      const user = createMockUser();
      const client = {};
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await execute(reaction as any, user as any, client as any, services as any, databases as any);

      // Assert
      expect(mockLoggerError).toHaveBeenCalledWith(
        'Something went wrong when fetching the message:',
        expect.any(Error)
      );
    });
  });
});
