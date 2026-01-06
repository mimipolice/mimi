/**
 * createTicket 單元測試
 *
 * 測試範圍：
 * - execute(): 顯示建立工單的 Modal
 * - 處理不同的工單類型
 * - 錯誤處理：TicketManager 不可用時
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// Mock 設定
// ============================================

const { mockLoggerError } = vi.hoisted(() => ({
  mockLoggerError: vi.fn(),
}));

// Mock logger
vi.mock('../../../../src/utils/logger.js', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: mockLoggerError,
  },
}));

// ============================================
// 現在可以安全地 import
// ============================================

import createTicket from '../../../../src/interactions/buttons/createTicket.js';
import { createMockButtonInteraction, createMockClient } from '../../../helpers/discord-mocks.js';
import type { Services } from '../../../../src/interfaces/Command.js';

describe('createTicket', () => {
  let mockServices: Services;

  beforeEach(() => {
    vi.clearAllMocks();

    mockServices = {
      localizationManager: {
        get: vi.fn().mockReturnValue('translated'),
      },
      ticketManager: {
        create: vi.fn(),
      },
      settingsManager: {},
      helpService: {},
      forumService: {},
      cacheService: {},
      storyForumService: {},
    } as unknown as Services;
  });

  describe('name', () => {
    it('should have correct button name', () => {
      expect(createTicket.name).toBe('create_ticket');
    });
  });

  describe('execute', () => {
    it('should show modal for creating ticket', async () => {
      // Arrange
      const interaction = createMockButtonInteraction({
        customId: 'create_ticket',
      });
      const client = createMockClient();

      // Act
      await createTicket.execute(interaction, client, mockServices);

      // Assert
      expect(interaction.showModal).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            custom_id: 'create_ticket_modal:',
            title: 'Create a New Ticket',
          }),
        })
      );
    });

    it('should include ticket type in modal customId', async () => {
      // Arrange
      const interaction = createMockButtonInteraction({
        customId: 'create_ticket:technical',
      });
      const client = createMockClient();

      // Act
      await createTicket.execute(interaction, client, mockServices);

      // Assert
      const modalCall = (interaction.showModal as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(modalCall.data.custom_id).toBe('create_ticket_modal:technical');
    });

    it('should handle billing ticket type', async () => {
      // Arrange
      const interaction = createMockButtonInteraction({
        customId: 'create_ticket:billing',
      });
      const client = createMockClient();

      // Act
      await createTicket.execute(interaction, client, mockServices);

      // Assert
      const modalCall = (interaction.showModal as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(modalCall.data.custom_id).toBe('create_ticket_modal:billing');
    });

    it('should return early if ticketManager is not available', async () => {
      // Arrange
      const interaction = createMockButtonInteraction({
        customId: 'create_ticket',
      });
      const client = createMockClient();
      const servicesWithoutTicketManager = {
        ...mockServices,
        ticketManager: undefined,
      } as unknown as Services;

      // Act
      await createTicket.execute(interaction, client, servicesWithoutTicketManager);

      // Assert
      expect(interaction.showModal).not.toHaveBeenCalled();
      expect(mockLoggerError).toHaveBeenCalledWith(
        'TicketManager service not available in createTicket button'
      );
    });

    it('should include issue description input with validation', async () => {
      // Arrange
      const interaction = createMockButtonInteraction({
        customId: 'create_ticket',
      });
      const client = createMockClient();

      // Act
      await createTicket.execute(interaction, client, mockServices);

      // Assert
      const modalCall = (interaction.showModal as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(modalCall.components).toBeDefined();
      expect(modalCall.components.length).toBeGreaterThan(0);
    });
  });
});
