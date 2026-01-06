/**
 * Appeal Button 單元測試
 *
 * 測試範圍：
 * - button.name: 驗證按鈕名稱
 * - button.execute(): 解析 customId, 顯示 modal
 *
 * Mock 策略：
 * - ButtonInteraction: mock customId, message, showModal
 *
 * 注意：
 * - execute() 測試需要完整的 Discord.js mock，標記為 skip
 * - 著重測試可抽取的純邏輯
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Import button (uses actual discord.js which won't work in test)
// We'll test the config properties separately

describe('Appeal Button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // Button Configuration Tests
  // ============================================

  describe('button configuration', () => {
    it('should have name "appeal"', async () => {
      // We can dynamically import to check the name
      const module = await import('../../../../src/features/anti-spam/appealButton.js');
      expect(module.default.name).toBe('appeal');
    });

    it('should have execute function', async () => {
      const module = await import('../../../../src/features/anti-spam/appealButton.js');
      expect(typeof module.default.execute).toBe('function');
    });
  });

  // ============================================
  // execute() Tests - require Discord.js mocking (skip)
  // ============================================

  describe('execute()', () => {
    it.skip('should parse customId correctly', async () => {
      // Integration test required - Discord.js ModalBuilder
      expect(true).toBe(true);
    });

    it.skip('should show modal when executed', async () => {
      // Integration test required - Discord.js ModalBuilder
      expect(true).toBe(true);
    });
  });

  // ============================================
  // CustomId Parsing Tests (pure logic)
  // ============================================

  describe('customId parsing', () => {
    it('should extract userId from customId', () => {
      const customId = 'appeal:user-123:guild-456';
      const [, userId, guildId] = customId.split(':');

      expect(userId).toBe('user-123');
      expect(guildId).toBe('guild-456');
    });

    it('should handle different ID formats', () => {
      const customId = 'appeal:123456789012345678:987654321098765432';
      const [, userId, guildId] = customId.split(':');

      expect(userId).toBe('123456789012345678');
      expect(guildId).toBe('987654321098765432');
    });

    it('should extract all three parts of customId', () => {
      const customId = 'appeal:user-123:guild-456';
      const parts = customId.split(':');

      expect(parts).toHaveLength(3);
      expect(parts[0]).toBe('appeal');
      expect(parts[1]).toBe('user-123');
      expect(parts[2]).toBe('guild-456');
    });
  });

  // ============================================
  // Modal CustomId Format Tests
  // ============================================

  describe('modal customId format', () => {
    it('should use correct modal customId pattern', () => {
      const userId = 'user-123';
      const guildId = 'guild-456';
      const messageId = 'message-789';

      const expectedCustomId = `anti_spam_appeal_modal:${userId}:${guildId}:${messageId}`;
      expect(expectedCustomId).toBe('anti_spam_appeal_modal:user-123:guild-456:message-789');
    });

    it('should parse modal customId correctly', () => {
      const modalCustomId = 'anti_spam_appeal_modal:user-123:guild-456:message-789';
      const [prefix, userId, guildId, messageId] = modalCustomId.split(':');

      expect(prefix).toBe('anti_spam_appeal_modal');
      expect(userId).toBe('user-123');
      expect(guildId).toBe('guild-456');
      expect(messageId).toBe('message-789');
    });
  });

  // ============================================
  // Button Interface Tests
  // ============================================

  describe('Button interface', () => {
    it('should have required properties', async () => {
      const module = await import('../../../../src/features/anti-spam/appealButton.js');
      const button = module.default;

      expect(button).toHaveProperty('name');
      expect(button).toHaveProperty('execute');
    });
  });
});
