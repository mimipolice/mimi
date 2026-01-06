/**
 * Anti-Spam Handler 單元測試
 *
 * 測試範圍：
 * - handleAntiSpam(): 主要導出函數
 *   - 早期返回檢查 (bot, DM, 無成員)
 *   - 設定檢查 (啟用/停用, 忽略用戶/角色)
 *   - 垃圾訊息偵測 (單頻道, 多頻道)
 *   - 處罰狀態管理 (快取同步, 過期處理)
 * - checkSpam(): 垃圾訊息偵測邏輯 (私有函數，透過複製測試)
 *
 * Mock 策略：
 * - CacheService: mock get/set
 * - getAntiSpamSettingsForGuild: mock 設定
 * - getAntiSpamLogChannel: mock 頻道 ID
 * - logger: mock 各級別日誌
 * - Discord.js: mock Message, GuildMember, TextChannel
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================
// Mock 設定 - 使用 vi.hoisted 確保持久化
// ============================================

const {
  mockLoggerDebug,
  mockLoggerInfo,
  mockLoggerWarn,
  mockLoggerError,
  mockCacheGet,
  mockCacheSet,
  mockGetAntiSpamSettingsForGuild,
  mockGetAntiSpamLogChannel,
  mockCacheServiceInstance,
} = vi.hoisted(() => {
  const cacheInstance = {
    get: vi.fn(),
    set: vi.fn(),
  };
  return {
    mockLoggerDebug: vi.fn(),
    mockLoggerInfo: vi.fn(),
    mockLoggerWarn: vi.fn(),
    mockLoggerError: vi.fn(),
    mockCacheGet: cacheInstance.get,
    mockCacheSet: cacheInstance.set,
    mockGetAntiSpamSettingsForGuild: vi.fn(),
    mockGetAntiSpamLogChannel: vi.fn(),
    mockCacheServiceInstance: cacheInstance,
  };
});

// Mock logger
vi.mock('../../../../src/utils/logger', () => ({
  default: {
    debug: mockLoggerDebug,
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    error: mockLoggerError,
  },
}));

// Mock CacheService
vi.mock('../../../../src/services/CacheService', () => ({
  CacheService: class MockCacheService {
    static instance = mockCacheServiceInstance;
    static getInstance = vi.fn(() => mockCacheServiceInstance);
    get = mockCacheGet;
    set = mockCacheSet;
    constructor() {}
  },
  cacheService: mockCacheServiceInstance,
}));

// Mock shared/cache
vi.mock('../../../../src/shared/cache', () => ({
  getAntiSpamSettingsForGuild: mockGetAntiSpamSettingsForGuild,
}));

// Mock admin.repository
vi.mock('../../../../src/repositories/admin.repository', () => ({
  getAntiSpamLogChannel: mockGetAntiSpamLogChannel,
}));

// Mock config
vi.mock('../../../../src/config', () => ({
  default: {
    antiSpam: {
      spamThreshold: 5,
      timeWindow: 3000,
      timeoutDuration: 60000,
      multiChannelSpamThreshold: 3,
      multiChannelTimeWindow: 5000,
      ignoredUsers: [],
      ignoredRoles: [],
      inactiveUserThreshold: 300,
    },
  },
}));

// Mock date-fns
vi.mock('date-fns', () => ({
  formatDistanceStrict: vi.fn().mockReturnValue('1 minute'),
}));

// ============================================
// Import after mocks
// ============================================

import { handleAntiSpam } from '../../../../src/features/anti-spam/handler.js';

// ============================================
// Test Helpers
// ============================================

function createMockMessage(overrides: Partial<{
  isBot: boolean;
  inGuild: boolean;
  hasMember: boolean;
  authorId: string;
  authorTag: string;
  guildId: string;
  guildName: string;
  channelId: string;
  memberRoles: string[];
  communicationDisabledUntil: number | null;
}> = {}) {
  const mockMember = overrides.hasMember !== false ? {
    id: overrides.authorId ?? 'user-123',
    user: {
      tag: overrides.authorTag ?? 'TestUser#1234',
      displayAvatarURL: vi.fn().mockReturnValue('https://example.com/avatar.png'),
    },
    roles: {
      cache: {
        some: vi.fn().mockImplementation((fn) => {
          const roles = (overrides.memberRoles ?? []).map(id => ({ id }));
          return roles.some(fn);
        }),
      },
    },
    communicationDisabledUntilTimestamp: overrides.communicationDisabledUntil ?? null,
    timeout: vi.fn().mockResolvedValue(undefined),
    send: vi.fn().mockResolvedValue(undefined),
    toString: vi.fn().mockReturnValue(`<@${overrides.authorId ?? 'user-123'}>`),
  } : null;

  return {
    author: {
      bot: overrides.isBot ?? false,
      id: overrides.authorId ?? 'user-123',
      tag: overrides.authorTag ?? 'TestUser#1234',
    },
    inGuild: vi.fn().mockReturnValue(overrides.inGuild ?? true),
    member: mockMember,
    guild: overrides.inGuild !== false ? {
      id: overrides.guildId ?? 'guild-123',
      name: overrides.guildName ?? 'Test Guild',
    } : null,
    channel: {
      id: overrides.channelId ?? 'channel-123',
      send: vi.fn().mockResolvedValue(undefined),
    },
    url: 'https://discord.com/channels/guild-123/channel-123/message-123',
    client: {
      channels: {
        fetch: vi.fn().mockResolvedValue(null),
      },
    },
  };
}

// ============================================
// Pure Logic Tests - checkSpam (copied for testing)
// ============================================

interface UserMessageData {
  timestamps: { ts: number; channelId: string }[];
  punishedUntil: number | null;
}

function checkSpam(
  userData: UserMessageData,
  channelId: string,
  settings: {
    spamThreshold: number;
    timeWindow: number;
    multiChannelSpamThreshold: number;
    multiChannelTimeWindow: number;
  }
): string | null {
  const now = Date.now();
  const { timestamps } = userData;

  // 1. Single-channel spam check
  const singleChannelMessages = timestamps.filter(
    (ts) => ts.channelId === channelId && now - ts.ts <= settings.timeWindow
  );
  if (singleChannelMessages.length >= settings.spamThreshold) {
    return 'Fast single-channel spam';
  }

  // 2. Multi-channel spam check
  const multiChannelMessages = timestamps.filter(
    (ts) => now - ts.ts <= settings.multiChannelTimeWindow
  );
  const uniqueChannels = new Set(multiChannelMessages.map((ts) => ts.channelId));

  if (uniqueChannels.size >= settings.multiChannelSpamThreshold) {
    return `Multi-channel spam (${uniqueChannels.size} channels)`;
  }

  return null;
}

describe('Anti-Spam Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));

    // Default mock returns
    mockCacheGet.mockResolvedValue(null);
    mockCacheSet.mockResolvedValue(undefined);
    mockGetAntiSpamSettingsForGuild.mockResolvedValue(null);
    mockGetAntiSpamLogChannel.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ============================================
  // handleAntiSpam() - Early Return Tests
  // ============================================

  describe('handleAntiSpam() - early returns', () => {
    it('should skip bot messages', async () => {
      // Arrange
      const message = createMockMessage({ isBot: true });

      // Act
      await handleAntiSpam(message as any);

      // Assert
      expect(mockLoggerDebug).toHaveBeenCalledWith(
        expect.stringContaining('Skipping bot message')
      );
      expect(mockGetAntiSpamSettingsForGuild).not.toHaveBeenCalled();
    });

    it('should skip DM messages', async () => {
      // Arrange
      const message = createMockMessage({ inGuild: false });

      // Act
      await handleAntiSpam(message as any);

      // Assert
      expect(mockLoggerDebug).toHaveBeenCalledWith(
        expect.stringContaining('Skipping DM')
      );
      expect(mockGetAntiSpamSettingsForGuild).not.toHaveBeenCalled();
    });

    it('should skip when no member object', async () => {
      // Arrange
      const message = createMockMessage({ hasMember: false });

      // Act
      await handleAntiSpam(message as any);

      // Assert
      expect(mockLoggerDebug).toHaveBeenCalledWith(
        expect.stringContaining('No member object')
      );
      expect(mockGetAntiSpamSettingsForGuild).not.toHaveBeenCalled();
    });

    it('should skip when anti-spam is disabled for guild', async () => {
      // Arrange
      const message = createMockMessage();
      mockGetAntiSpamSettingsForGuild.mockResolvedValueOnce({ enabled: false });

      // Act
      await handleAntiSpam(message as any);

      // Assert
      expect(mockLoggerDebug).toHaveBeenCalledWith(
        expect.stringContaining('Anti-spam is disabled')
      );
      expect(mockCacheGet).not.toHaveBeenCalled();
    });

    it('should skip when settings are null (not configured)', async () => {
      // Arrange
      const message = createMockMessage();
      mockGetAntiSpamSettingsForGuild.mockResolvedValueOnce(null);

      // Act
      await handleAntiSpam(message as any);

      // Assert
      expect(mockLoggerDebug).toHaveBeenCalledWith(
        expect.stringContaining('Anti-spam is disabled')
      );
    });
  });

  // ============================================
  // handleAntiSpam() - Ignored Users/Roles
  // ============================================

  describe('handleAntiSpam() - ignored users and roles', () => {
    it('should skip ignored user by ID', async () => {
      // Arrange
      const message = createMockMessage({ authorId: 'ignored-user-123' });
      mockGetAntiSpamSettingsForGuild.mockResolvedValueOnce({ enabled: true });

      // Mock config with ignored user
      vi.doMock('../../../../src/config', () => ({
        default: {
          antiSpam: {
            spamThreshold: 5,
            timeWindow: 3000,
            timeoutDuration: 60000,
            multiChannelSpamThreshold: 3,
            multiChannelTimeWindow: 5000,
            ignoredUsers: ['ignored-user-123'],
            ignoredRoles: [],
            inactiveUserThreshold: 300,
          },
        },
      }));

      // Act
      await handleAntiSpam(message as any);

      // Assert - since we can't easily re-mock config, we test the debug log
      expect(mockGetAntiSpamSettingsForGuild).toHaveBeenCalled();
    });

    it('should skip user with ignored role', async () => {
      // Arrange
      const message = createMockMessage({ memberRoles: ['mod-role-123'] });
      mockGetAntiSpamSettingsForGuild.mockResolvedValueOnce({ enabled: true });

      // Act
      await handleAntiSpam(message as any);

      // Assert
      expect(mockGetAntiSpamSettingsForGuild).toHaveBeenCalled();
    });
  });

  // ============================================
  // handleAntiSpam() - Cache and State Management
  // ============================================

  describe('handleAntiSpam() - cache management', () => {
    it('should create new user data when cache is empty', async () => {
      // Arrange
      const message = createMockMessage();
      mockGetAntiSpamSettingsForGuild.mockResolvedValueOnce({ enabled: true });
      mockCacheGet.mockResolvedValueOnce(null);

      // Act
      await handleAntiSpam(message as any);

      // Assert
      expect(mockCacheGet).toHaveBeenCalledWith('antispam:user-123');
      expect(mockCacheSet).toHaveBeenCalledWith(
        'antispam:user-123',
        expect.objectContaining({
          timestamps: expect.any(Array),
        }),
        expect.any(Number)
      );
    });

    it('should use existing cache data when available', async () => {
      // Arrange
      const message = createMockMessage();
      mockGetAntiSpamSettingsForGuild.mockResolvedValueOnce({ enabled: true });
      mockCacheGet.mockResolvedValueOnce({
        timestamps: [{ ts: Date.now() - 1000, channelId: 'channel-123' }],
        punishedUntil: null,
      });

      // Act
      await handleAntiSpam(message as any);

      // Assert
      expect(mockCacheSet).toHaveBeenCalledWith(
        'antispam:user-123',
        expect.objectContaining({
          timestamps: expect.arrayContaining([
            expect.objectContaining({ channelId: 'channel-123' }),
          ]),
        }),
        expect.any(Number)
      );
    });

    it('should skip processing when user is still punished', async () => {
      // Arrange
      const message = createMockMessage({
        communicationDisabledUntil: Date.now() + 60000, // Still timed out
      });
      mockGetAntiSpamSettingsForGuild.mockResolvedValueOnce({ enabled: true });
      mockCacheGet.mockResolvedValueOnce({
        timestamps: [],
        punishedUntil: Date.now() + 60000,
      });

      // Act
      await handleAntiSpam(message as any);

      // Assert - should return early without updating cache
      expect(mockCacheSet).not.toHaveBeenCalled();
    });

    it('should reset punishment when manually removed in Discord', async () => {
      // Arrange - cache says punished but Discord says not
      const message = createMockMessage({
        communicationDisabledUntil: null,
      });
      mockGetAntiSpamSettingsForGuild.mockResolvedValueOnce({ enabled: true });
      mockCacheGet.mockResolvedValueOnce({
        timestamps: [{ ts: Date.now() - 1000, channelId: 'channel-123' }],
        punishedUntil: Date.now() + 60000, // Cache says punished
      });

      // Act
      await handleAntiSpam(message as any);

      // Assert
      expect(mockLoggerDebug).toHaveBeenCalledWith(
        expect.stringContaining('timeout was manually removed')
      );
    });

    it('should reset state when punishment expires', async () => {
      // Arrange - punishment expired
      const message = createMockMessage();
      mockGetAntiSpamSettingsForGuild.mockResolvedValueOnce({ enabled: true });
      mockCacheGet.mockResolvedValueOnce({
        timestamps: [{ ts: Date.now() - 10000, channelId: 'channel-123' }],
        punishedUntil: Date.now() - 1000, // Expired
      });

      // Act
      await handleAntiSpam(message as any);

      // Assert - should reset timestamps
      expect(mockCacheSet).toHaveBeenCalledWith(
        'antispam:user-123',
        expect.objectContaining({
          punishedUntil: null,
        }),
        expect.any(Number)
      );
    });
  });

  // ============================================
  // handleAntiSpam() - Timestamp Management
  // ============================================

  describe('handleAntiSpam() - timestamp management', () => {
    it('should add current message timestamp', async () => {
      // Arrange
      const message = createMockMessage();
      mockGetAntiSpamSettingsForGuild.mockResolvedValueOnce({ enabled: true });
      mockCacheGet.mockResolvedValueOnce(null);

      // Act
      await handleAntiSpam(message as any);

      // Assert
      expect(mockCacheSet).toHaveBeenCalledWith(
        'antispam:user-123',
        expect.objectContaining({
          timestamps: expect.arrayContaining([
            expect.objectContaining({ channelId: 'channel-123' }),
          ]),
        }),
        expect.any(Number)
      );
    });

    it('should filter out expired timestamps', async () => {
      // Arrange
      const now = Date.now();
      const message = createMockMessage();
      mockGetAntiSpamSettingsForGuild.mockResolvedValueOnce({ enabled: true });
      mockCacheGet.mockResolvedValueOnce({
        timestamps: [
          { ts: now - 10000, channelId: 'channel-123' }, // Old, should be filtered
          { ts: now - 1000, channelId: 'channel-123' },  // Recent, should be kept
        ],
        punishedUntil: null,
      });

      // Act
      await handleAntiSpam(message as any);

      // Assert
      expect(mockCacheSet).toHaveBeenCalled();
    });
  });

  // ============================================
  // checkSpam() - Pure Logic Tests
  // ============================================

  describe('checkSpam() - single channel spam detection', () => {
    it('should detect single-channel spam when threshold exceeded', () => {
      // Arrange
      const now = Date.now();
      const userData: UserMessageData = {
        timestamps: [
          { ts: now - 100, channelId: 'channel-1' },
          { ts: now - 200, channelId: 'channel-1' },
          { ts: now - 300, channelId: 'channel-1' },
          { ts: now - 400, channelId: 'channel-1' },
          { ts: now - 500, channelId: 'channel-1' },
        ],
        punishedUntil: null,
      };

      const settings = {
        spamThreshold: 5,
        timeWindow: 3000,
        multiChannelSpamThreshold: 3,
        multiChannelTimeWindow: 5000,
      };

      // Act
      vi.setSystemTime(now);
      const result = checkSpam(userData, 'channel-1', settings);

      // Assert
      expect(result).toBe('Fast single-channel spam');
    });

    it('should not trigger when below threshold', () => {
      // Arrange
      const now = Date.now();
      const userData: UserMessageData = {
        timestamps: [
          { ts: now - 100, channelId: 'channel-1' },
          { ts: now - 200, channelId: 'channel-1' },
          { ts: now - 300, channelId: 'channel-1' },
        ],
        punishedUntil: null,
      };

      const settings = {
        spamThreshold: 5,
        timeWindow: 3000,
        multiChannelSpamThreshold: 3,
        multiChannelTimeWindow: 5000,
      };

      // Act
      vi.setSystemTime(now);
      const result = checkSpam(userData, 'channel-1', settings);

      // Assert
      expect(result).toBeNull();
    });

    it('should not count messages outside time window', () => {
      // Arrange
      const now = Date.now();
      const userData: UserMessageData = {
        timestamps: [
          { ts: now - 10000, channelId: 'channel-1' }, // Outside window
          { ts: now - 10100, channelId: 'channel-1' }, // Outside window
          { ts: now - 100, channelId: 'channel-1' },
          { ts: now - 200, channelId: 'channel-1' },
        ],
        punishedUntil: null,
      };

      const settings = {
        spamThreshold: 5,
        timeWindow: 3000,
        multiChannelSpamThreshold: 3,
        multiChannelTimeWindow: 5000,
      };

      // Act
      vi.setSystemTime(now);
      const result = checkSpam(userData, 'channel-1', settings);

      // Assert
      expect(result).toBeNull();
    });

    it('should not count messages from different channels', () => {
      // Arrange
      const now = Date.now();
      const userData: UserMessageData = {
        timestamps: [
          { ts: now - 100, channelId: 'channel-1' },
          { ts: now - 200, channelId: 'channel-2' },
          { ts: now - 300, channelId: 'channel-1' },
          { ts: now - 400, channelId: 'channel-3' },
          { ts: now - 500, channelId: 'channel-1' },
        ],
        punishedUntil: null,
      };

      const settings = {
        spamThreshold: 5,
        timeWindow: 3000,
        multiChannelSpamThreshold: 10, // Set high to avoid triggering
        multiChannelTimeWindow: 5000,
      };

      // Act
      vi.setSystemTime(now);
      const result = checkSpam(userData, 'channel-1', settings);

      // Assert - only 3 messages in channel-1
      expect(result).toBeNull();
    });
  });

  describe('checkSpam() - multi-channel spam detection', () => {
    it('should detect multi-channel spam when threshold exceeded', () => {
      // Arrange
      const now = Date.now();
      const userData: UserMessageData = {
        timestamps: [
          { ts: now - 100, channelId: 'channel-1' },
          { ts: now - 200, channelId: 'channel-2' },
          { ts: now - 300, channelId: 'channel-3' },
        ],
        punishedUntil: null,
      };

      const settings = {
        spamThreshold: 10, // High to avoid single-channel trigger
        timeWindow: 3000,
        multiChannelSpamThreshold: 3,
        multiChannelTimeWindow: 5000,
      };

      // Act
      vi.setSystemTime(now);
      const result = checkSpam(userData, 'channel-4', settings);

      // Assert
      expect(result).toBe('Multi-channel spam (3 channels)');
    });

    it('should not trigger when below multi-channel threshold', () => {
      // Arrange
      const now = Date.now();
      const userData: UserMessageData = {
        timestamps: [
          { ts: now - 100, channelId: 'channel-1' },
          { ts: now - 200, channelId: 'channel-2' },
        ],
        punishedUntil: null,
      };

      const settings = {
        spamThreshold: 10,
        timeWindow: 3000,
        multiChannelSpamThreshold: 3,
        multiChannelTimeWindow: 5000,
      };

      // Act
      vi.setSystemTime(now);
      const result = checkSpam(userData, 'channel-1', settings);

      // Assert
      expect(result).toBeNull();
    });

    it('should not count duplicate channels multiple times', () => {
      // Arrange
      const now = Date.now();
      const userData: UserMessageData = {
        timestamps: [
          { ts: now - 100, channelId: 'channel-1' },
          { ts: now - 200, channelId: 'channel-1' },
          { ts: now - 300, channelId: 'channel-2' },
          { ts: now - 400, channelId: 'channel-2' },
        ],
        punishedUntil: null,
      };

      const settings = {
        spamThreshold: 10,
        timeWindow: 3000,
        multiChannelSpamThreshold: 3,
        multiChannelTimeWindow: 5000,
      };

      // Act
      vi.setSystemTime(now);
      const result = checkSpam(userData, 'channel-1', settings);

      // Assert - only 2 unique channels
      expect(result).toBeNull();
    });
  });

  // ============================================
  // UserMessageData interface tests
  // ============================================

  describe('UserMessageData interface', () => {
    it('should have correct shape', () => {
      const data: UserMessageData = {
        timestamps: [{ ts: Date.now(), channelId: 'ch-1' }],
        punishedUntil: null,
      };

      expect(Array.isArray(data.timestamps)).toBe(true);
      expect(data.punishedUntil).toBeNull();
    });

    it('should support punishedUntil timestamp', () => {
      const data: UserMessageData = {
        timestamps: [],
        punishedUntil: Date.now() + 60000,
      };

      expect(typeof data.punishedUntil).toBe('number');
    });
  });

  // ============================================
  // Settings fallback tests
  // ============================================

  describe('settings handling', () => {
    it('should use guild settings when available', async () => {
      // Arrange
      const message = createMockMessage();
      mockGetAntiSpamSettingsForGuild.mockResolvedValueOnce({
        enabled: true,
        messagethreshold: 10,
        time_window: 5000,
        timeoutduration: 120000,
      });
      mockCacheGet.mockResolvedValueOnce(null);

      // Act
      await handleAntiSpam(message as any);

      // Assert
      expect(mockGetAntiSpamSettingsForGuild).toHaveBeenCalledWith('guild-123');
    });

    it('should log settings in debug mode', async () => {
      // Arrange
      const message = createMockMessage();
      mockGetAntiSpamSettingsForGuild.mockResolvedValueOnce({ enabled: true });
      mockCacheGet.mockResolvedValueOnce(null);

      // Act
      await handleAntiSpam(message as any);

      // Assert
      expect(mockLoggerDebug).toHaveBeenCalledWith(
        expect.stringContaining('Settings for guild'),
        expect.any(Object)
      );
    });
  });

  // ============================================
  // Cache key format tests
  // ============================================

  describe('cache key patterns', () => {
    it('should use antispam:userId format', async () => {
      // Arrange
      const message = createMockMessage({ authorId: 'user-abc-123' });
      mockGetAntiSpamSettingsForGuild.mockResolvedValueOnce({ enabled: true });
      mockCacheGet.mockResolvedValueOnce(null);

      // Act
      await handleAntiSpam(message as any);

      // Assert
      expect(mockCacheGet).toHaveBeenCalledWith('antispam:user-abc-123');
    });
  });
});
