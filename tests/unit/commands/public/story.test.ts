/**
 * Story Forum Command Unit Tests
 *
 * Tests for the /sf (story forum) command which handles
 * subscriptions and notifications for story threads.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Locale, ChannelType } from 'discord.js';

// ============================================
// Mock Setup - Use vi.hoisted for persistence
// ============================================

const {
  mockDeferReply,
  mockEditReply,
  mockHandleSubscribe,
  mockHandleUnsubscribe,
  mockHandleNotify,
  mockHandleEntry,
  mockHandleView,
  mockHandlePermissions,
  mockHandleFind,
  mockGetThreadInfo,
} = vi.hoisted(() => ({
  mockDeferReply: vi.fn().mockResolvedValue(undefined),
  mockEditReply: vi.fn().mockResolvedValue(undefined),
  mockHandleSubscribe: vi.fn().mockResolvedValue(undefined),
  mockHandleUnsubscribe: vi.fn().mockResolvedValue(undefined),
  mockHandleNotify: vi.fn().mockResolvedValue(undefined),
  mockHandleEntry: vi.fn().mockResolvedValue(undefined),
  mockHandleView: vi.fn().mockResolvedValue(undefined),
  mockHandlePermissions: vi.fn().mockResolvedValue(undefined),
  mockHandleFind: vi.fn().mockResolvedValue(undefined),
  mockGetThreadInfo: vi.fn(),
}));

// Mock subcommand handlers
vi.mock('../../../../src/commands/public/story/subscribe.js', () => ({
  handleSubscribe: mockHandleSubscribe,
}));

vi.mock('../../../../src/commands/public/story/unsubscribe.js', () => ({
  handleUnsubscribe: mockHandleUnsubscribe,
}));

vi.mock('../../../../src/commands/public/story/notify.js', () => ({
  handleNotify: mockHandleNotify,
}));

vi.mock('../../../../src/commands/public/story/entry.js', () => ({
  handleEntry: mockHandleEntry,
}));

vi.mock('../../../../src/commands/public/story/view.js', () => ({
  handleView: mockHandleView,
}));

vi.mock('../../../../src/commands/public/story/permissions.js', () => ({
  handlePermissions: mockHandlePermissions,
}));

vi.mock('../../../../src/commands/public/story/find.js', () => ({
  handleFind: mockHandleFind,
}));

// ============================================
// Import command after mocks are set up
// ============================================

import { command as storyCommand } from '../../../../src/commands/public/story/index.js';

// ============================================
// Test Helpers
// ============================================

function createMockThreadChannel() {
  return {
    id: 'thread123',
    type: ChannelType.PublicThread,
    isThread: () => true,
  };
}

function createMockInteraction(overrides: Record<string, any> = {}) {
  return {
    commandName: 'sf',
    user: { id: 'user123', tag: 'TestUser#0001' },
    guild: { id: 'guild123' },
    guildId: 'guild123',
    channelId: 'thread123',
    channel: createMockThreadChannel(),
    locale: Locale.ChineseTW,
    deferReply: mockDeferReply,
    editReply: mockEditReply,
    replied: false,
    deferred: false,
    isChatInputCommand: () => true,
    options: {
      getString: vi.fn(),
      getInteger: vi.fn(),
      getUser: vi.fn(),
      getSubcommand: vi.fn().mockReturnValue('subscribe'),
      getSubcommandGroup: vi.fn().mockReturnValue(null),
    },
    ...overrides,
  };
}

function createMockClient() {
  return {
    ws: { ping: 42 },
    user: { id: 'bot123', username: 'MimiBot' },
  };
}

function createMockServices() {
  return {
    localizationManager: {
      get: vi.fn().mockReturnValue('translated_text'),
    },
    settingsManager: {},
    ticketManager: {},
    helpService: {},
    forumService: {},
    cacheService: {},
    storyForumService: {
      getThreadInfo: mockGetThreadInfo,
    },
  };
}

// ============================================
// Tests
// ============================================

describe('Story Forum Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetThreadInfo.mockResolvedValue({
      thread_id: 'thread123',
      status: 'validated',
      author_id: 'author123',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Command Data', () => {
    it('should have correct command name', () => {
      expect(storyCommand.data.name).toBe('sf');
    });

    it('should have description', () => {
      expect(storyCommand.data.description).toBe('Story forum subscriptions and notifications');
    });

    it('should have Chinese localization', () => {
      const descLocalizations = storyCommand.data.toJSON().description_localizations;
      expect(descLocalizations?.['zh-TW']).toBe('故事論壇訂閱與通知系統');
    });

    it('should be guild only', () => {
      expect(storyCommand.guildOnly).toBe(true);
    });

    it('should have subscribe subcommand', () => {
      const json = storyCommand.data.toJSON();
      const options = json.options || [];
      const subscribeCmd = options.find((opt: any) => opt.name === 'subscribe');
      expect(subscribeCmd).toBeDefined();
    });

    it('should have unsubscribe subcommand', () => {
      const json = storyCommand.data.toJSON();
      const options = json.options || [];
      const unsubscribeCmd = options.find((opt: any) => opt.name === 'unsubscribe');
      expect(unsubscribeCmd).toBeDefined();
    });

    it('should have notify subcommand', () => {
      const json = storyCommand.data.toJSON();
      const options = json.options || [];
      const notifyCmd = options.find((opt: any) => opt.name === 'notify');
      expect(notifyCmd).toBeDefined();
    });

    it('should have permissions subcommand group', () => {
      const json = storyCommand.data.toJSON();
      const options = json.options || [];
      const permissionsGroup = options.find((opt: any) => opt.name === 'permissions');
      expect(permissionsGroup).toBeDefined();
    });
  });

  describe('execute()', () => {
    it('should defer reply on execute', async () => {
      const interaction = createMockInteraction();
      const client = createMockClient();
      const services = createMockServices();

      await storyCommand.execute(
        interaction as any,
        client as any,
        services as any,
        {} as any
      );

      expect(mockDeferReply).toHaveBeenCalledWith({ ephemeral: true });
    });

    it('should not defer if already deferred', async () => {
      const interaction = createMockInteraction({
        deferred: true,
      });
      const client = createMockClient();
      const services = createMockServices();

      await storyCommand.execute(
        interaction as any,
        client as any,
        services as any,
        {} as any
      );

      expect(mockDeferReply).not.toHaveBeenCalled();
    });

    describe('View Subcommand', () => {
      it('should handle view command without thread check', async () => {
        const interaction = createMockInteraction({
          options: {
            getSubcommand: vi.fn().mockReturnValue('view'),
            getSubcommandGroup: vi.fn().mockReturnValue(null),
          },
          channel: null, // Not in a thread
        });
        const client = createMockClient();
        const services = createMockServices();

        await storyCommand.execute(
          interaction as any,
          client as any,
          services as any,
          {} as any
        );

        expect(mockHandleView).toHaveBeenCalled();
      });
    });

    describe('Thread Check', () => {
      it('should reject if not in a thread', async () => {
        const interaction = createMockInteraction({
          channel: {
            isThread: () => false,
          },
        });
        const client = createMockClient();
        const services = createMockServices();

        await storyCommand.execute(
          interaction as any,
          client as any,
          services as any,
          {} as any
        );

        expect(mockEditReply).toHaveBeenCalledWith(
          expect.objectContaining({
            content: expect.stringContaining('討論串'),
          })
        );
      });

      it('should reject if thread is not validated', async () => {
        mockGetThreadInfo.mockResolvedValue({
          thread_id: 'thread123',
          status: 'pending',
        });

        const interaction = createMockInteraction();
        const client = createMockClient();
        const services = createMockServices();

        await storyCommand.execute(
          interaction as any,
          client as any,
          services as any,
          {} as any
        );

        expect(mockEditReply).toHaveBeenCalledWith(
          expect.objectContaining({
            content: expect.stringContaining('驗證'),
          })
        );
      });

      it('should reject if thread info not found', async () => {
        mockGetThreadInfo.mockResolvedValue(null);

        const interaction = createMockInteraction();
        const client = createMockClient();
        const services = createMockServices();

        await storyCommand.execute(
          interaction as any,
          client as any,
          services as any,
          {} as any
        );

        expect(mockEditReply).toHaveBeenCalledWith(
          expect.objectContaining({
            content: expect.stringContaining('驗證'),
          })
        );
      });
    });

    describe('Subscribe Subcommand', () => {
      it('should route to subscribe handler', async () => {
        const interaction = createMockInteraction({
          options: {
            getSubcommand: vi.fn().mockReturnValue('subscribe'),
            getSubcommandGroup: vi.fn().mockReturnValue(null),
          },
        });
        const client = createMockClient();
        const services = createMockServices();

        await storyCommand.execute(
          interaction as any,
          client as any,
          services as any,
          {} as any
        );

        expect(mockHandleSubscribe).toHaveBeenCalledWith(
          interaction,
          client,
          services
        );
      });
    });

    describe('Unsubscribe Subcommand', () => {
      it('should route to unsubscribe handler', async () => {
        const interaction = createMockInteraction({
          options: {
            getSubcommand: vi.fn().mockReturnValue('unsubscribe'),
            getSubcommandGroup: vi.fn().mockReturnValue(null),
          },
        });
        const client = createMockClient();
        const services = createMockServices();

        await storyCommand.execute(
          interaction as any,
          client as any,
          services as any,
          {} as any
        );

        expect(mockHandleUnsubscribe).toHaveBeenCalledWith(
          interaction,
          client,
          services
        );
      });
    });

    describe('Notify Subcommand', () => {
      it('should route to notify handler', async () => {
        const interaction = createMockInteraction({
          options: {
            getSubcommand: vi.fn().mockReturnValue('notify'),
            getSubcommandGroup: vi.fn().mockReturnValue(null),
          },
        });
        const client = createMockClient();
        const services = createMockServices();

        await storyCommand.execute(
          interaction as any,
          client as any,
          services as any,
          {} as any
        );

        expect(mockHandleNotify).toHaveBeenCalledWith(
          interaction,
          client,
          services
        );
      });
    });

    describe('Entry Subcommand', () => {
      it('should route to entry handler with thread info', async () => {
        const threadInfo = {
          thread_id: 'thread123',
          status: 'validated',
          author_id: 'author123',
        };
        mockGetThreadInfo.mockResolvedValue(threadInfo);

        const interaction = createMockInteraction({
          options: {
            getSubcommand: vi.fn().mockReturnValue('entry'),
            getSubcommandGroup: vi.fn().mockReturnValue(null),
          },
        });
        const client = createMockClient();
        const services = createMockServices();

        await storyCommand.execute(
          interaction as any,
          client as any,
          services as any,
          {} as any
        );

        expect(mockHandleEntry).toHaveBeenCalledWith(
          interaction,
          client,
          services,
          threadInfo
        );
      });
    });

    describe('Find Subcommand', () => {
      it('should route to find handler', async () => {
        const interaction = createMockInteraction({
          options: {
            getSubcommand: vi.fn().mockReturnValue('find'),
            getSubcommandGroup: vi.fn().mockReturnValue(null),
          },
        });
        const client = createMockClient();
        const services = createMockServices();

        await storyCommand.execute(
          interaction as any,
          client as any,
          services as any,
          {} as any
        );

        expect(mockHandleFind).toHaveBeenCalledWith(
          interaction,
          client,
          services
        );
      });
    });

    describe('Permissions Subcommand Group', () => {
      it('should route to permissions handler', async () => {
        const threadInfo = {
          thread_id: 'thread123',
          status: 'validated',
          author_id: 'author123',
        };
        mockGetThreadInfo.mockResolvedValue(threadInfo);

        const interaction = createMockInteraction({
          options: {
            getSubcommand: vi.fn().mockReturnValue('add'),
            getSubcommandGroup: vi.fn().mockReturnValue('permissions'),
          },
        });
        const client = createMockClient();
        const services = createMockServices();

        await storyCommand.execute(
          interaction as any,
          client as any,
          services as any,
          {} as any
        );

        expect(mockHandlePermissions).toHaveBeenCalledWith(
          interaction,
          client,
          services,
          threadInfo
        );
      });
    });

    describe('Error Handling', () => {
      it('should handle errors gracefully', async () => {
        mockHandleSubscribe.mockRejectedValue(new Error('Handler error'));

        const interaction = createMockInteraction();
        const client = createMockClient();
        const services = createMockServices();

        await storyCommand.execute(
          interaction as any,
          client as any,
          services as any,
          {} as any
        );

        expect(mockEditReply).toHaveBeenCalledWith(
          expect.objectContaining({
            content: expect.stringContaining('錯誤'),
          })
        );
      });
    });
  });
});
