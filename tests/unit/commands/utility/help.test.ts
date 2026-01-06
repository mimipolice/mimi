/**
 * Help Command Unit Tests
 *
 * Tests for the /help command which displays available commands.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Locale, GuildMember } from 'discord.js';

// ============================================
// Mock Setup - Use vi.hoisted for persistence
// ============================================

const {
  mockDeferReply,
  mockEditReply,
  mockBuildHelpEmbed,
} = vi.hoisted(() => ({
  mockDeferReply: vi.fn().mockResolvedValue(undefined),
  mockEditReply: vi.fn().mockResolvedValue(undefined),
  mockBuildHelpEmbed: vi.fn(),
}));

// Mock help embed builder
vi.mock('../../../../src/commands/utility/help/helpEmbedBuilder.js', () => ({
  buildHelpEmbed: mockBuildHelpEmbed,
  HelpState: {},
}));

// ============================================
// Import command after mocks are set up
// ============================================

import helpCommand from '../../../../src/commands/utility/help/index.js';

// ============================================
// Test Helpers
// ============================================

function createMockGuildMember() {
  return {
    id: 'user123',
    permissions: {
      has: vi.fn().mockReturnValue(true),
    },
  } as unknown as GuildMember;
}

function createMockInteraction(overrides: Record<string, any> = {}) {
  return {
    commandName: 'help',
    user: { id: 'user123', tag: 'TestUser#0001' },
    member: createMockGuildMember(),
    guild: { id: 'guild123' },
    guildId: 'guild123',
    channelId: 'channel123',
    locale: Locale.EnglishUS,
    deferReply: mockDeferReply,
    editReply: mockEditReply,
    replied: false,
    deferred: false,
    isChatInputCommand: () => true,
    options: {
      getString: vi.fn(),
      getInteger: vi.fn(),
      getUser: vi.fn(),
      getSubcommand: vi.fn(),
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
    helpService: {
      getCommandsByCategory: vi.fn().mockReturnValue(new Map()),
      getAccessibleCategories: vi.fn().mockReturnValue(['public']),
      getAccessibleCommandsInCategory: vi.fn().mockReturnValue([]),
    },
    forumService: {},
    cacheService: {},
    storyForumService: {},
  };
}

// ============================================
// Tests
// ============================================

describe('Help Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBuildHelpEmbed.mockResolvedValue({
      container: { type: 17, components: [] },
      components: [],
      files: [],
    });
  });

  afterEach(() => {
    // Note: Do not use vi.restoreAllMocks() as it clears hoisted mock implementations
  });

  describe('Command Data', () => {
    it('should have correct command name', () => {
      expect(helpCommand.data.name).toBe('help');
    });

    it('should have description', () => {
      expect(helpCommand.data.description).toBe('Shows a list of available commands.');
    });
  });

  describe('execute()', () => {
    it('should defer reply on execute', async () => {
      const interaction = createMockInteraction();
      const client = createMockClient();
      const services = createMockServices();

      await helpCommand.execute(
        interaction as any,
        client as any,
        services as any,
        {} as any
      );

      expect(mockDeferReply).toHaveBeenCalled();
    });

    it('should not defer if already deferred', async () => {
      const interaction = createMockInteraction({
        deferred: true,
      });
      const client = createMockClient();
      const services = createMockServices();

      await helpCommand.execute(
        interaction as any,
        client as any,
        services as any,
        {} as any
      );

      expect(mockDeferReply).not.toHaveBeenCalled();
    });

    it('should detect English locale', async () => {
      const interaction = createMockInteraction({
        locale: Locale.EnglishUS,
      });
      const client = createMockClient();
      const services = createMockServices();

      await helpCommand.execute(
        interaction as any,
        client as any,
        services as any,
        {} as any
      );

      // Verify first argument (state) has correct lang and view
      const firstArg = mockBuildHelpEmbed.mock.calls[0][0];
      expect(firstArg.lang).toBe('en-US');
      expect(firstArg.view).toBe('home');
      // Verify last argument is user id
      const lastArg = mockBuildHelpEmbed.mock.calls[0][4];
      expect(lastArg).toBe('user123');
    });

    it('should detect Chinese locale', async () => {
      const interaction = createMockInteraction({
        locale: Locale.ChineseTW,
      });
      const client = createMockClient();
      const services = createMockServices();

      await helpCommand.execute(
        interaction as any,
        client as any,
        services as any,
        {} as any
      );

      // Verify first argument (state) has correct lang and view
      const firstArg = mockBuildHelpEmbed.mock.calls[0][0];
      expect(firstArg.lang).toBe('zh-TW');
      expect(firstArg.view).toBe('home');
      // Verify last argument is user id
      const lastArg = mockBuildHelpEmbed.mock.calls[0][4];
      expect(lastArg).toBe('user123');
    });

    it('should handle guild member', async () => {
      const member = createMockGuildMember();
      const interaction = createMockInteraction({
        member,
      });
      const client = createMockClient();
      const services = createMockServices();

      await helpCommand.execute(
        interaction as any,
        client as any,
        services as any,
        {} as any
      );

      // Mock is not a real GuildMember instance, so instanceof check fails
      // The command passes null when member is not a real GuildMember
      expect(mockBuildHelpEmbed).toHaveBeenCalledWith(
        expect.anything(),
        services.helpService,
        null,
        services,
        'user123'
      );
    });

    it('should handle non-GuildMember member', async () => {
      const interaction = createMockInteraction({
        member: { id: 'user123' }, // Not a GuildMember instance
      });
      const client = createMockClient();
      const services = createMockServices();

      await helpCommand.execute(
        interaction as any,
        client as any,
        services as any,
        {} as any
      );

      // Should pass null when member is not GuildMember
      expect(mockBuildHelpEmbed).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        null,
        expect.anything(),
        'user123'
      );
    });

    it('should edit reply with container and components', async () => {
      const mockPayload = {
        container: { type: 17, components: [{ type: 10 }] },
        components: [{ type: 1, components: [] }],
        files: [],
      };
      mockBuildHelpEmbed.mockResolvedValue(mockPayload);

      const interaction = createMockInteraction();
      const client = createMockClient();
      const services = createMockServices();

      await helpCommand.execute(
        interaction as any,
        client as any,
        services as any,
        {} as any
      );

      expect(mockEditReply).toHaveBeenCalledWith(
        expect.objectContaining({
          components: expect.arrayContaining([mockPayload.container]),
          files: mockPayload.files,
        })
      );
    });

    it('should include files in reply when present', async () => {
      const mockPayload = {
        container: { type: 17, components: [] },
        components: [],
        files: [{ attachment: Buffer.from('test'), name: 'test.png' }],
      };
      mockBuildHelpEmbed.mockResolvedValue(mockPayload);

      const interaction = createMockInteraction();
      const client = createMockClient();
      const services = createMockServices();

      await helpCommand.execute(
        interaction as any,
        client as any,
        services as any,
        {} as any
      );

      expect(mockEditReply).toHaveBeenCalledWith(
        expect.objectContaining({
          files: mockPayload.files,
        })
      );
    });

    it('should use Components V2 flag', async () => {
      const interaction = createMockInteraction();
      const client = createMockClient();
      const services = createMockServices();

      await helpCommand.execute(
        interaction as any,
        client as any,
        services as any,
        {} as any
      );

      expect(mockEditReply).toHaveBeenCalledWith(
        expect.objectContaining({
          flags: expect.anything(),
        })
      );
    });

    it('should handle zh-CN locale as zh-TW', async () => {
      const interaction = createMockInteraction({
        locale: 'zh-CN',
      });
      const client = createMockClient();
      const services = createMockServices();

      await helpCommand.execute(
        interaction as any,
        client as any,
        services as any,
        {} as any
      );

      // Verify first argument (state) has correct lang (zh-CN should map to zh-TW)
      const firstArg = mockBuildHelpEmbed.mock.calls[0][0];
      expect(firstArg.lang).toBe('zh-TW');
      // Verify last argument is user id
      const lastArg = mockBuildHelpEmbed.mock.calls[0][4];
      expect(lastArg).toBe('user123');
    });
  });
});
