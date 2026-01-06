/**
 * closeTicket 單元測試
 *
 * 測試範圍：
 * - execute(): 顯示關閉工單的 Modal
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// Mock 設定
// ============================================

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

import closeTicket from '../../../../src/interactions/buttons/closeTicket.js';
import { createMockButtonInteraction, createMockClient } from '../../../helpers/discord-mocks.js';
import type { Services } from '../../../../src/interfaces/Command.js';

describe('closeTicket', () => {
  let mockServices: Services;

  beforeEach(() => {
    vi.clearAllMocks();

    mockServices = {
      localizationManager: {
        get: vi.fn().mockReturnValue('translated'),
      },
      ticketManager: {},
      settingsManager: {},
      helpService: {},
      forumService: {},
      cacheService: {},
      storyForumService: {},
    } as unknown as Services;
  });

  describe('name', () => {
    it('should have correct button name', () => {
      expect(closeTicket.name).toBe('close_ticket');
    });
  });

  describe('execute', () => {
    it('should show modal for closing ticket', async () => {
      // Arrange
      const interaction = createMockButtonInteraction({
        customId: 'close_ticket',
      });
      const client = createMockClient();

      // Act
      await closeTicket.execute(interaction, client, mockServices);

      // Assert
      expect(interaction.showModal).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            custom_id: 'close_ticket_modal',
            title: 'Close Ticket',
          }),
        })
      );
    });

    it('should include reason input in modal', async () => {
      // Arrange
      const interaction = createMockButtonInteraction({
        customId: 'close_ticket',
      });
      const client = createMockClient();

      // Act
      await closeTicket.execute(interaction, client, mockServices);

      // Assert
      const modalCall = (interaction.showModal as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(modalCall.components).toBeDefined();
      expect(modalCall.components.length).toBeGreaterThan(0);
    });
  });
});
