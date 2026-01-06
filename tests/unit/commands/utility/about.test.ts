/**
 * About Command Unit Tests
 *
 * Tests for the /about command which displays bot information and credits.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Locale } from 'discord.js';

// ============================================
// Mock Setup - Use vi.hoisted for persistence
// ============================================

const {
  mockDeferReply,
  mockEditReply,
} = vi.hoisted(() => ({
  mockDeferReply: vi.fn().mockResolvedValue(undefined),
  mockEditReply: vi.fn().mockResolvedValue(undefined),
}));

// Mock credits config
vi.mock('../../../../src/config/credits.json', () => ({
  default: {
    bot: {
      name: 'Mimi Bot',
      description: 'A feature-rich Discord bot',
      version: '1.0.0',
      author: 'TestAuthor',
    },
    assets: {
      libraries: [
        { name: 'discord.js', version: '14.x' },
        { name: 'typescript', version: '5.x' },
      ],
      images: [
        { name: 'Logo', source: 'Artist Name', url: 'https://example.com', license: 'CC-BY' },
      ],
      data: [
        { name: 'Price Data', source: 'Data Provider' },
      ],
    },
    contributors: [
      { name: 'Contributor1', role: 'Developer' },
      { name: 'Contributor2', role: 'Designer' },
    ],
    links: {
      github: 'https://github.com/example/mimi',
      privacy: 'https://example.com/privacy',
      terms: 'https://example.com/terms',
      support: 'https://discord.gg/example',
    },
  },
}));

// ============================================
// Import command after mocks are set up
// ============================================

import aboutCommand from '../../../../src/commands/utility/about/index.js';

// ============================================
// Test Helpers
// ============================================

function createMockInteraction(overrides: Record<string, any> = {}) {
  return {
    commandName: 'about',
    user: { id: 'user123', tag: 'TestUser#0001' },
    guild: { id: 'guild123' },
    guildId: 'guild123',
    channelId: 'channel123',
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
    localizationManager: {},
    settingsManager: {},
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

describe('About Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Command Data', () => {
    it('should have correct command name', () => {
      expect(aboutCommand.data.name).toBe('about');
    });

    it('should have description', () => {
      expect(aboutCommand.data.description).toBe('About this bot, credits, and asset sources.');
    });

    it('should have Chinese localization', () => {
      const descLocalizations = aboutCommand.data.toJSON().description_localizations;
      expect(descLocalizations?.['zh-TW']).toBe('關於此機器人、製作人員與素材來源。');
    });
  });

  describe('execute()', () => {
    it('should return early if not chat input command', async () => {
      const interaction = createMockInteraction({
        isChatInputCommand: () => false,
      });
      const client = createMockClient();
      const services = createMockServices();

      await aboutCommand.execute(
        interaction as any,
        client as any,
        services as any,
        {} as any
      );

      expect(mockDeferReply).not.toHaveBeenCalled();
    });

    it('should defer reply on execute', async () => {
      const interaction = createMockInteraction();
      const client = createMockClient();
      const services = createMockServices();

      await aboutCommand.execute(
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

      await aboutCommand.execute(
        interaction as any,
        client as any,
        services as any,
        {} as any
      );

      expect(mockDeferReply).not.toHaveBeenCalled();
    });

    it('should edit reply with container component', async () => {
      const interaction = createMockInteraction();
      const client = createMockClient();
      const services = createMockServices();

      await aboutCommand.execute(
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

    it('should include action buttons for links', async () => {
      const interaction = createMockInteraction();
      const client = createMockClient();
      const services = createMockServices();

      await aboutCommand.execute(
        interaction as any,
        client as any,
        services as any,
        {} as any
      );

      const editReplyCall = mockEditReply.mock.calls[0][0];
      expect(editReplyCall.components.length).toBeGreaterThan(0);
    });

    it('should use Components V2 flag', async () => {
      const interaction = createMockInteraction();
      const client = createMockClient();
      const services = createMockServices();

      await aboutCommand.execute(
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
  });
});
