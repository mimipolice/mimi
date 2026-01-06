/**
 * Config Command Unit Tests
 *
 * Tests for the /config command which manages server settings.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Locale, PermissionFlagsBits } from 'discord.js';

// ============================================
// Mock Setup - Use vi.hoisted for persistence
// ============================================

const {
  mockDeferReply,
  mockEditReply,
  mockGetSettings,
  mockUpdateSettings,
  mockGetAntiSpamSettingsForGuild,
  mockUpsertAntiSpamSettings,
  mockDeleteAntiSpamSettings,
  mockGetAntiSpamLogChannel,
  mockSetAntiSpamLogChannel,
  mockFlushAntiSpamSettingsForGuild,
  mockGetLocalizations,
} = vi.hoisted(() => ({
  mockDeferReply: vi.fn().mockResolvedValue(undefined),
  mockEditReply: vi.fn().mockResolvedValue(undefined),
  mockGetSettings: vi.fn(),
  mockUpdateSettings: vi.fn().mockResolvedValue(undefined),
  mockGetAntiSpamSettingsForGuild: vi.fn(),
  mockUpsertAntiSpamSettings: vi.fn().mockResolvedValue(undefined),
  mockDeleteAntiSpamSettings: vi.fn().mockResolvedValue(undefined),
  mockGetAntiSpamLogChannel: vi.fn(),
  mockSetAntiSpamLogChannel: vi.fn().mockResolvedValue(undefined),
  mockFlushAntiSpamSettingsForGuild: vi.fn(),
  mockGetLocalizations: vi.fn(),
}));

// Mock admin repository
vi.mock('../../../../src/repositories/admin.repository.js', () => ({
  getAntiSpamLogChannel: mockGetAntiSpamLogChannel,
  setAntiSpamLogChannel: mockSetAntiSpamLogChannel,
  upsertAntiSpamSettings: mockUpsertAntiSpamSettings,
  deleteAntiSpamSettings: mockDeleteAntiSpamSettings,
}));

// Mock cache
vi.mock('../../../../src/shared/cache.js', () => ({
  flushAntiSpamSettingsForGuild: mockFlushAntiSpamSettingsForGuild,
  getAntiSpamSettingsForGuild: mockGetAntiSpamSettingsForGuild,
}));

// Mock localization
vi.mock('../../../../src/utils/localization.js', () => ({
  getLocalizations: mockGetLocalizations,
}));

// ============================================
// Import command after mocks are set up
// ============================================

import { command as configCommand } from '../../../../src/commands/admin/config/index.js';

// ============================================
// Test Helpers
// ============================================

function createMockInteraction(overrides: Record<string, any> = {}) {
  return {
    commandName: 'config',
    user: { id: 'user123', tag: 'TestUser#0001' },
    member: {
      permissions: {
        has: vi.fn().mockReturnValue(true),
      },
    },
    guild: {
      id: 'guild123',
      iconURL: vi.fn().mockReturnValue('https://example.com/icon.png'),
    },
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
      getRole: vi.fn(),
      getChannel: vi.fn(),
      getSubcommand: vi.fn().mockReturnValue('view'),
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
      getAvailableLanguages: vi.fn().mockReturnValue(['en-US', 'zh-TW']),
      getLocale: vi.fn(),
    },
    settingsManager: {
      getSettings: mockGetSettings,
      updateSettings: mockUpdateSettings,
    },
    ticketManager: {},
    helpService: {},
    forumService: {},
    cacheService: {},
    storyForumService: {},
  };
}

// ============================================
// Tests
// ============================================

describe('Config Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSettings.mockResolvedValue({
      staffRoleId: 'role123',
      ticketCategoryId: 'category123',
      archiveCategoryId: 'archive123',
      logChannelId: 'log123',
      panelChannelId: 'panel123',
    });
    mockGetAntiSpamSettingsForGuild.mockResolvedValue(null);
    mockGetAntiSpamLogChannel.mockResolvedValue(null);
    // Set up localization mock return value
    mockGetLocalizations.mockReturnValue({
      'en-US': {
        subcommands: {
          set: {
            responses: {
              success: 'Settings updated successfully',
            },
          },
          view: {
            responses: {
              title: 'Server Settings',
              staff_role: 'Staff Role',
              ticket_category: 'Ticket Category',
              archive_category: 'Archive Category',
              log_channel: 'Log Channel',
              panel_channel: 'Panel Channel',
              no_config: 'No configuration found',
            },
          },
        },
        'anti-spam': {
          subcommands: {
            set: {
              responses: {
                success: 'Anti-spam settings updated',
                no_params: 'Please provide at least one parameter',
              },
            },
            show: {
              responses: {
                title: 'Anti-Spam Settings',
                not_configured: 'Anti-spam is not configured',
              },
            },
            reset: {
              responses: {
                success: 'Anti-spam settings reset',
              },
            },
            enable: {
              responses: {
                success: 'Anti-spam enabled',
              },
            },
            disable: {
              responses: {
                success: 'Anti-spam disabled',
              },
            },
          },
        },
      },
      'zh-TW': {
        subcommands: {
          set: {
            responses: {
              success: '設定已更新',
            },
          },
          view: {
            responses: {
              title: '伺服器設定',
              staff_role: '員工身分組',
              ticket_category: '客服單類別',
              archive_category: '封存客服單類別',
              log_channel: '日誌頻道',
              panel_channel: '客服單面板頻道',
              no_config: '找不到設定',
            },
          },
        },
        'anti-spam': {
          subcommands: {
            set: {
              responses: {
                success: '防洪設定已更新',
                no_params: '請至少提供一個參數',
              },
            },
            show: {
              responses: {
                title: '防洪設定',
                not_configured: '防洪尚未設定',
              },
            },
            reset: {
              responses: {
                success: '防洪設定已重置',
              },
            },
            enable: {
              responses: {
                success: '防洪已啟用',
              },
            },
            disable: {
              responses: {
                success: '防洪已停用',
              },
            },
          },
        },
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Command Data', () => {
    it('should have correct command name', () => {
      expect(configCommand.data.name).toBe('config');
    });

    it('should have description', () => {
      expect(configCommand.data.description).toBe('Configure server settings.');
    });

    it('should have Chinese localization', () => {
      const nameLocalizations = configCommand.data.toJSON().name_localizations;
      expect(nameLocalizations?.['zh-TW']).toBe('設定');
    });

    it('should require Administrator permission', () => {
      const json = configCommand.data.toJSON();
      expect(json.default_member_permissions).toBe(
        PermissionFlagsBits.Administrator.toString()
      );
    });

    it('should have set subcommand', () => {
      const json = configCommand.data.toJSON();
      const options = json.options || [];
      const setCmd = options.find((opt: any) => opt.name === 'set');
      expect(setCmd).toBeDefined();
    });

    it('should have view subcommand', () => {
      const json = configCommand.data.toJSON();
      const options = json.options || [];
      const viewCmd = options.find((opt: any) => opt.name === 'view');
      expect(viewCmd).toBeDefined();
    });

    it('should have anti-spam subcommand group', () => {
      const json = configCommand.data.toJSON();
      const options = json.options || [];
      const antiSpamGroup = options.find((opt: any) => opt.name === 'anti-spam');
      expect(antiSpamGroup).toBeDefined();
    });
  });

  describe('execute() - view subcommand', () => {
    it('should return if not chat input command', async () => {
      const interaction = createMockInteraction({
        isChatInputCommand: () => false,
      });
      const client = createMockClient();
      const services = createMockServices();

      await configCommand.execute(
        interaction as any,
        client as any,
        services as any,
        {} as any
      );

      expect(mockDeferReply).not.toHaveBeenCalled();
    });

    it('should return if guildId is null', async () => {
      const interaction = createMockInteraction({
        guildId: null,
      });
      const client = createMockClient();
      const services = createMockServices();

      await configCommand.execute(
        interaction as any,
        client as any,
        services as any,
        {} as any
      );

      expect(mockDeferReply).not.toHaveBeenCalled();
    });

    it('should defer reply with ephemeral flag', async () => {
      const interaction = createMockInteraction();
      const client = createMockClient();
      const services = createMockServices();

      await configCommand.execute(
        interaction as any,
        client as any,
        services as any,
        {} as any
      );

      expect(mockDeferReply).toHaveBeenCalledWith(
        expect.objectContaining({
          flags: expect.anything(),
        })
      );
    });

    it('should display server settings', async () => {
      const interaction = createMockInteraction();
      const client = createMockClient();
      const services = createMockServices();

      await configCommand.execute(
        interaction as any,
        client as any,
        services as any,
        {} as any
      );

      expect(mockEditReply).toHaveBeenCalledWith(
        expect.objectContaining({
          components: expect.any(Array),
        })
      );
    });

    it('should display no config message when settings null', async () => {
      mockGetSettings.mockResolvedValue(null);

      const interaction = createMockInteraction();
      const client = createMockClient();
      const services = createMockServices();

      await configCommand.execute(
        interaction as any,
        client as any,
        services as any,
        {} as any
      );

      expect(mockEditReply).toHaveBeenCalled();
    });

    it('should include anti-spam log channel if configured', async () => {
      mockGetAntiSpamLogChannel.mockResolvedValue('antispam123');

      const interaction = createMockInteraction();
      const client = createMockClient();
      const services = createMockServices();

      await configCommand.execute(
        interaction as any,
        client as any,
        services as any,
        {} as any
      );

      expect(mockEditReply).toHaveBeenCalled();
    });
  });

  describe('execute() - set subcommand', () => {
    it('should update settings when all options provided', async () => {
      const interaction = createMockInteraction({
        options: {
          getSubcommand: vi.fn().mockReturnValue('set'),
          getSubcommandGroup: vi.fn().mockReturnValue(null),
          getRole: vi.fn().mockReturnValue({ id: 'role123' }),
          getChannel: vi.fn().mockImplementation((name: string) => {
            return { id: `${name}-channel` };
          }),
        },
      });
      const client = createMockClient();
      const services = createMockServices();

      await configCommand.execute(
        interaction as any,
        client as any,
        services as any,
        {} as any
      );

      expect(mockUpdateSettings).toHaveBeenCalled();
    });
  });

  describe('execute() - anti-spam subcommand group', () => {
    describe('set subcommand', () => {
      it('should require at least one parameter', async () => {
        const interaction = createMockInteraction({
          options: {
            getSubcommand: vi.fn().mockReturnValue('set'),
            getSubcommandGroup: vi.fn().mockReturnValue('anti-spam'),
            getInteger: vi.fn().mockReturnValue(null),
            getString: vi.fn().mockReturnValue(null),
          },
        });
        const client = createMockClient();
        const services = createMockServices();

        await configCommand.execute(
          interaction as any,
          client as any,
          services as any,
          {} as any
        );

        expect(mockEditReply).toHaveBeenCalledWith(
          expect.objectContaining({
            content: expect.stringContaining('參數'),
          })
        );
      });

      it('should update threshold setting', async () => {
        const interaction = createMockInteraction({
          options: {
            getSubcommand: vi.fn().mockReturnValue('set'),
            getSubcommandGroup: vi.fn().mockReturnValue('anti-spam'),
            getInteger: vi.fn().mockImplementation((name: string) => {
              if (name === 'threshold') return 5;
              return null;
            }),
            getString: vi.fn().mockReturnValue(null),
          },
        });
        const client = createMockClient();
        const services = createMockServices();

        await configCommand.execute(
          interaction as any,
          client as any,
          services as any,
          {} as any
        );

        expect(mockUpsertAntiSpamSettings).toHaveBeenCalledWith(
          expect.objectContaining({
            messagethreshold: 5,
          })
        );
      });

      it('should convert timeout to milliseconds', async () => {
        const interaction = createMockInteraction({
          options: {
            getSubcommand: vi.fn().mockReturnValue('set'),
            getSubcommandGroup: vi.fn().mockReturnValue('anti-spam'),
            getInteger: vi.fn().mockImplementation((name: string) => {
              if (name === 'timeout') return 60; // 60 seconds
              return null;
            }),
            getString: vi.fn().mockReturnValue(null),
          },
        });
        const client = createMockClient();
        const services = createMockServices();

        await configCommand.execute(
          interaction as any,
          client as any,
          services as any,
          {} as any
        );

        expect(mockUpsertAntiSpamSettings).toHaveBeenCalledWith(
          expect.objectContaining({
            timeoutduration: 60000, // milliseconds
          })
        );
      });

      it('should flush cache after update', async () => {
        const interaction = createMockInteraction({
          options: {
            getSubcommand: vi.fn().mockReturnValue('set'),
            getSubcommandGroup: vi.fn().mockReturnValue('anti-spam'),
            getInteger: vi.fn().mockImplementation((name: string) => {
              if (name === 'threshold') return 5;
              return null;
            }),
            getString: vi.fn().mockReturnValue(null),
          },
        });
        const client = createMockClient();
        const services = createMockServices();

        await configCommand.execute(
          interaction as any,
          client as any,
          services as any,
          {} as any
        );

        expect(mockFlushAntiSpamSettingsForGuild).toHaveBeenCalledWith('guild123');
      });
    });

    describe('show subcommand', () => {
      it('should display anti-spam settings', async () => {
        mockGetAntiSpamSettingsForGuild.mockResolvedValue({
          enabled: true,
          messagethreshold: 5,
          time_window: 10000,
          timeoutduration: 60000,
          ignored_roles: ['role1', 'role2'],
        });

        const interaction = createMockInteraction({
          options: {
            getSubcommand: vi.fn().mockReturnValue('show'),
            getSubcommandGroup: vi.fn().mockReturnValue('anti-spam'),
          },
        });
        const client = createMockClient();
        const services = createMockServices();

        await configCommand.execute(
          interaction as any,
          client as any,
          services as any,
          {} as any
        );

        expect(mockEditReply).toHaveBeenCalledWith(
          expect.objectContaining({
            components: expect.any(Array),
          })
        );
      });

      it('should display not configured message when no settings', async () => {
        mockGetAntiSpamSettingsForGuild.mockResolvedValue(null);

        const interaction = createMockInteraction({
          options: {
            getSubcommand: vi.fn().mockReturnValue('show'),
            getSubcommandGroup: vi.fn().mockReturnValue('anti-spam'),
          },
        });
        const client = createMockClient();
        const services = createMockServices();

        await configCommand.execute(
          interaction as any,
          client as any,
          services as any,
          {} as any
        );

        expect(mockEditReply).toHaveBeenCalled();
      });
    });

    describe('reset subcommand', () => {
      it('should delete anti-spam settings', async () => {
        const interaction = createMockInteraction({
          options: {
            getSubcommand: vi.fn().mockReturnValue('reset'),
            getSubcommandGroup: vi.fn().mockReturnValue('anti-spam'),
          },
        });
        const client = createMockClient();
        const services = createMockServices();

        await configCommand.execute(
          interaction as any,
          client as any,
          services as any,
          {} as any
        );

        expect(mockDeleteAntiSpamSettings).toHaveBeenCalledWith('guild123');
        expect(mockFlushAntiSpamSettingsForGuild).toHaveBeenCalledWith('guild123');
      });
    });

    describe('enable subcommand', () => {
      it('should enable anti-spam protection', async () => {
        const interaction = createMockInteraction({
          options: {
            getSubcommand: vi.fn().mockReturnValue('enable'),
            getSubcommandGroup: vi.fn().mockReturnValue('anti-spam'),
          },
        });
        const client = createMockClient();
        const services = createMockServices();

        await configCommand.execute(
          interaction as any,
          client as any,
          services as any,
          {} as any
        );

        expect(mockUpsertAntiSpamSettings).toHaveBeenCalledWith(
          expect.objectContaining({
            enabled: true,
          })
        );
      });
    });

    describe('disable subcommand', () => {
      it('should disable anti-spam protection', async () => {
        const interaction = createMockInteraction({
          options: {
            getSubcommand: vi.fn().mockReturnValue('disable'),
            getSubcommandGroup: vi.fn().mockReturnValue('anti-spam'),
          },
        });
        const client = createMockClient();
        const services = createMockServices();

        await configCommand.execute(
          interaction as any,
          client as any,
          services as any,
          {} as any
        );

        expect(mockUpsertAntiSpamSettings).toHaveBeenCalledWith(
          expect.objectContaining({
            enabled: false,
          })
        );
      });
    });
  });
});
