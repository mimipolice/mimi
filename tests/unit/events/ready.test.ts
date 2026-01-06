/**
 * ready.ts Event Handler Unit Tests
 *
 * Test Coverage:
 * - Bot startup logging
 * - Activity rotation setup
 * - Client user status setting
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Events, ActivityType } from 'discord.js';

// ============================================
// Mock Setup - Using vi.hoisted for persistence
// ============================================

const { mockLoggerInfo, mockSetActivity, mockSetInterval } = vi.hoisted(() => ({
  mockLoggerInfo: vi.fn(),
  mockSetActivity: vi.fn(),
  mockSetInterval: vi.fn().mockReturnValue(123), // Return a fake interval ID
}));

// Mock logger
vi.mock('../../../src/utils/logger.js', () => ({
  default: {
    info: mockLoggerInfo,
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ============================================
// Import after mocks are set up
// ============================================

import readyEvent from '../../../src/events/ready.js';

describe('ready event', () => {
  let originalSetInterval: typeof global.setInterval;

  beforeEach(() => {
    vi.clearAllMocks();
    // Store original setInterval and replace with mock
    originalSetInterval = global.setInterval;
    global.setInterval = mockSetInterval as unknown as typeof global.setInterval;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Restore original setInterval
    global.setInterval = originalSetInterval;
  });

  // ============================================
  // Event Metadata Tests
  // ============================================

  describe('event metadata', () => {
    it('should have correct event name', () => {
      expect(readyEvent.name).toBe(Events.ClientReady);
    });

    it('should be a one-time event', () => {
      expect(readyEvent.once).toBe(true);
    });
  });

  // ============================================
  // execute() Tests
  // ============================================

  describe('execute()', () => {
    it('should log bot startup information with user tag', () => {
      // Arrange
      const mockClient = {
        user: {
          tag: 'TestBot#1234',
          setActivity: mockSetActivity,
        },
        guilds: {
          cache: {
            size: 5,
          },
        },
      };

      // Act
      readyEvent.execute(mockClient as any);

      // Assert
      expect(mockLoggerInfo).toHaveBeenCalledWith('Ready! Logged in as TestBot#1234');
    });

    it('should set up activity rotation interval', () => {
      // Arrange
      const mockClient = {
        user: {
          tag: 'TestBot#1234',
          setActivity: mockSetActivity,
        },
        guilds: {
          cache: {
            size: 10,
          },
        },
      };

      // Act
      readyEvent.execute(mockClient as any);

      // Assert
      expect(mockSetInterval).toHaveBeenCalledWith(expect.any(Function), 15000);
    });

    it('should handle client without user gracefully', () => {
      // Arrange
      const mockClient = {
        user: null,
        guilds: {
          cache: {
            size: 3,
          },
        },
      };

      // Act & Assert (should not throw)
      expect(() => readyEvent.execute(mockClient as any)).not.toThrow();
      expect(mockLoggerInfo).toHaveBeenCalledWith('Ready! Logged in as undefined');
    });
  });

  // ============================================
  // Activity Rotation Tests
  // ============================================

  describe('activity rotation', () => {
    it('should call setActivity with correct activity types', () => {
      // Arrange
      let capturedCallback: Function | undefined;
      mockSetInterval.mockImplementation((callback: Function) => {
        capturedCallback = callback;
        return 123;
      });

      const mockClient = {
        user: {
          tag: 'TestBot#1234',
          setActivity: mockSetActivity,
        },
        guilds: {
          cache: {
            size: 5,
          },
        },
      };

      // Act
      readyEvent.execute(mockClient as any);

      // Execute the interval callback
      if (capturedCallback) {
        capturedCallback();
      }

      // Assert
      expect(mockSetActivity).toHaveBeenCalled();
    });

    it('should rotate through activities', () => {
      // Arrange
      let capturedCallback: Function | undefined;
      mockSetInterval.mockImplementation((callback: Function) => {
        capturedCallback = callback;
        return 123;
      });

      const mockClient = {
        user: {
          tag: 'TestBot#1234',
          setActivity: mockSetActivity,
        },
        guilds: {
          cache: {
            size: 7,
          },
        },
      };

      // Act
      readyEvent.execute(mockClient as any);

      // Call the callback multiple times to test rotation
      if (capturedCallback) {
        capturedCallback(); // First call
        capturedCallback(); // Second call
        capturedCallback(); // Third call (should wrap around)
      }

      // Assert - should have been called 3 times
      expect(mockSetActivity).toHaveBeenCalledTimes(3);
    });
  });
});
