/**
 * errorHandler 單元測試
 *
 * 測試範圍：
 * - sendErrorResponse(): 根據 interaction 狀態發送錯誤訊息
 * - handleInteractionError(): 錯誤分類與處理
 * - handleClientError(): 客戶端錯誤處理
 * - handleClientWarning(): 客戶端警告處理
 *
 * Mock 策略：
 * - Discord Interaction: mock isRepliable, replied, deferred, reply, editReply, followUp
 * - LocalizationManager: mock get 方法
 * - Logger: mock 所有日誌方法
 * - 自定義錯誤類別: 使用真實的錯誤類別
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DiscordAPIError, MessageFlags } from 'discord.js';

// ============================================
// Mock 設定 - 使用 vi.hoisted 確保持久化
// ============================================

const {
  mockLoggerDebug,
  mockLoggerInfo,
  mockLoggerWarn,
  mockLoggerError,
  mockLocalizationGet,
  mockCreateMissingPermissionsReply,
  mockCreateBusinessErrorReply,
  mockCreateCheckFailureReply,
  mockCreateCooldownReply,
  mockCreateInternalErrorReply,
  mockCreateAutoModBlockedReply,
  mockCreateDiscordErrorReply,
} = vi.hoisted(() => ({
  mockLoggerDebug: vi.fn(),
  mockLoggerInfo: vi.fn(),
  mockLoggerWarn: vi.fn(),
  mockLoggerError: vi.fn(),
  mockLocalizationGet: vi.fn(),
  mockCreateMissingPermissionsReply: vi.fn(),
  mockCreateBusinessErrorReply: vi.fn(),
  mockCreateCheckFailureReply: vi.fn(),
  mockCreateCooldownReply: vi.fn(),
  mockCreateInternalErrorReply: vi.fn(),
  mockCreateAutoModBlockedReply: vi.fn(),
  mockCreateDiscordErrorReply: vi.fn(),
}));

// Mock logger
vi.mock('../../../src/utils/logger.js', () => ({
  default: {
    debug: mockLoggerDebug,
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    error: mockLoggerError,
  },
}));

// Mock interactionReply utilities
vi.mock('../../../src/utils/interactionReply.js', () => ({
  createMissingPermissionsReply: mockCreateMissingPermissionsReply,
  createUnauthorizedReply: vi.fn().mockReturnValue({ content: 'Unauthorized' }),
  createBusinessErrorReply: mockCreateBusinessErrorReply,
  createCheckFailureReply: mockCreateCheckFailureReply,
  createCooldownReply: mockCreateCooldownReply,
  createInternalErrorReply: mockCreateInternalErrorReply,
  createAutoModBlockedReply: mockCreateAutoModBlockedReply,
  createDiscordErrorReply: mockCreateDiscordErrorReply,
}));

// ============================================
// 現在可以安全地 import
// ============================================

import {
  sendErrorResponse,
  handleInteractionError,
  handleClientError,
  handleClientWarning,
} from '../../../src/utils/errorHandler.js';
import {
  BusinessError,
  CooldownError,
  CustomCheckError,
  MissingPermissionsError,
} from '../../../src/errors/index.js';

// ============================================
// 測試輔助函數
// ============================================

function createMockInteraction(options: {
  isRepliable?: boolean;
  replied?: boolean;
  deferred?: boolean;
  isCommand?: boolean;
  commandName?: string;
  isMessageComponent?: boolean;
  isModalSubmit?: boolean;
  customId?: string;
} = {}) {
  const mockReply = vi.fn().mockResolvedValue(undefined);
  const mockEditReply = vi.fn().mockResolvedValue(undefined);
  const mockFollowUp = vi.fn().mockResolvedValue(undefined);

  return {
    isRepliable: vi.fn().mockReturnValue(options.isRepliable ?? true),
    replied: options.replied ?? false,
    deferred: options.deferred ?? false,
    isCommand: vi.fn().mockReturnValue(options.isCommand ?? true),
    commandName: options.commandName ?? 'test-command',
    isMessageComponent: vi.fn().mockReturnValue(options.isMessageComponent ?? false),
    isModalSubmit: vi.fn().mockReturnValue(options.isModalSubmit ?? false),
    customId: options.customId ?? 'test-custom-id',
    reply: mockReply,
    editReply: mockEditReply,
    followUp: mockFollowUp,
    user: {
      id: 'user-123',
      tag: 'TestUser#1234',
    },
    guildId: 'guild-123',
    channelId: 'channel-123',
  };
}

function createMockClient() {
  return {
    user: {
      id: 'bot-123',
      tag: 'TestBot#0001',
    },
  };
}

function createMockServices() {
  return {
    localizationManager: {
      get: mockLocalizationGet,
    },
  };
}

describe('errorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // 設定預設 mock 回傳值
    mockCreateMissingPermissionsReply.mockReturnValue({ content: 'Missing permissions' });
    mockCreateBusinessErrorReply.mockReturnValue({ content: 'Business error' });
    mockCreateCheckFailureReply.mockReturnValue({ content: 'Check failed' });
    mockCreateCooldownReply.mockReturnValue({ content: 'On cooldown' });
    mockCreateInternalErrorReply.mockReturnValue({ content: 'Internal error' });
    mockCreateAutoModBlockedReply.mockReturnValue({ content: 'AutoMod blocked' });
    mockCreateDiscordErrorReply.mockReturnValue({ content: 'Discord error' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================
  // sendErrorResponse() 測試
  // ============================================

  describe('sendErrorResponse()', () => {
    it('should use reply when interaction not replied or deferred', async () => {
      // Arrange
      const interaction = createMockInteraction({
        replied: false,
        deferred: false,
      });
      const payload = { content: 'Error message' };

      // Act
      await sendErrorResponse(interaction as any, payload);

      // Assert
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Error message',
          flags: MessageFlags.Ephemeral,
        })
      );
      expect(interaction.editReply).not.toHaveBeenCalled();
      expect(interaction.followUp).not.toHaveBeenCalled();
    });

    it('should use editReply when interaction is deferred', async () => {
      // Arrange
      const interaction = createMockInteraction({
        replied: false,
        deferred: true,
      });
      const payload = { content: 'Error message' };

      // Act
      await sendErrorResponse(interaction as any, payload);

      // Assert
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Error message',
        })
      );
      expect(interaction.reply).not.toHaveBeenCalled();
      expect(interaction.followUp).not.toHaveBeenCalled();
    });

    it('should use followUp when interaction already replied', async () => {
      // Arrange
      const interaction = createMockInteraction({
        replied: true,
        deferred: false,
      });
      const payload = { content: 'Error message' };

      // Act
      await sendErrorResponse(interaction as any, payload);

      // Assert
      expect(interaction.followUp).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Error message',
          flags: MessageFlags.Ephemeral,
        })
      );
      expect(interaction.reply).not.toHaveBeenCalled();
      expect(interaction.editReply).not.toHaveBeenCalled();
    });

    it('should skip response when interaction is not repliable', async () => {
      // Arrange
      const interaction = createMockInteraction({
        isRepliable: false,
      });
      const payload = { content: 'Error message' };

      // Act
      await sendErrorResponse(interaction as any, payload);

      // Assert
      expect(interaction.reply).not.toHaveBeenCalled();
      expect(interaction.editReply).not.toHaveBeenCalled();
      expect(interaction.followUp).not.toHaveBeenCalled();
      expect(mockLoggerDebug).toHaveBeenCalledWith(
        expect.stringContaining('not repliable')
      );
    });

    it('should not add ephemeral flag when ephemeral is false', async () => {
      // Arrange
      const interaction = createMockInteraction();
      const payload = { content: 'Error message' };

      // Act
      await sendErrorResponse(interaction as any, payload, false);

      // Assert
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Error message',
        })
      );
      // Check that flags does not include Ephemeral
      const callArgs = interaction.reply.mock.calls[0][0];
      expect(callArgs.flags).toBeUndefined();
    });

    it('should preserve existing flags when adding ephemeral', async () => {
      // Arrange
      const interaction = createMockInteraction();
      const payload = {
        content: 'Error message',
        flags: [MessageFlags.IsComponentsV2],
      };

      // Act
      await sendErrorResponse(interaction as any, payload);

      // Assert
      expect(interaction.reply).toHaveBeenCalled();
      const callArgs = interaction.reply.mock.calls[0][0];
      expect(callArgs.flags).toContain(MessageFlags.Ephemeral);
      expect(callArgs.flags).toContain(MessageFlags.IsComponentsV2);
    });

    it('should handle unknown interaction error gracefully', async () => {
      // Arrange
      const interaction = createMockInteraction();
      const error = new Error('Unknown Interaction') as any;
      error.code = 10062; // UNKNOWN_INTERACTION
      interaction.reply.mockRejectedValue(error);
      const payload = { content: 'Error message' };

      // Act
      await sendErrorResponse(interaction as any, payload);

      // Assert
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.stringContaining('Interaction expired')
      );
    });

    it('should handle already acknowledged error gracefully', async () => {
      // Arrange
      const interaction = createMockInteraction();
      const error = new Error('Already acknowledged') as any;
      error.code = 40060; // INTERACTION_ALREADY_ACKNOWLEDGED
      interaction.reply.mockRejectedValue(error);
      const payload = { content: 'Error message' };

      // Act
      await sendErrorResponse(interaction as any, payload);

      // Assert
      expect(mockLoggerDebug).toHaveBeenCalledWith(
        expect.stringContaining('already acknowledged')
      );
    });
  });

  // ============================================
  // handleInteractionError() 測試
  // ============================================

  describe('handleInteractionError()', () => {
    it('should handle CustomCheckError', async () => {
      // Arrange
      const interaction = createMockInteraction();
      const error = new CustomCheckError('Custom check failed');
      const client = createMockClient();
      const services = createMockServices();

      // Act
      await handleInteractionError(interaction as any, error, client as any, services as any);

      // Assert
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.stringContaining('Command check failed')
      );
      expect(mockCreateCheckFailureReply).toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalled();
    });

    it('should handle MissingPermissionsError', async () => {
      // Arrange
      const interaction = createMockInteraction();
      const error = new MissingPermissionsError('No permissions');
      const client = createMockClient();
      const services = createMockServices();

      // Act
      await handleInteractionError(interaction as any, error, client as any, services as any);

      // Assert
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.stringContaining('Permission check failed')
      );
      expect(mockCreateMissingPermissionsReply).toHaveBeenCalled();
    });

    it('should handle CooldownError', async () => {
      // Arrange
      const interaction = createMockInteraction();
      const error = new CooldownError('On cooldown', 5.5);
      const client = createMockClient();
      const services = createMockServices();

      // Act
      await handleInteractionError(interaction as any, error, client as any, services as any);

      // Assert
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.stringContaining('on cooldown')
      );
      expect(mockCreateCooldownReply).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        5.5
      );
    });

    it('should handle BusinessError', async () => {
      // Arrange
      const interaction = createMockInteraction();
      const error = new BusinessError('Business logic failed');
      const client = createMockClient();
      const services = createMockServices();

      // Act
      await handleInteractionError(interaction as any, error, client as any, services as any);

      // Assert
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining('Business logic error')
      );
      expect(mockCreateBusinessErrorReply).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'Business logic failed'
      );
    });

    it('should handle DiscordAPIError with 403 status', async () => {
      // Arrange
      const interaction = createMockInteraction();
      // Create a mock DiscordAPIError
      const error = Object.assign(new Error('Missing Permissions'), {
        name: 'DiscordAPIError',
        status: 403,
        code: 50013,
      });
      Object.setPrototypeOf(error, DiscordAPIError.prototype);

      const client = createMockClient();
      const services = createMockServices();

      // Act
      await handleInteractionError(interaction as any, error, client as any, services as any);

      // Assert
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining('Permissions Denied')
      );
      expect(mockCreateMissingPermissionsReply).toHaveBeenCalled();
    });

    it('should handle DiscordAPIError with AutoMod message', async () => {
      // Arrange
      const interaction = createMockInteraction();
      const error = Object.assign(new Error('AutoMod blocked this message'), {
        name: 'DiscordAPIError',
        status: 400,
        code: 200000,
      });
      Object.setPrototypeOf(error, DiscordAPIError.prototype);

      const client = createMockClient();
      const services = createMockServices();

      // Act
      await handleInteractionError(interaction as any, error, client as any, services as any);

      // Assert
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.stringContaining('AutoMod Blocked')
      );
      expect(mockCreateAutoModBlockedReply).toHaveBeenCalled();
    });

    it('should handle unknown error as internal error', async () => {
      // Arrange
      const interaction = createMockInteraction();
      const error = new Error('Some unknown error');
      const client = createMockClient();
      const services = createMockServices();

      // Act
      await handleInteractionError(interaction as any, error, client as any, services as any);

      // Assert
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining('Unhandled interaction error'),
        expect.any(Error)
      );
      expect(mockCreateInternalErrorReply).toHaveBeenCalled();
    });

    it('should extract original error from wrapped error', async () => {
      // Arrange
      const interaction = createMockInteraction();
      const originalError = new BusinessError('Original error');
      const wrappedError = { original: originalError };
      const client = createMockClient();
      const services = createMockServices();

      // Act
      await handleInteractionError(interaction as any, wrappedError, client as any, services as any);

      // Assert
      expect(mockCreateBusinessErrorReply).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'Original error'
      );
    });

    it('should handle component interaction with customId', async () => {
      // Arrange
      const interaction = createMockInteraction({
        isCommand: false,
        isMessageComponent: true,
        customId: 'button-click-123',
      });
      const error = new Error('Component error');
      const client = createMockClient();
      const services = createMockServices();

      // Act
      await handleInteractionError(interaction as any, error, client as any, services as any);

      // Assert
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining('Component:button-click-123'),
        expect.any(Error)
      );
    });
  });

  // ============================================
  // handleClientError() 測試
  // ============================================

  describe('handleClientError()', () => {
    it('should log client error', () => {
      // Arrange
      const client = createMockClient();
      const error = new Error('Client disconnected');

      // Act
      handleClientError(client as any, error);

      // Assert
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining('Discord Client Error'),
        error
      );
    });
  });

  // ============================================
  // handleClientWarning() 測試
  // ============================================

  describe('handleClientWarning()', () => {
    it('should log client warning', () => {
      // Arrange
      const client = createMockClient();
      const warning = 'Rate limit approaching';

      // Act
      handleClientWarning(client as any, warning);

      // Assert
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.stringContaining('Discord Client Warning: Rate limit approaching')
      );
    });
  });

  // ============================================
  // 邊界情況測試
  // ============================================

  describe('edge cases', () => {
    it('should handle non-Error objects gracefully', async () => {
      // Arrange
      const interaction = createMockInteraction();
      const error = 'String error message'; // Not an Error object
      const client = createMockClient();
      const services = createMockServices();

      // Act
      await handleInteractionError(interaction as any, error, client as any, services as any);

      // Assert
      expect(mockLoggerError).toHaveBeenCalled();
      expect(mockCreateInternalErrorReply).toHaveBeenCalled();
    });

    it('should throw when null error is passed (edge case bug)', async () => {
      // This test documents actual behavior - the code doesn't handle null errors
      // Arrange
      const interaction = createMockInteraction();
      const error = null;
      const client = createMockClient();
      const services = createMockServices();

      // Act & Assert
      await expect(
        handleInteractionError(interaction as any, error, client as any, services as any)
      ).rejects.toThrow();
    });

    it('should handle interaction without guildId', async () => {
      // Arrange
      const interaction = createMockInteraction();
      (interaction as any).guildId = null;
      const error = new Error('Test error');
      const client = createMockClient();
      const services = createMockServices();

      // Act
      await handleInteractionError(interaction as any, error, client as any, services as any);

      // Assert
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining('Guild: N/A'),
        expect.any(Error)
      );
    });

    it('should handle payload with embeds', async () => {
      // Arrange
      const interaction = createMockInteraction();
      const payload = {
        embeds: [{ description: 'Error details' }],
      };

      // Act
      await sendErrorResponse(interaction as any, payload);

      // Assert
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: [{ description: 'Error details' }],
        })
      );
    });
  });
});
