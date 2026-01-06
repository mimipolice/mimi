/**
 * storyForumCommandHandler.ts Unit Tests
 *
 * Test Coverage:
 * - Non-thread channel filtering
 * - Command prefix filtering (?pin, ?unpin)
 * - Thread validation status checking
 * - Permission checking (author, authorized user)
 * - Message reference validation
 * - Pin/unpin operations
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================
// Mock Setup - Using vi.hoisted for persistence
// ============================================

const {
  mockLoggerError,
  mockGetThreadInfo,
  mockHasPermission,
} = vi.hoisted(() => ({
  mockLoggerError: vi.fn(),
  mockGetThreadInfo: vi.fn(),
  mockHasPermission: vi.fn(),
}));

// Mock logger
vi.mock('../../../../src/utils/logger.js', () => ({
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

import { handleStoryForumCommand } from '../../../../src/events/handlers/storyForumCommandHandler.js';

// ============================================
// Test Helpers
// ============================================

function createMockServices() {
  return {
    localizationManager: {},
    settingsManager: {},
    ticketManager: {},
    helpService: {},
    forumService: {},
    cacheService: {},
    storyForumService: {
      getThreadInfo: mockGetThreadInfo,
      hasPermission: mockHasPermission,
    },
  };
}

function createMockMessage(options: {
  isThread?: boolean;
  content?: string;
  authorId?: string;
  hasReference?: boolean;
  referenceMessageId?: string;
} = {}) {
  const mockPin = vi.fn().mockResolvedValue(undefined);
  const mockUnpin = vi.fn().mockResolvedValue(undefined);
  const mockFetch = vi.fn().mockResolvedValue({
    id: options.referenceMessageId ?? 'target-message-123',
    pin: mockPin,
    unpin: mockUnpin,
  });

  return {
    channel: {
      id: 'thread-123',
      isThread: vi.fn().mockReturnValue(options.isThread ?? true),
      messages: {
        fetch: mockFetch,
      },
    },
    content: options.content ?? '?pin',
    author: {
      id: options.authorId ?? 'author-123',
    },
    reference: options.hasReference !== false
      ? { messageId: options.referenceMessageId ?? 'target-message-123' }
      : null,
    reply: vi.fn().mockResolvedValue(undefined),
    _mockPin: mockPin,
    _mockUnpin: mockUnpin,
    _mockFetch: mockFetch,
  };
}

describe('storyForumCommandHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetThreadInfo.mockResolvedValue(null);
    mockHasPermission.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================
  // Channel Type Filtering Tests
  // ============================================

  describe('channel type filtering', () => {
    it('should return false for non-thread channels', async () => {
      // Arrange
      const message = createMockMessage({ isThread: false });
      const services = createMockServices();

      // Act
      const result = await handleStoryForumCommand(message as any, services as any);

      // Assert
      expect(result).toBe(false);
      expect(mockGetThreadInfo).not.toHaveBeenCalled();
    });

    it('should continue processing for thread channels', async () => {
      // Arrange
      mockGetThreadInfo.mockResolvedValue({ status: 'validated' });
      const message = createMockMessage({ isThread: true, content: '?pin' });
      const services = createMockServices();

      // Act
      const result = await handleStoryForumCommand(message as any, services as any);

      // Assert
      expect(result).toBe(true);
    });
  });

  // ============================================
  // Command Prefix Filtering Tests
  // ============================================

  describe('command prefix filtering', () => {
    it('should return false for non-pin commands', async () => {
      // Arrange
      const message = createMockMessage({ content: '?help' });
      const services = createMockServices();

      // Act
      const result = await handleStoryForumCommand(message as any, services as any);

      // Assert
      expect(result).toBe(false);
    });

    it('should handle ?pin command', async () => {
      // Arrange
      mockGetThreadInfo.mockResolvedValue({ status: 'validated' });
      const message = createMockMessage({ content: '?pin' });
      const services = createMockServices();

      // Act
      const result = await handleStoryForumCommand(message as any, services as any);

      // Assert
      expect(result).toBe(true);
    });

    it('should handle ?unpin command', async () => {
      // Arrange
      mockGetThreadInfo.mockResolvedValue({ status: 'validated' });
      const message = createMockMessage({ content: '?unpin' });
      const services = createMockServices();

      // Act
      const result = await handleStoryForumCommand(message as any, services as any);

      // Assert
      expect(result).toBe(true);
    });

    it('should be case-insensitive', async () => {
      // Arrange
      mockGetThreadInfo.mockResolvedValue({ status: 'validated' });
      const message = createMockMessage({ content: '?PIN' });
      const services = createMockServices();

      // Act
      const result = await handleStoryForumCommand(message as any, services as any);

      // Assert
      expect(result).toBe(true);
    });
  });

  // ============================================
  // Thread Validation Tests
  // ============================================

  describe('thread validation status checking', () => {
    it('should return false when thread info is null', async () => {
      // Arrange
      mockGetThreadInfo.mockResolvedValue(null);
      const message = createMockMessage({ content: '?pin' });
      const services = createMockServices();

      // Act
      const result = await handleStoryForumCommand(message as any, services as any);

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when thread status is not validated', async () => {
      // Arrange
      mockGetThreadInfo.mockResolvedValue({ status: 'pending' });
      const message = createMockMessage({ content: '?pin' });
      const services = createMockServices();

      // Act
      const result = await handleStoryForumCommand(message as any, services as any);

      // Assert
      expect(result).toBe(false);
    });

    it('should continue when thread status is validated', async () => {
      // Arrange
      mockGetThreadInfo.mockResolvedValue({ status: 'validated' });
      const message = createMockMessage({ content: '?pin' });
      const services = createMockServices();

      // Act
      const result = await handleStoryForumCommand(message as any, services as any);

      // Assert
      expect(result).toBe(true);
    });
  });

  // ============================================
  // Permission Checking Tests
  // ============================================

  describe('permission checking', () => {
    it('should check permission for the message author', async () => {
      // Arrange
      mockGetThreadInfo.mockResolvedValue({ status: 'validated' });
      mockHasPermission.mockResolvedValue(true);
      const message = createMockMessage({
        content: '?pin',
        authorId: 'author-123',
      });
      const services = createMockServices();

      // Act
      await handleStoryForumCommand(message as any, services as any);

      // Assert
      expect(mockHasPermission).toHaveBeenCalledWith('thread-123', 'author-123');
    });

    it('should reply with error when user lacks permission', async () => {
      // Arrange
      mockGetThreadInfo.mockResolvedValue({ status: 'validated' });
      mockHasPermission.mockResolvedValue(false);
      const message = createMockMessage({ content: '?pin' });
      const services = createMockServices();

      // Act
      const result = await handleStoryForumCommand(message as any, services as any);

      // Assert
      expect(result).toBe(true);
      // Response is in Chinese: "only author or authorized users can use this command"
      expect(message.reply).toHaveBeenCalled();
    });

    it('should continue when user has permission', async () => {
      // Arrange
      mockGetThreadInfo.mockResolvedValue({ status: 'validated' });
      mockHasPermission.mockResolvedValue(true);
      const message = createMockMessage({ content: '?pin' });
      const services = createMockServices();

      // Act
      const result = await handleStoryForumCommand(message as any, services as any);

      // Assert
      expect(result).toBe(true);
      expect(message._mockPin).toHaveBeenCalled();
    });
  });

  // ============================================
  // Message Reference Validation Tests
  // ============================================

  describe('message reference validation', () => {
    it('should reply with error when no message reference', async () => {
      // Arrange
      mockGetThreadInfo.mockResolvedValue({ status: 'validated' });
      mockHasPermission.mockResolvedValue(true);
      const message = createMockMessage({
        content: '?pin',
        hasReference: false,
      });
      message.reference = null;
      const services = createMockServices();

      // Act
      const result = await handleStoryForumCommand(message as any, services as any);

      // Assert
      expect(result).toBe(true);
      // Response is in Chinese: "please reply to the message you want to operate"
      expect(message.reply).toHaveBeenCalled();
    });

    it('should fetch target message when reference exists', async () => {
      // Arrange
      mockGetThreadInfo.mockResolvedValue({ status: 'validated' });
      mockHasPermission.mockResolvedValue(true);
      const message = createMockMessage({
        content: '?pin',
        hasReference: true,
        referenceMessageId: 'target-123',
      });
      const services = createMockServices();

      // Act
      await handleStoryForumCommand(message as any, services as any);

      // Assert
      expect(message._mockFetch).toHaveBeenCalledWith('target-123');
    });
  });

  // ============================================
  // Pin Operation Tests
  // ============================================

  describe('pin operations', () => {
    it('should pin target message for ?pin command', async () => {
      // Arrange
      mockGetThreadInfo.mockResolvedValue({ status: 'validated' });
      mockHasPermission.mockResolvedValue(true);
      const message = createMockMessage({ content: '?pin' });
      const services = createMockServices();

      // Act
      await handleStoryForumCommand(message as any, services as any);

      // Assert
      expect(message._mockPin).toHaveBeenCalled();
      // Response is in Chinese with checkmark emoji
      expect(message.reply).toHaveBeenCalled();
    });

    it('should unpin target message for ?unpin command', async () => {
      // Arrange
      mockGetThreadInfo.mockResolvedValue({ status: 'validated' });
      mockHasPermission.mockResolvedValue(true);
      const message = createMockMessage({ content: '?unpin' });
      const services = createMockServices();

      // Act
      await handleStoryForumCommand(message as any, services as any);

      // Assert
      expect(message._mockUnpin).toHaveBeenCalled();
      // Response is in Chinese with checkmark emoji
      expect(message.reply).toHaveBeenCalled();
    });
  });

  // ============================================
  // Error Handling Tests
  // ============================================

  describe('error handling', () => {
    it('should log error and reply when operation fails', async () => {
      // Arrange
      mockGetThreadInfo.mockResolvedValue({ status: 'validated' });
      mockHasPermission.mockResolvedValue(true);
      const error = new Error('Pin failed');
      const message = createMockMessage({ content: '?pin' });
      message._mockPin.mockRejectedValueOnce(error);
      const services = createMockServices();

      // Act
      const result = await handleStoryForumCommand(message as any, services as any);

      // Assert
      expect(result).toBe(true);
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to handle command'),
        expect.any(Error)
      );
      // Response is in Chinese with error emoji
      expect(message.reply).toHaveBeenCalled();
    });

    it('should return true even when error occurs', async () => {
      // Arrange
      mockGetThreadInfo.mockRejectedValue(new Error('Service error'));
      const message = createMockMessage({ content: '?pin' });
      const services = createMockServices();

      // Act
      const result = await handleStoryForumCommand(message as any, services as any);

      // Assert
      expect(result).toBe(true);
    });
  });
});
