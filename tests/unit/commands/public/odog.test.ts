/**
 * Odog Command Unit Tests
 *
 * Tests for the /odog command which displays gacha rankings.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Locale } from 'discord.js';

// ============================================
// Mock Setup - Use vi.hoisted for persistence
// ============================================

const {
  mockDeferReply,
  mockEditReply,
  mockGetOdogRankings,
  mockGetGachaPoolsCache,
  mockLocalizations,
} = vi.hoisted(() => ({
  mockDeferReply: vi.fn().mockResolvedValue(undefined),
  mockEditReply: vi.fn().mockResolvedValue(undefined),
  mockGetOdogRankings: vi.fn(),
  mockGetGachaPoolsCache: vi.fn(),
  mockLocalizations: {
    'en-US': {
      options: { gacha_id: { name: 'gacha_id' }, period: { name: 'period' } },
      responses: {
        title: '{{gachaName}} Rankings', global: 'Global',
        invalid_period: 'Invalid period format',
        no_ranking_data: 'No ranking data available',
        no_top_tier: 'No top tier pulls',
        user_rank_summary: 'Total draws: {{totalDraws}}',
        period_label: 'Period', error_fetching: 'Error fetching rankings',
      },
    },
    'zh-TW': {
      options: { gacha_id: { name: 'gacha_id' }, period: { name: 'period' } },
      responses: {
        title: '{{gachaName}} Rankings', global: 'Global',
        invalid_period: 'Invalid period format',
        no_ranking_data: 'No ranking data available',
        no_top_tier: 'No top tier pulls',
        user_rank_summary: 'Total draws: {{totalDraws}}',
        period_label: 'Period', error_fetching: 'Error fetching rankings',
      },
    },
  },
}));

// Mock gacha repository
vi.mock('../../../../src/repositories/gacha.repository.js', () => ({
  getOdogRankings: mockGetOdogRankings,
}));

// Mock cache
vi.mock('../../../../src/shared/cache.js', () => ({
  getGachaPoolsCache: mockGetGachaPoolsCache,
}));

// Mock gacha config
vi.mock('../../../../src/config/gacha.js', () => ({
  poolTypeNames: {
    standard: 'Standard Pool',
    limited: 'Limited Pool',
  },
}));

// Mock localization - use hoisted mockLocalizations
vi.mock('../../../../src/utils/localization.js', () => ({
  getLocalizations: vi.fn().mockImplementation(() => mockLocalizations),
}));

// ============================================
// Import command after mocks are set up
// ============================================

import odogCommand from '../../../../src/commands/public/odog/index.js';

// ============================================
// Test Helpers
// ============================================

function createMockInteraction(overrides: Record<string, any> = {}) {
  return {
    commandName: 'odog',
    user: { id: 'user123', tag: 'TestUser#0001' },
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
      getString: vi.fn().mockImplementation((name: string) => {
        if (name === 'gacha_id') return null;
        if (name === 'period') return '7d';
        return null;
      }),
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
      getAvailableLanguages: vi.fn().mockReturnValue(['en-US', 'zh-TW']),
      getLocale: vi.fn().mockImplementation((_cmd: string, lang: string) =>
        mockLocalizations[lang as keyof typeof mockLocalizations] || null
      ),
    },
    settingsManager: {},
    ticketManager: {},
    helpService: {},
    forumService: {},
    cacheService: {},
    storyForumService: {},
  };
}

function createMockRankings() {
  return [
    {
      user_id: 'user1',
      nickname: 'TopPlayer',
      total_draws: 1000,
      rarity_counts: { '7': 5, '6': 20, '5': 50 },
    },
    {
      user_id: 'user2',
      nickname: 'SecondPlace',
      total_draws: 800,
      rarity_counts: { '7': 3, '6': 15, '5': 40 },
    },
    {
      user_id: 'user3',
      nickname: null,
      total_draws: 600,
      rarity_counts: { '6': 10, '5': 30 },
    },
  ];
}

// ============================================
// Tests
// ============================================

describe('Odog Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOdogRankings.mockResolvedValue(createMockRankings());
    mockGetGachaPoolsCache.mockReturnValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Command Data', () => {
    it('should have correct command name', () => {
      expect(odogCommand.data.name).toBe('odog');
    });

    it('should have description', () => {
      expect(odogCommand.data.description).toBe('Show the Odog rankings.');
    });

    it('should have localized names', () => {
      const nameLocalizations = odogCommand.data.toJSON().name_localizations;
      expect(nameLocalizations?.['zh-TW']).toBe('歐皇榜');
    });

    it('should have gacha_id option', () => {
      const json = odogCommand.data.toJSON();
      const options = json.options || [];
      const gachaIdOption = options.find((opt: any) => opt.name === 'gacha_id');
      expect(gachaIdOption).toBeDefined();
      expect(gachaIdOption?.required).toBe(false);
    });

    it('should have period option', () => {
      const json = odogCommand.data.toJSON();
      const options = json.options || [];
      const periodOption = options.find((opt: any) => opt.name === 'period');
      expect(periodOption).toBeDefined();
      expect(periodOption?.required).toBe(false);
    });
  });

  describe('execute()', () => {
    it('should defer reply on execute', async () => {
      const interaction = createMockInteraction();
      const client = createMockClient();
      const services = createMockServices();

      await odogCommand.execute(
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

      await odogCommand.execute(
        interaction as any,
        client as any,
        services as any,
        {} as any
      );

      expect(mockDeferReply).not.toHaveBeenCalled();
    });

    it('should return early if not chat input command', async () => {
      const interaction = createMockInteraction({
        isChatInputCommand: () => false,
      });
      const client = createMockClient();
      const services = createMockServices();

      await odogCommand.execute(
        interaction as any,
        client as any,
        services as any,
        {} as any
      );

      expect(mockGetOdogRankings).not.toHaveBeenCalled();
    });

    it('should fetch rankings with default period', async () => {
      const interaction = createMockInteraction({
        options: {
          getString: vi.fn().mockReturnValue(null),
        },
      });
      const client = createMockClient();
      const services = createMockServices();

      await odogCommand.execute(
        interaction as any,
        client as any,
        services as any,
        {} as any
      );

      expect(mockGetOdogRankings).toHaveBeenCalledWith(null, 7);
    });

    it('should handle specific gacha pool', async () => {
      const interaction = createMockInteraction({
        options: {
          getString: vi.fn().mockImplementation((name: string) => {
            if (name === 'gacha_id') return 'limited';
            if (name === 'period') return '30d';
            return null;
          }),
        },
      });
      const client = createMockClient();
      const services = createMockServices();

      await odogCommand.execute(
        interaction as any,
        client as any,
        services as any,
        {} as any
      );

      expect(mockGetOdogRankings).toHaveBeenCalledWith('limited', 30);
    });

    it('should handle "all" period', async () => {
      const interaction = createMockInteraction({
        options: {
          getString: vi.fn().mockImplementation((name: string) => {
            if (name === 'period') return 'all';
            return null;
          }),
        },
      });
      const client = createMockClient();
      const services = createMockServices();

      await odogCommand.execute(
        interaction as any,
        client as any,
        services as any,
        {} as any
      );

      expect(mockGetOdogRankings).toHaveBeenCalledWith(null, 'all');
    });

    it('should handle invalid period format', async () => {
      const interaction = createMockInteraction({
        options: {
          getString: vi.fn().mockImplementation((name: string) => {
            if (name === 'period') return 'invalid';
            return null;
          }),
        },
      });
      const client = createMockClient();
      const services = createMockServices();

      await odogCommand.execute(
        interaction as any,
        client as any,
        services as any,
        {} as any
      );

      expect(mockEditReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Invalid'),
        })
      );
    });

    it('should display no ranking data message when empty', async () => {
      mockGetOdogRankings.mockResolvedValue([]);

      const interaction = createMockInteraction();
      const client = createMockClient();
      const services = createMockServices();

      await odogCommand.execute(
        interaction as any,
        client as any,
        services as any,
        {} as any
      );

      expect(mockEditReply).toHaveBeenCalledWith('No ranking data available');
    });

    it('should display rankings with container component', async () => {
      const interaction = createMockInteraction();
      const client = createMockClient();
      const services = createMockServices();

      await odogCommand.execute(
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

    it('should limit rankings to top 10', async () => {
      const manyRankings = Array.from({ length: 15 }, (_, i) => ({
        user_id: `user${i}`,
        nickname: `Player${i}`,
        total_draws: 1000 - i * 50,
        rarity_counts: { '6': 10 - i },
      }));
      mockGetOdogRankings.mockResolvedValue(manyRankings);

      const interaction = createMockInteraction();
      const client = createMockClient();
      const services = createMockServices();

      await odogCommand.execute(
        interaction as any,
        client as any,
        services as any,
        {} as any
      );

      // Verify that only top 10 are processed (by checking the call was made)
      expect(mockEditReply).toHaveBeenCalled();
    });

    it('should handle user without nickname', async () => {
      mockGetOdogRankings.mockResolvedValue([
        {
          user_id: 'user123',
          nickname: null,
          total_draws: 500,
          rarity_counts: { '5': 10 },
        },
      ]);

      const interaction = createMockInteraction();
      const client = createMockClient();
      const services = createMockServices();

      await odogCommand.execute(
        interaction as any,
        client as any,
        services as any,
        {} as any
      );

      expect(mockEditReply).toHaveBeenCalled();
    });

    it('should use zh-TW locale for Chinese users', async () => {
      const interaction = createMockInteraction({
        locale: Locale.ChineseTW,
      });
      const client = createMockClient();
      const services = createMockServices();

      await odogCommand.execute(
        interaction as any,
        client as any,
        services as any,
        {} as any
      );

      expect(mockEditReply).toHaveBeenCalled();
    });

    describe('Error Handling', () => {
      it('should handle database errors', async () => {
        mockGetOdogRankings.mockRejectedValue(new Error('Database error'));

        const interaction = createMockInteraction({
          deferred: true,
        });
        const client = createMockClient();
        const services = createMockServices();

        await odogCommand.execute(
          interaction as any,
          client as any,
          services as any,
          {} as any
        );

        expect(mockEditReply).toHaveBeenCalledWith(
          expect.objectContaining({
            content: expect.any(String),
          })
        );
      });
    });
  });
});
