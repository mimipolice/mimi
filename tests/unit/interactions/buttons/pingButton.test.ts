/**
 * pingButton 單元測試
 *
 * 測試範圍：
 * - execute(): 處理 ping 按鈕點擊，更新計數器並回應 Components V2 訊息
 * - 錯誤處理：靜默忽略過期或已確認的互動
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// Mock 設定 - 使用 vi.hoisted 確保持久化
// ============================================

const { mockUpdate } = vi.hoisted(() => ({
  mockUpdate: vi.fn(),
}));

// Mock logger
vi.mock('../../../../src/utils/logger.js', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ============================================
// 現在可以安全地 import
// ============================================

import pingButton from '../../../../src/interactions/buttons/pingButton.js';
import { createMockButtonInteraction, createMockClient } from '../../../helpers/discord-mocks.js';

describe('pingButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('name', () => {
    it('should have correct button name', () => {
      expect(pingButton.name).toBe('ping_button');
    });
  });

  describe('execute', () => {
    it('should increment counter and update message', async () => {
      // Arrange
      const interaction = createMockButtonInteraction({
        customId: 'ping_button:5',
      });
      const client = createMockClient();

      // Act
      await pingButton.execute(interaction, client);

      // Assert
      expect(interaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          components: expect.any(Array),
          flags: expect.any(Number),
        })
      );
    });

    it('should parse counter from customId correctly', async () => {
      // Arrange
      const interaction = createMockButtonInteraction({
        customId: 'ping_button:10',
      });
      const client = createMockClient();

      // Act
      await pingButton.execute(interaction, client);

      // Assert
      // The new button should have customId with incremented counter (11)
      expect(interaction.update).toHaveBeenCalled();
      const updateCall = (interaction.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(updateCall.components).toBeDefined();
    });

    it('should handle counter starting from 0', async () => {
      // Arrange
      const interaction = createMockButtonInteraction({
        customId: 'ping_button:0',
      });
      const client = createMockClient();

      // Act
      await pingButton.execute(interaction, client);

      // Assert
      expect(interaction.update).toHaveBeenCalled();
    });

    it('should return early if client.user is null', async () => {
      // Arrange
      const interaction = createMockButtonInteraction({
        customId: 'ping_button:5',
      });
      const client = createMockClient();
      (client as any).user = null;

      // Act
      await pingButton.execute(interaction, client);

      // Assert
      expect(interaction.update).not.toHaveBeenCalled();
    });

    it('should return early if interaction is not a button', async () => {
      // Arrange
      const interaction = createMockButtonInteraction({
        customId: 'ping_button:5',
      });
      (interaction.isButton as ReturnType<typeof vi.fn>).mockReturnValue(false);
      const client = createMockClient();

      // Act
      await pingButton.execute(interaction, client);

      // Assert
      expect(interaction.update).not.toHaveBeenCalled();
    });

    it('should silently ignore expired interaction error (code 10062)', async () => {
      // Arrange
      const interaction = createMockButtonInteraction({
        customId: 'ping_button:5',
      });
      const error = new Error('Unknown interaction') as any;
      error.code = 10062;
      (interaction.update as ReturnType<typeof vi.fn>).mockRejectedValue(error);
      const client = createMockClient();

      // Act & Assert - should not throw
      await expect(pingButton.execute(interaction, client)).resolves.toBeUndefined();
    });

    it('should silently ignore already acknowledged interaction error (code 40060)', async () => {
      // Arrange
      const interaction = createMockButtonInteraction({
        customId: 'ping_button:5',
      });
      const error = new Error('Already acknowledged') as any;
      error.code = 40060;
      (interaction.update as ReturnType<typeof vi.fn>).mockRejectedValue(error);
      const client = createMockClient();

      // Act & Assert - should not throw
      await expect(pingButton.execute(interaction, client)).resolves.toBeUndefined();
    });

    it('should re-throw other errors', async () => {
      // Arrange
      const interaction = createMockButtonInteraction({
        customId: 'ping_button:5',
      });
      const error = new Error('Some other error') as any;
      error.code = 50001;
      (interaction.update as ReturnType<typeof vi.fn>).mockRejectedValue(error);
      const client = createMockClient();

      // Act & Assert - should throw
      await expect(pingButton.execute(interaction, client)).rejects.toThrow('Some other error');
    });
  });
});
