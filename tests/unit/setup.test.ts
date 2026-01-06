/**
 * 測試環境驗證
 *
 * 這個測試檔案用於驗證測試基礎設施是否正確設定。
 * 如果所有測試都通過，表示 Vitest 環境已正確配置。
 */

import { describe, it, expect, vi } from 'vitest';

describe('測試環境驗證', () => {
  describe('Vitest 基本功能', () => {
    it('should run basic assertions', () => {
      expect(1 + 1).toBe(2);
      expect('hello').toContain('ell');
      expect([1, 2, 3]).toHaveLength(3);
    });

    it('should handle async/await', async () => {
      const asyncFn = async () => 'async result';
      const result = await asyncFn();
      expect(result).toBe('async result');
    });

    it('should support mocking with vi', () => {
      const mockFn = vi.fn().mockReturnValue('mocked');
      expect(mockFn()).toBe('mocked');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Discord Mocks', () => {
    it('should import discord mocks without error', async () => {
      const { createMockUser, createMockGuild } = await import(
        '../helpers/discord-mocks.js'
      );

      const user = createMockUser({ id: 'test-user', username: 'TestUser' });
      expect(user.id).toBe('test-user');
      expect(user.username).toBe('TestUser');

      const guild = createMockGuild({ id: 'test-guild', name: 'Test Guild' });
      expect(guild.id).toBe('test-guild');
      expect(guild.name).toBe('Test Guild');
    });

    it('should create mock interactions', async () => {
      const { createMockButtonInteraction } = await import(
        '../helpers/discord-mocks.js'
      );

      const interaction = createMockButtonInteraction({
        userId: 'user-123',
        guildId: 'guild-456',
        customId: 'test_button',
      });

      expect(interaction.user.id).toBe('user-123');
      expect(interaction.guildId).toBe('guild-456');
      expect(interaction.customId).toBe('test_button');
    });
  });

  describe('Kysely Mocks', () => {
    it('should import kysely mocks without error', async () => {
      const { createMockKysely } = await import('../helpers/kysely-mocks.js');

      const mockDb = createMockKysely();
      expect(mockDb.selectFrom).toBeDefined();
      expect(mockDb.insertInto).toBeDefined();
      expect(mockDb.updateTable).toBeDefined();
      expect(mockDb.deleteFrom).toBeDefined();
    });

    it('should support chained query builder', async () => {
      const { createMockKysely } = await import('../helpers/kysely-mocks.js');

      const mockDb = createMockKysely();
      mockDb._setResult({ id: 1, name: 'test' });

      // 模擬鏈式呼叫
      const result = await mockDb
        .selectFrom('test_table')
        .selectAll()
        .where('id', '=', 1)
        .executeTakeFirst();

      expect(result).toEqual({ id: 1, name: 'test' });
    });
  });

  describe('Redis Mocks', () => {
    it('should import redis mocks without error', async () => {
      const { createMockRedisClient } = await import(
        '../helpers/redis-mocks.js'
      );

      const mockRedis = createMockRedisClient();
      expect(mockRedis.get).toBeDefined();
      expect(mockRedis.set).toBeDefined();
      expect(mockRedis.del).toBeDefined();
    });

    it('should support in-memory operations', async () => {
      const { createMockRedisClient } = await import(
        '../helpers/redis-mocks.js'
      );

      const mockRedis = createMockRedisClient();

      await mockRedis.set('test-key', 'test-value');
      const value = await mockRedis.get('test-key');
      expect(value).toBe('test-value');

      await mockRedis.del('test-key');
      const deletedValue = await mockRedis.get('test-key');
      expect(deletedValue).toBeNull();
    });
  });

  describe('Fixtures', () => {
    it('should import ticket fixtures without error', async () => {
      const { FIXTURE_OPEN_TICKET, createTicketFixture } = await import(
        '../fixtures/tickets.js'
      );

      expect(FIXTURE_OPEN_TICKET).toBeDefined();
      expect(FIXTURE_OPEN_TICKET.status).toBe('OPEN');

      const customTicket = createTicketFixture({ ownerId: 'custom-owner' });
      expect(customTicket.ownerId).toBe('custom-owner');
    });

    it('should import guild settings fixtures without error', async () => {
      const { FIXTURE_COMPLETE_SETTINGS, createSettingsFixture } = await import(
        '../fixtures/guild-settings.js'
      );

      expect(FIXTURE_COMPLETE_SETTINGS).toBeDefined();
      expect(FIXTURE_COMPLETE_SETTINGS.guildId).toBeDefined();

      const customSettings = createSettingsFixture({
        staffRoleId: 'custom-role',
      });
      expect(customSettings.staffRoleId).toBe('custom-role');
    });
  });
});
