/**
 * Panel Command Unit Tests
 *
 * Tests for the /panel command which manages ticket panel configuration.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Locale, ChannelType, PermissionFlagsBits } from 'discord.js';

// ============================================
// Mock Setup - Use vi.hoisted for persistence
// ============================================

const {
  mockDeferReply,
  mockEditReply,
  mockReply,
  mockGetSettings,
  mockDbSelectFrom,
  mockDbInsertInto,
  mockDbDeleteFrom,
  mockGetLocalizations,
} = vi.hoisted(() => ({
  mockDeferReply: vi.fn().mockResolvedValue(undefined),
  mockEditReply: vi.fn().mockResolvedValue(undefined),
  mockReply: vi.fn().mockResolvedValue(undefined),
  mockGetSettings: vi.fn(),
  mockDbSelectFrom: vi.fn(),
  mockDbInsertInto: vi.fn(),
  mockDbDeleteFrom: vi.fn(),
  mockGetLocalizations: vi.fn(),
}));

// Mock database
vi.mock('../../../../src/shared/database/index.js', () => ({
  mimiDLCDb: {
    selectFrom: mockDbSelectFrom,
    insertInto: mockDbInsertInto,
    deleteFrom: mockDbDeleteFrom,
  },
}));

// Mock localization
vi.mock('../../../../src/utils/localization.js', () => ({
  getLocalizations: mockGetLocalizations,
}));

// ============================================
// Import command after mocks are set up
// ============================================

import { command as panelCommand } from '../../../../src/commands/admin/panel/index.js';

// ============================================
// Test Helpers
// ============================================

function createMockInteraction(overrides: Record<string, any> = {}) {
  return {
    commandName: 'panel',
    user: { id: 'user123', tag: 'TestUser#0001' },
    member: {
      permissions: {
        has: vi.fn().mockReturnValue(true),
      },
    },
    guild: {
      id: 'guild123',
      channels: {
        fetch: vi.fn().mockResolvedValue({
          id: 'channel123',
          type: ChannelType.GuildText,
          send: vi.fn().mockResolvedValue({ id: 'message123' }),
          toString: vi.fn().mockReturnValue('<#channel123>'),
        }),
      },
    },
    guildId: 'guild123',
    channelId: 'channel123',
    channel: {
      messages: {
        fetch: vi.fn().mockResolvedValue({
          content: 'Test content',
          delete: vi.fn().mockResolvedValue(undefined),
        }),
      },
    },
    locale: Locale.EnglishUS,
    deferReply: mockDeferReply,
    editReply: mockEditReply,
    reply: mockReply,
    replied: false,
    deferred: false,
    isChatInputCommand: () => true,
    options: {
      getString: vi.fn(),
      getInteger: vi.fn(),
      getUser: vi.fn(),
      getRole: vi.fn(),
      getChannel: vi.fn(),
      getSubcommand: vi.fn().mockReturnValue('setup'),
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
    settingsManager: {
      getSettings: mockGetSettings,
      updateSettings: vi.fn().mockResolvedValue(undefined),
    },
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
    ticketDb: {
      selectFrom: mockDbSelectFrom,
      insertInto: mockDbInsertInto,
      deleteFrom: mockDbDeleteFrom,
    },
  };
}

// ============================================
// Tests
// ============================================

describe('Panel Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup localization mock
    mockGetLocalizations.mockReturnValue({
      'en-US': {
        subcommands: {
          setup: {
            responses: {
              success: 'Panel setup complete',
              no_channel: 'No panel channel configured',
              no_types: 'No ticket types configured',
            },
          },
          add: {
            responses: {
              success: 'Added ticket type: {{type_id}}',
            },
          },
          remove: {
            responses: {
              success: 'Removed ticket type: {{type_id}}',
              not_found: 'Ticket type not found: {{type_id}}',
            },
          },
          list: {
            responses: {
              title: 'Ticket Types',
              no_types: 'No ticket types configured',
              type_line: '{{emoji}} **{{label}}** ({{type_id}})',
            },
          },
          customize: {
            responses: {
              success: 'Panel customized',
              no_options: 'Please provide at least one option',
            },
          },
        },
        general_error: 'An error occurred',
      },
      'zh-TW': {
        subcommands: {
          setup: {
            responses: {
              success: '面板設定完成',
              no_channel: '未設定面板頻道',
              no_types: '未設定服務單類型',
            },
          },
          add: {
            responses: {
              success: '已新增服務單類型: {{type_id}}',
            },
          },
          remove: {
            responses: {
              success: '已移除服務單類型: {{type_id}}',
              not_found: '找不到服務單類型: {{type_id}}',
            },
          },
          list: {
            responses: {
              title: '服務單類型',
              no_types: '未設定服務單類型',
              type_line: '{{emoji}} **{{label}}** ({{type_id}})',
            },
          },
          customize: {
            responses: {
              success: '面板已自訂',
              no_options: '請至少提供一個選項',
            },
          },
        },
        general_error: '發生錯誤',
      },
    });

    // Setup default mock chain for selectFrom
    mockDbSelectFrom.mockReturnValue({
      selectAll: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue([]),
          }),
          execute: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    // Setup default mock for insertInto (supports both guilds and ticket_types)
    mockDbInsertInto.mockImplementation((table: string) => {
      if (table === 'guilds') {
        const conflictBuilder = {
          column: vi.fn().mockReturnValue({
            doNothing: vi.fn().mockReturnValue({
              execute: vi.fn().mockResolvedValue({}),
            }),
          }),
        };
        return {
          values: vi.fn().mockReturnValue({
            onConflict: vi.fn().mockImplementation((cb: any) => cb(conflictBuilder)),
          }),
        };
      }
      // ticket_types or other tables
      return {
        values: vi.fn().mockReturnValue({
          execute: vi.fn().mockResolvedValue({}),
        }),
      };
    });

    // Setup default mock for deleteFrom
    mockDbDeleteFrom.mockReturnValue({
      where: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          executeTakeFirst: vi.fn().mockResolvedValue({ numDeletedRows: 1n }),
        }),
      }),
    });

    mockGetSettings.mockResolvedValue({
      panelChannelId: 'channel123',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Command Data', () => {
    it('should have correct command name', () => {
      expect(panelCommand.data.name).toBe('panel');
    });

    it('should have description', () => {
      expect(panelCommand.data.description).toBe('Manage the ticket panel.');
    });

    it('should have Chinese localization', () => {
      const nameLocalizations = panelCommand.data.toJSON().name_localizations;
      expect(nameLocalizations?.['zh-TW']).toBe('面板');
    });

    it('should require Administrator permission', () => {
      const json = panelCommand.data.toJSON();
      expect(json.default_member_permissions).toBe(
        PermissionFlagsBits.Administrator.toString()
      );
    });

    it('should have setup subcommand', () => {
      const json = panelCommand.data.toJSON();
      const options = json.options || [];
      const setupCmd = options.find((opt: any) => opt.name === 'setup');
      expect(setupCmd).toBeDefined();
    });

    it('should have add subcommand', () => {
      const json = panelCommand.data.toJSON();
      const options = json.options || [];
      const addCmd = options.find((opt: any) => opt.name === 'add');
      expect(addCmd).toBeDefined();
    });

    it('should have remove subcommand', () => {
      const json = panelCommand.data.toJSON();
      const options = json.options || [];
      const removeCmd = options.find((opt: any) => opt.name === 'remove');
      expect(removeCmd).toBeDefined();
    });

    it('should have list subcommand', () => {
      const json = panelCommand.data.toJSON();
      const options = json.options || [];
      const listCmd = options.find((opt: any) => opt.name === 'list');
      expect(listCmd).toBeDefined();
    });

    it('should have customize subcommand', () => {
      const json = panelCommand.data.toJSON();
      const options = json.options || [];
      const customizeCmd = options.find((opt: any) => opt.name === 'customize');
      expect(customizeCmd).toBeDefined();
    });
  });

  describe('execute() - setup subcommand', () => {
    it('should return if guildId is null', async () => {
      const interaction = createMockInteraction({
        guildId: null,
      });
      const client = createMockClient();
      const services = createMockServices();
      const databases = createMockDatabases();

      await panelCommand.execute(
        interaction as any,
        client as any,
        services as any,
        databases as any
      );

      expect(mockDeferReply).not.toHaveBeenCalled();
    });

    it('should defer reply with ephemeral flag', async () => {
      const interaction = createMockInteraction();
      const client = createMockClient();
      const services = createMockServices();
      const databases = createMockDatabases();

      await panelCommand.execute(
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

    it('should reply with no channel message when no panel channel configured', async () => {
      mockGetSettings.mockResolvedValue(null);

      const interaction = createMockInteraction();
      const client = createMockClient();
      const services = createMockServices();
      const databases = createMockDatabases();

      await panelCommand.execute(
        interaction as any,
        client as any,
        services as any,
        databases as any
      );

      expect(mockEditReply).toHaveBeenCalledWith('No panel channel configured');
    });

    it('should reply with no types message when no ticket types', async () => {
      const interaction = createMockInteraction();
      const client = createMockClient();
      const services = createMockServices();
      const databases = createMockDatabases();

      await panelCommand.execute(
        interaction as any,
        client as any,
        services as any,
        databases as any
      );

      expect(mockEditReply).toHaveBeenCalledWith('No ticket types configured');
    });
  });

  describe('execute() - add subcommand', () => {
    it('should add ticket type to database', async () => {
      const interaction = createMockInteraction({
        options: {
          getSubcommand: vi.fn().mockReturnValue('add'),
          getString: vi.fn().mockImplementation((name: string) => {
            if (name === 'type_id') return 'support';
            if (name === 'label') return 'Support';
            if (name === 'style') return 'Primary';
            if (name === 'emoji') return '🎫';
            return null;
          }),
        },
      });
      const client = createMockClient();
      const services = createMockServices();
      const databases = createMockDatabases();

      await panelCommand.execute(
        interaction as any,
        client as any,
        services as any,
        databases as any
      );

      expect(mockDbInsertInto).toHaveBeenCalledWith('guilds');
      expect(mockDbInsertInto).toHaveBeenCalledWith('ticket_types');
    });
  });

  describe('execute() - remove subcommand', () => {
    it('should remove ticket type from database', async () => {
      const interaction = createMockInteraction({
        options: {
          getSubcommand: vi.fn().mockReturnValue('remove'),
          getString: vi.fn().mockImplementation((name: string) => {
            if (name === 'type_id') return 'support';
            return null;
          }),
        },
      });
      const client = createMockClient();
      const services = createMockServices();
      const databases = createMockDatabases();

      await panelCommand.execute(
        interaction as any,
        client as any,
        services as any,
        databases as any
      );

      expect(mockDbDeleteFrom).toHaveBeenCalledWith('ticket_types');
    });

    it('should handle non-existent ticket type', async () => {
      mockDbDeleteFrom.mockReturnValue({
        where: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            executeTakeFirst: vi.fn().mockResolvedValue({ numDeletedRows: 0n }),
          }),
        }),
      });

      const interaction = createMockInteraction({
        options: {
          getSubcommand: vi.fn().mockReturnValue('remove'),
          getString: vi.fn().mockImplementation((name: string) => {
            if (name === 'type_id') return 'nonexistent';
            return null;
          }),
        },
      });
      const client = createMockClient();
      const services = createMockServices();
      const databases = createMockDatabases();

      await panelCommand.execute(
        interaction as any,
        client as any,
        services as any,
        databases as any
      );

      expect(mockEditReply).toHaveBeenCalledWith(
        expect.stringContaining('type')
      );
    });
  });

  describe('execute() - list subcommand', () => {
    it('should display no types message when empty', async () => {
      const interaction = createMockInteraction({
        options: {
          getSubcommand: vi.fn().mockReturnValue('list'),
        },
      });
      const client = createMockClient();
      const services = createMockServices();
      const databases = createMockDatabases();

      await panelCommand.execute(
        interaction as any,
        client as any,
        services as any,
        databases as any
      );

      expect(mockEditReply).toHaveBeenCalledWith('No ticket types configured');
    });

    it('should display ticket types when available', async () => {
      mockDbSelectFrom.mockReturnValue({
        selectAll: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              execute: vi.fn().mockResolvedValue([
                { type_id: 'support', label: 'Support', emoji: '🎫' },
                { type_id: 'billing', label: 'Billing', emoji: '💰' },
              ]),
            }),
          }),
        }),
      });

      const interaction = createMockInteraction({
        options: {
          getSubcommand: vi.fn().mockReturnValue('list'),
        },
      });
      const client = createMockClient();
      const services = createMockServices();
      const databases = createMockDatabases();

      await panelCommand.execute(
        interaction as any,
        client as any,
        services as any,
        databases as any
      );

      expect(mockEditReply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array),
        })
      );
    });
  });

  describe('execute() - customize subcommand', () => {
    it('should require at least one option', async () => {
      const interaction = createMockInteraction({
        options: {
          getSubcommand: vi.fn().mockReturnValue('customize'),
          getString: vi.fn().mockReturnValue(null),
        },
      });
      const client = createMockClient();
      const services = createMockServices();
      const databases = createMockDatabases();

      await panelCommand.execute(
        interaction as any,
        client as any,
        services as any,
        databases as any
      );

      expect(mockEditReply).toHaveBeenCalledWith('Please provide at least one option');
    });

    it('should update settings when title provided', async () => {
      const interaction = createMockInteraction({
        options: {
          getSubcommand: vi.fn().mockReturnValue('customize'),
          getString: vi.fn().mockImplementation((name: string) => {
            if (name === 'title') return 'New Title';
            return null;
          }),
        },
      });
      const client = createMockClient();
      const services = createMockServices();
      const databases = createMockDatabases();

      await panelCommand.execute(
        interaction as any,
        client as any,
        services as any,
        databases as any
      );

      expect(services.settingsManager.updateSettings).toHaveBeenCalledWith(
        'guild123',
        expect.objectContaining({
          panelTitle: 'New Title',
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully when not replied', async () => {
      mockGetSettings.mockRejectedValue(new Error('Database error'));

      const interaction = createMockInteraction();
      const client = createMockClient();
      const services = createMockServices();
      const databases = createMockDatabases();

      await panelCommand.execute(
        interaction as any,
        client as any,
        services as any,
        databases as any
      );

      expect(mockReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'An error occurred',
        })
      );
    });

    it('should handle errors when already deferred', async () => {
      mockGetSettings.mockRejectedValue(new Error('Database error'));

      const interaction = createMockInteraction({
        deferred: true,
      });
      const client = createMockClient();
      const services = createMockServices();
      const databases = createMockDatabases();

      await panelCommand.execute(
        interaction as any,
        client as any,
        services as any,
        databases as any
      );

      expect(mockEditReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'An error occurred',
        })
      );
    });
  });

  describe('autocomplete()', () => {
    it('should respond with filtered ticket types', async () => {
      mockDbSelectFrom.mockReturnValue({
        selectAll: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            execute: vi.fn().mockResolvedValue([
              { type_id: 'support', label: 'Support' },
              { type_id: 'billing', label: 'Billing' },
            ]),
          }),
        }),
      });

      const mockRespond = vi.fn();
      const interaction = {
        guildId: 'guild123',
        options: {
          getFocused: vi.fn().mockReturnValue({
            name: 'type_id',
            value: 'sup',
          }),
        },
        respond: mockRespond,
      };

      await panelCommand.autocomplete!(interaction as any);

      expect(mockRespond).toHaveBeenCalled();
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

      await panelCommand.autocomplete!(interaction as any);

      expect(mockRespond).not.toHaveBeenCalled();
    });
  });
});
