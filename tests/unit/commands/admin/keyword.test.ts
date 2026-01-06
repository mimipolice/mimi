/**
 * Keyword Command Unit Tests
 *
 * Tests for the /keyword command which manages keyword auto-replies.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Locale, PermissionFlagsBits } from 'discord.js';

// ============================================
// Mock Setup - Use vi.hoisted for persistence
// ============================================

const {
  mockDeferReply,
  mockEditReply,
  mockAddKeyword,
  mockRemoveKeyword,
  mockGetKeywordsByGuild,
  mockFlushKeywordsCacheForGuild,
  mockGetLocalizations,
} = vi.hoisted(() => ({
  mockDeferReply: vi.fn().mockResolvedValue(undefined),
  mockEditReply: vi.fn().mockResolvedValue(undefined),
  mockAddKeyword: vi.fn().mockResolvedValue(undefined),
  mockRemoveKeyword: vi.fn().mockResolvedValue(undefined),
  mockGetKeywordsByGuild: vi.fn(),
  mockFlushKeywordsCacheForGuild: vi.fn(),
  mockGetLocalizations: vi.fn(),
}));

// Mock admin repository
vi.mock('../../../../src/repositories/admin.repository.js', () => ({
  addKeyword: mockAddKeyword,
  removeKeyword: mockRemoveKeyword,
  getKeywordsByGuild: mockGetKeywordsByGuild,
}));

// Mock cache
vi.mock('../../../../src/shared/cache.js', () => ({
  flushKeywordsCacheForGuild: mockFlushKeywordsCacheForGuild,
}));

// Mock database
vi.mock('../../../../src/shared/database.js', () => ({
  mimiDLCDb: {},
}));

// Mock localization
vi.mock('../../../../src/utils/localization.js', () => ({
  getLocalizations: mockGetLocalizations,
}));

// ============================================
// Import command after mocks are set up
// ============================================

import keywordCommand from '../../../../src/commands/admin/keyword/index.js';

// ============================================
// Test Helpers
// ============================================

function createMockInteraction(overrides: Record<string, any> = {}) {
  return {
    commandName: 'keyword',
    user: { id: 'user123', tag: 'TestUser#0001' },
    member: {
      permissions: {
        has: vi.fn().mockReturnValue(true),
      },
    },
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
      getSubcommand: vi.fn().mockReturnValue('list'),
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
      getAvailableLanguages: vi.fn().mockReturnValue(['en-US', 'zh-TW']),
      getLocale: vi.fn(),
    },
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

// ============================================
// Tests
// ============================================

describe('Keyword Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetKeywordsByGuild.mockResolvedValue([]);
    // Set up localization mock return value
    mockGetLocalizations.mockReturnValue({
      'en-US': {
        subcommands: {
          add: {
            responses: {
              success: 'Added keyword: {{keyword}}',
            },
          },
          remove: {
            responses: {
              success: 'Removed keyword: {{keyword}}',
            },
          },
          list: {
            responses: {
              no_keywords: 'No keywords configured',
              title: 'Keyword Replies',
            },
          },
        },
        general_error: 'An error occurred',
      },
      'zh-TW': {
        subcommands: {
          add: {
            responses: {
              success: '已新增關鍵字: {{keyword}}',
            },
          },
          remove: {
            responses: {
              success: '已移除關鍵字: {{keyword}}',
            },
          },
          list: {
            responses: {
              no_keywords: '未設定關鍵字',
              title: '關鍵字回覆',
            },
          },
        },
        general_error: '發生錯誤',
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Command Data', () => {
    it('should have correct command name', () => {
      expect(keywordCommand.data.name).toBe('keyword');
    });

    it('should have description', () => {
      expect(keywordCommand.data.description).toBe('Manage keyword replies.');
    });

    it('should have Chinese localization', () => {
      const nameLocalizations = keywordCommand.data.toJSON().name_localizations;
      expect(nameLocalizations?.['zh-TW']).toBe('關鍵字');
    });

    it('should require Administrator permission', () => {
      const json = keywordCommand.data.toJSON();
      expect(json.default_member_permissions).toBe(
        PermissionFlagsBits.Administrator.toString()
      );
    });

    it('should have add subcommand', () => {
      const json = keywordCommand.data.toJSON();
      const options = json.options || [];
      const addCmd = options.find((opt: any) => opt.name === 'add');
      expect(addCmd).toBeDefined();
    });

    it('should have remove subcommand', () => {
      const json = keywordCommand.data.toJSON();
      const options = json.options || [];
      const removeCmd = options.find((opt: any) => opt.name === 'remove');
      expect(removeCmd).toBeDefined();
    });

    it('should have list subcommand', () => {
      const json = keywordCommand.data.toJSON();
      const options = json.options || [];
      const listCmd = options.find((opt: any) => opt.name === 'list');
      expect(listCmd).toBeDefined();
    });
  });

  describe('execute()', () => {
    it('should return if not chat input command', async () => {
      const interaction = createMockInteraction({
        isChatInputCommand: () => false,
      });
      const client = createMockClient();
      const services = createMockServices();
      const databases = createMockDatabases();

      await keywordCommand.execute(
        interaction as any,
        client as any,
        services as any,
        databases as any
      );

      expect(mockDeferReply).not.toHaveBeenCalled();
    });

    it('should return if guildId is null', async () => {
      const interaction = createMockInteraction({
        guildId: null,
      });
      const client = createMockClient();
      const services = createMockServices();
      const databases = createMockDatabases();

      await keywordCommand.execute(
        interaction as any,
        client as any,
        services as any,
        databases as any
      );

      expect(mockDeferReply).not.toHaveBeenCalled();
    });

    describe('add subcommand', () => {
      it('should defer reply with ephemeral flag', async () => {
        const interaction = createMockInteraction({
          options: {
            getSubcommand: vi.fn().mockReturnValue('add'),
            getString: vi.fn().mockImplementation((name: string, required?: boolean) => {
              if (name === 'type') return 'exact';
              if (name === 'keyword') return 'hello';
              if (name === 'reply') return 'Hello!';
              return null;
            }),
          },
        });
        const client = createMockClient();
        const services = createMockServices();
        const databases = createMockDatabases();

        await keywordCommand.execute(
          interaction as any,
          client as any,
          services as any,
          databases as any
        );

        expect(mockDeferReply).toHaveBeenCalledWith(
          expect.objectContaining({
            flags: expect.anything(),
          })
        );
      });

      it('should add keyword to database', async () => {
        const interaction = createMockInteraction({
          options: {
            getSubcommand: vi.fn().mockReturnValue('add'),
            getString: vi.fn().mockImplementation((name: string, required?: boolean) => {
              if (name === 'type') return 'exact';
              if (name === 'keyword') return 'hello';
              if (name === 'reply') return 'Hello!';
              return null;
            }),
          },
        });
        const client = createMockClient();
        const services = createMockServices();
        const databases = createMockDatabases();

        await keywordCommand.execute(
          interaction as any,
          client as any,
          services as any,
          databases as any
        );

        expect(mockAddKeyword).toHaveBeenCalledWith(
          databases.ticketDb,
          'guild123',
          'hello',
          'Hello!',
          'exact'
        );
      });

      it('should flush cache after adding', async () => {
        const interaction = createMockInteraction({
          options: {
            getSubcommand: vi.fn().mockReturnValue('add'),
            getString: vi.fn().mockImplementation((name: string) => {
              if (name === 'type') return 'contains';
              if (name === 'keyword') return 'test';
              if (name === 'reply') return 'Test reply';
              return null;
            }),
          },
        });
        const client = createMockClient();
        const services = createMockServices();
        const databases = createMockDatabases();

        await keywordCommand.execute(
          interaction as any,
          client as any,
          services as any,
          databases as any
        );

        expect(mockFlushKeywordsCacheForGuild).toHaveBeenCalledWith('guild123');
      });

      it('should reply with success message', async () => {
        const interaction = createMockInteraction({
          options: {
            getSubcommand: vi.fn().mockReturnValue('add'),
            getString: vi.fn().mockImplementation((name: string) => {
              if (name === 'type') return 'exact';
              if (name === 'keyword') return 'hello';
              if (name === 'reply') return 'Hello!';
              return null;
            }),
          },
        });
        const client = createMockClient();
        const services = createMockServices();
        const databases = createMockDatabases();

        await keywordCommand.execute(
          interaction as any,
          client as any,
          services as any,
          databases as any
        );

        expect(mockEditReply).toHaveBeenCalledWith(
          expect.stringContaining('hello')
        );
      });
    });

    describe('remove subcommand', () => {
      it('should remove keyword from database', async () => {
        const interaction = createMockInteraction({
          options: {
            getSubcommand: vi.fn().mockReturnValue('remove'),
            getString: vi.fn().mockImplementation((name: string) => {
              if (name === 'keyword') return 'hello';
              return null;
            }),
          },
        });
        const client = createMockClient();
        const services = createMockServices();
        const databases = createMockDatabases();

        await keywordCommand.execute(
          interaction as any,
          client as any,
          services as any,
          databases as any
        );

        expect(mockRemoveKeyword).toHaveBeenCalledWith(
          databases.ticketDb,
          'guild123',
          'hello'
        );
      });

      it('should flush cache after removing', async () => {
        const interaction = createMockInteraction({
          options: {
            getSubcommand: vi.fn().mockReturnValue('remove'),
            getString: vi.fn().mockImplementation((name: string) => {
              if (name === 'keyword') return 'hello';
              return null;
            }),
          },
        });
        const client = createMockClient();
        const services = createMockServices();
        const databases = createMockDatabases();

        await keywordCommand.execute(
          interaction as any,
          client as any,
          services as any,
          databases as any
        );

        expect(mockFlushKeywordsCacheForGuild).toHaveBeenCalledWith('guild123');
      });
    });

    describe('list subcommand', () => {
      it('should defer reply without ephemeral flag for list', async () => {
        const interaction = createMockInteraction();
        const client = createMockClient();
        const services = createMockServices();
        const databases = createMockDatabases();

        await keywordCommand.execute(
          interaction as any,
          client as any,
          services as any,
          databases as any
        );

        expect(mockDeferReply).toHaveBeenCalled();
      });

      it('should display no keywords message when empty', async () => {
        mockGetKeywordsByGuild.mockResolvedValue([]);

        const interaction = createMockInteraction();
        const client = createMockClient();
        const services = createMockServices();
        const databases = createMockDatabases();

        await keywordCommand.execute(
          interaction as any,
          client as any,
          services as any,
          databases as any
        );

        expect(mockEditReply).toHaveBeenCalledWith('No keywords configured');
      });

      it('should display keywords with container component', async () => {
        mockGetKeywordsByGuild.mockResolvedValue([
          { keyword: 'hello', reply: 'Hello!', match_type: 'exact' },
          { keyword: 'test', reply: 'Test reply', match_type: 'contains' },
        ]);

        const interaction = createMockInteraction();
        const client = createMockClient();
        const services = createMockServices();
        const databases = createMockDatabases();

        await keywordCommand.execute(
          interaction as any,
          client as any,
          services as any,
          databases as any
        );

        expect(mockEditReply).toHaveBeenCalledWith(
          expect.objectContaining({
            components: expect.any(Array),
          })
        );
      });

      it('should group keywords by match type', async () => {
        mockGetKeywordsByGuild.mockResolvedValue([
          { keyword: 'hello', reply: 'Hello!', match_type: 'exact' },
          { keyword: 'world', reply: 'World!', match_type: 'exact' },
          { keyword: 'test', reply: 'Test reply', match_type: 'contains' },
        ]);

        const interaction = createMockInteraction();
        const client = createMockClient();
        const services = createMockServices();
        const databases = createMockDatabases();

        await keywordCommand.execute(
          interaction as any,
          client as any,
          services as any,
          databases as any
        );

        expect(mockEditReply).toHaveBeenCalled();
      });

      it('should truncate long replies', async () => {
        const longReply = 'a'.repeat(100);
        mockGetKeywordsByGuild.mockResolvedValue([
          { keyword: 'long', reply: longReply, match_type: 'exact' },
        ]);

        const interaction = createMockInteraction();
        const client = createMockClient();
        const services = createMockServices();
        const databases = createMockDatabases();

        await keywordCommand.execute(
          interaction as any,
          client as any,
          services as any,
          databases as any
        );

        expect(mockEditReply).toHaveBeenCalled();
      });
    });

    describe('Error Handling', () => {
      it('should handle errors gracefully', async () => {
        mockAddKeyword.mockRejectedValue(new Error('Database error'));

        const interaction = createMockInteraction({
          options: {
            getSubcommand: vi.fn().mockReturnValue('add'),
            getString: vi.fn().mockImplementation((name: string) => {
              if (name === 'type') return 'exact';
              if (name === 'keyword') return 'error';
              if (name === 'reply') return 'Error!';
              return null;
            }),
          },
        });
        const client = createMockClient();
        const services = createMockServices();
        const databases = createMockDatabases();

        await keywordCommand.execute(
          interaction as any,
          client as any,
          services as any,
          databases as any
        );

        expect(mockEditReply).toHaveBeenCalledWith('An error occurred');
      });
    });
  });

  describe('autocomplete()', () => {
    it('should respond with filtered keywords', async () => {
      mockGetKeywordsByGuild.mockResolvedValue([
        { keyword: 'hello' },
        { keyword: 'help' },
        { keyword: 'world' },
      ]);

      const mockRespond = vi.fn();
      const interaction = {
        guildId: 'guild123',
        options: {
          getFocused: vi.fn().mockReturnValue('hel'),
        },
        respond: mockRespond,
      };

      await keywordCommand.autocomplete(interaction as any);

      expect(mockRespond).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ name: 'hello', value: 'hello' }),
          expect.objectContaining({ name: 'help', value: 'help' }),
        ])
      );
    });

    it('should return if no guildId', async () => {
      const mockRespond = vi.fn();
      const interaction = {
        guildId: null,
        options: {
          getFocused: vi.fn(),
        },
        respond: mockRespond,
      };

      await keywordCommand.autocomplete(interaction as any);

      expect(mockRespond).not.toHaveBeenCalled();
    });

    it('should limit results to 25', async () => {
      const manyKeywords = Array.from({ length: 30 }, (_, i) => ({
        keyword: `keyword${i}`,
      }));
      mockGetKeywordsByGuild.mockResolvedValue(manyKeywords);

      const mockRespond = vi.fn();
      const interaction = {
        guildId: 'guild123',
        options: {
          getFocused: vi.fn().mockReturnValue('keyword'),
        },
        respond: mockRespond,
      };

      await keywordCommand.autocomplete(interaction as any);

      const calledWith = mockRespond.mock.calls[0][0];
      expect(calledWith.length).toBeLessThanOrEqual(25);
    });
  });
});
