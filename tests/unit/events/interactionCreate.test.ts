/**
 * interactionCreate.ts Event Handler Unit Tests
 *
 * This is the CORE router for all Discord interactions.
 *
 * Test Coverage:
 * - Distributed lock acquisition/release
 * - Command routing (ChatInputCommand, ContextMenuCommand)
 * - Button routing (regular buttons, report buttons)
 * - Modal routing
 * - Select menu routing
 * - Autocomplete handling
 * - Help interaction delegation
 * - Error handling
 * - Success recording
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Collection } from 'discord.js';

// ============================================
// Mock Setup - Using vi.hoisted for persistence
// ============================================

const {
  mockLoggerDebug,
  mockLoggerWarn,
  mockLoggerError,
  mockRedisSet,
  mockRedisEval,
  mockRedisClient,
  mockEnsureRedisConnected,
  mockHandleInteractionError,
  mockRecordSuccessfulCommand,
  mockWithRetry,
  mockHandleHelpInteraction,
  mockReportViewExecute,
} = vi.hoisted(() => {
  const redisClient = {
    set: vi.fn(),
    eval: vi.fn(),
  };
  return {
    mockLoggerDebug: vi.fn(),
    mockLoggerWarn: vi.fn(),
    mockLoggerError: vi.fn(),
    mockRedisSet: redisClient.set,
    mockRedisEval: redisClient.eval,
    mockRedisClient: redisClient,
    mockEnsureRedisConnected: vi.fn(),
    mockHandleInteractionError: vi.fn(),
    mockRecordSuccessfulCommand: vi.fn(),
    mockWithRetry: vi.fn().mockImplementation((fn: Function) => fn()),
    mockHandleHelpInteraction: vi.fn(),
    mockReportViewExecute: vi.fn(),
  };
});

// Mock logger
vi.mock('../../../src/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: mockLoggerWarn,
    error: mockLoggerError,
    debug: mockLoggerDebug,
  },
}));

// Mock Redis
vi.mock('../../../src/shared/redis.js', () => ({
  ensureRedisConnected: mockEnsureRedisConnected,
}));

// Mock errorHandler
vi.mock('../../../src/utils/errorHandler.js', () => ({
  errorHandler: {
    handleInteractionError: mockHandleInteractionError,
    recordSuccessfulCommand: mockRecordSuccessfulCommand,
  },
}));

// Mock withRetry
vi.mock('../../../src/utils/withRetry.js', () => ({
  withRetry: mockWithRetry,
}));

// Mock helpInteractionHandler
vi.mock('../../../src/events/handlers/helpInteractionHandler.js', () => ({
  handleHelpInteraction: mockHandleHelpInteraction,
}));

// Mock reportViewHandler
vi.mock('../../../src/interactions/buttons/reportView.js', () => ({
  default: {
    execute: mockReportViewExecute,
  },
}));

// ============================================
// Import after mocks are set up
// ============================================

import { name, execute } from '../../../src/events/interactionCreate.js';

// ============================================
// Test Helpers
// ============================================

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

function createMockDatabases() {
  return {
    gachaDb: {},
    ticketDb: {},
  };
}

function createMockClient(options: {
  commands?: Map<string, any>;
  buttons?: Array<{ name: string | RegExp; execute: Function }>;
  modals?: Array<{ name: string; execute: Function }>;
  selectMenus?: Array<{ name: string | RegExp; execute: Function }>;
} = {}) {
  return {
    commands: options.commands ?? new Map(),
    buttons: options.buttons ?? [],
    modals: options.modals ?? [],
    selectMenus: options.selectMenus ?? [],
  };
}

function createMockInteraction(type: string, options: any = {}) {
  const base = {
    id: options.id ?? 'interaction-123',
    type: 2, // APPLICATION_COMMAND
    user: { tag: 'TestUser#1234', id: 'user-123' },
    guildId: 'guild-123',
    channelId: 'channel-123',
    customId: options.customId ?? 'test-custom-id',
    commandName: options.commandName ?? 'test-command',
    isMessageComponent: vi.fn().mockReturnValue(type === 'button' || type === 'selectMenu'),
    isChatInputCommand: vi.fn().mockReturnValue(type === 'chatInput'),
    isContextMenuCommand: vi.fn().mockReturnValue(type === 'contextMenu'),
    isButton: vi.fn().mockReturnValue(type === 'button'),
    isModalSubmit: vi.fn().mockReturnValue(type === 'modal'),
    isStringSelectMenu: vi.fn().mockReturnValue(type === 'selectMenu'),
    isAutocomplete: vi.fn().mockReturnValue(type === 'autocomplete'),
  };

  return base;
}

describe('interactionCreate event', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedisSet.mockResolvedValue('OK');
    mockRedisEval.mockResolvedValue(1);
    mockEnsureRedisConnected.mockResolvedValue(mockRedisClient);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================
  // Event Metadata Tests
  // ============================================

  describe('event metadata', () => {
    it('should have correct event name', () => {
      expect(name).toBe('interactionCreate');
    });
  });

  // ============================================
  // Distributed Lock Tests
  // ============================================

  describe('distributed locking', () => {
    it('should acquire lock before processing interaction', async () => {
      // Arrange
      const mockCommand = { execute: vi.fn().mockResolvedValue(undefined) };
      const client = createMockClient({
        commands: new Map([['test-command', mockCommand]]),
      });
      const interaction = createMockInteraction('chatInput');
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await execute(interaction as any, client as any, services as any, databases as any);

      // Assert
      expect(mockRedisSet).toHaveBeenCalledWith(
        `interaction:lock:${interaction.id}`,
        expect.any(String),
        { NX: true, EX: 30 }
      );
    });

    it('should skip processing when lock cannot be acquired', async () => {
      // Arrange
      mockRedisSet.mockResolvedValue(null); // Lock not acquired
      const mockCommand = { execute: vi.fn().mockResolvedValue(undefined) };
      const client = createMockClient({
        commands: new Map([['test-command', mockCommand]]),
      });
      const interaction = createMockInteraction('chatInput');
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await execute(interaction as any, client as any, services as any, databases as any);

      // Assert
      expect(mockCommand.execute).not.toHaveBeenCalled();
      expect(mockLoggerDebug).toHaveBeenCalledWith(
        expect.stringContaining('already being handled by another instance')
      );
    });

    it('should release lock after processing completes', async () => {
      // Arrange
      const mockCommand = { execute: vi.fn().mockResolvedValue(undefined) };
      const client = createMockClient({
        commands: new Map([['test-command', mockCommand]]),
      });
      const interaction = createMockInteraction('chatInput');
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await execute(interaction as any, client as any, services as any, databases as any);

      // Assert
      expect(mockRedisEval).toHaveBeenCalled();
    });

    it('should release lock even when error occurs', async () => {
      // Arrange
      const error = new Error('Command failed');
      // Make withRetry reject to trigger error handling
      mockWithRetry.mockRejectedValueOnce(error);
      const mockCommand = { execute: vi.fn() };
      const client = createMockClient({
        commands: new Map([['test-command', mockCommand]]),
      });
      const interaction = createMockInteraction('chatInput');
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await execute(interaction as any, client as any, services as any, databases as any);

      // Assert
      expect(mockRedisEval).toHaveBeenCalled();
      expect(mockHandleInteractionError).toHaveBeenCalled();
    });
  });

  // ============================================
  // Help Interaction Tests
  // ============================================

  describe('help interaction routing', () => {
    it('should delegate help: prefixed interactions to helpInteractionHandler', async () => {
      // Arrange
      const interaction = createMockInteraction('button', {
        customId: 'help:category:admin',
      });
      const client = createMockClient();
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await execute(interaction as any, client as any, services as any, databases as any);

      // Assert
      expect(mockHandleHelpInteraction).toHaveBeenCalledWith(interaction, services);
    });
  });

  // ============================================
  // ChatInputCommand Tests
  // ============================================

  describe('chat input command routing', () => {
    it('should execute matching command', async () => {
      // Arrange
      const mockCommand = { execute: vi.fn().mockResolvedValue(undefined) };
      const client = createMockClient({
        commands: new Map([['test-command', mockCommand]]),
      });
      const interaction = createMockInteraction('chatInput', {
        commandName: 'test-command',
      });
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await execute(interaction as any, client as any, services as any, databases as any);

      // Assert
      expect(mockWithRetry).toHaveBeenCalled();
      expect(mockRecordSuccessfulCommand).toHaveBeenCalled();
    });

    it('should return early when command is not found', async () => {
      // Arrange
      const client = createMockClient({
        commands: new Map(),
      });
      const interaction = createMockInteraction('chatInput', {
        commandName: 'non-existent-command',
      });
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await execute(interaction as any, client as any, services as any, databases as any);

      // Assert
      expect(mockRecordSuccessfulCommand).not.toHaveBeenCalled();
    });

    it('should record execution time for successful commands', async () => {
      // Arrange
      const mockCommand = { execute: vi.fn().mockResolvedValue(undefined) };
      const client = createMockClient({
        commands: new Map([['test-command', mockCommand]]),
      });
      const interaction = createMockInteraction('chatInput', {
        commandName: 'test-command',
      });
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await execute(interaction as any, client as any, services as any, databases as any);

      // Assert
      expect(mockRecordSuccessfulCommand).toHaveBeenCalledWith(
        client,
        interaction,
        'test-command',
        expect.any(Number)
      );
    });
  });

  // ============================================
  // ContextMenuCommand Tests
  // ============================================

  describe('context menu command routing', () => {
    it('should execute matching context menu command', async () => {
      // Arrange
      const mockCommand = { execute: vi.fn().mockResolvedValue(undefined) };
      const client = createMockClient({
        commands: new Map([['user-info', mockCommand]]),
      });
      const interaction = createMockInteraction('contextMenu', {
        commandName: 'user-info',
      });
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await execute(interaction as any, client as any, services as any, databases as any);

      // Assert
      expect(mockCommand.execute).toHaveBeenCalled();
      expect(mockRecordSuccessfulCommand).toHaveBeenCalled();
    });
  });

  // ============================================
  // Button Routing Tests
  // ============================================

  describe('button routing', () => {
    it('should route report- buttons to reportViewHandler', async () => {
      // Arrange
      const interaction = createMockInteraction('button', {
        customId: 'report-price-BTC-1d-12345',
      });
      const client = createMockClient();
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await execute(interaction as any, client as any, services as any, databases as any);

      // Assert
      expect(mockReportViewExecute).toHaveBeenCalledWith(
        interaction,
        client,
        services,
        databases
      );
    });

    it('should match button by string prefix', async () => {
      // Arrange
      const mockButtonHandler = { name: 'ticket_', execute: vi.fn().mockResolvedValue(undefined) };
      const client = createMockClient({
        buttons: [mockButtonHandler],
      });
      const interaction = createMockInteraction('button', {
        customId: 'ticket_close_123',
      });
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await execute(interaction as any, client as any, services as any, databases as any);

      // Assert
      expect(mockButtonHandler.execute).toHaveBeenCalled();
    });

    it('should match button by regex pattern', async () => {
      // Arrange
      const mockButtonHandler = {
        name: /^panel_\d+_/,
        execute: vi.fn().mockResolvedValue(undefined),
      };
      const client = createMockClient({
        buttons: [mockButtonHandler],
      });
      const interaction = createMockInteraction('button', {
        customId: 'panel_123_create',
      });
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await execute(interaction as any, client as any, services as any, databases as any);

      // Assert
      expect(mockButtonHandler.execute).toHaveBeenCalled();
    });

    it('should return early when button handler is not found', async () => {
      // Arrange
      const client = createMockClient({
        buttons: [],
      });
      const interaction = createMockInteraction('button', {
        customId: 'unknown_button',
      });
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await execute(interaction as any, client as any, services as any, databases as any);

      // Assert
      expect(mockRecordSuccessfulCommand).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // Modal Routing Tests
  // ============================================

  describe('modal routing', () => {
    it('should match modal by string prefix', async () => {
      // Arrange
      const mockModalHandler = {
        name: 'ticket_reason_',
        execute: vi.fn().mockResolvedValue(undefined),
      };
      const client = createMockClient({
        modals: [mockModalHandler],
      });
      const interaction = createMockInteraction('modal', {
        customId: 'ticket_reason_123',
      });
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await execute(interaction as any, client as any, services as any, databases as any);

      // Assert
      expect(mockModalHandler.execute).toHaveBeenCalledWith(interaction, services, databases);
    });

    it('should return early when modal handler is not found', async () => {
      // Arrange
      const client = createMockClient({
        modals: [],
      });
      const interaction = createMockInteraction('modal', {
        customId: 'unknown_modal',
      });
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await execute(interaction as any, client as any, services as any, databases as any);

      // Assert
      expect(mockRecordSuccessfulCommand).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // Select Menu Routing Tests
  // ============================================

  describe('select menu routing', () => {
    it('should match select menu by string prefix', async () => {
      // Arrange
      const mockSelectHandler = {
        name: 'category_select_',
        execute: vi.fn().mockResolvedValue(undefined),
      };
      const client = createMockClient({
        selectMenus: [mockSelectHandler],
      });
      const interaction = createMockInteraction('selectMenu', {
        customId: 'category_select_123',
      });
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await execute(interaction as any, client as any, services as any, databases as any);

      // Assert
      expect(mockSelectHandler.execute).toHaveBeenCalledWith(interaction, services, databases);
    });

    it('should match select menu by regex pattern', async () => {
      // Arrange
      const mockSelectHandler = {
        name: /^role_select_\d+$/,
        execute: vi.fn().mockResolvedValue(undefined),
      };
      const client = createMockClient({
        selectMenus: [mockSelectHandler],
      });
      const interaction = createMockInteraction('selectMenu', {
        customId: 'role_select_456',
      });
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await execute(interaction as any, client as any, services as any, databases as any);

      // Assert
      expect(mockSelectHandler.execute).toHaveBeenCalled();
    });
  });

  // ============================================
  // Autocomplete Routing Tests
  // ============================================

  describe('autocomplete routing', () => {
    it('should call command autocomplete handler', async () => {
      // Arrange
      const mockCommand = {
        execute: vi.fn(),
        autocomplete: vi.fn().mockResolvedValue(undefined),
      };
      const client = createMockClient({
        commands: new Map([['search', mockCommand]]),
      });
      const interaction = createMockInteraction('autocomplete', {
        commandName: 'search',
      });
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await execute(interaction as any, client as any, services as any, databases as any);

      // Assert
      expect(mockCommand.autocomplete).toHaveBeenCalledWith(
        interaction,
        databases.gachaDb,
        databases.ticketDb
      );
    });

    it('should not record success for autocomplete', async () => {
      // Arrange
      const mockCommand = {
        execute: vi.fn(),
        autocomplete: vi.fn().mockResolvedValue(undefined),
      };
      const client = createMockClient({
        commands: new Map([['search', mockCommand]]),
      });
      const interaction = createMockInteraction('autocomplete', {
        commandName: 'search',
      });
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await execute(interaction as any, client as any, services as any, databases as any);

      // Assert
      expect(mockRecordSuccessfulCommand).not.toHaveBeenCalled();
    });

    it('should return early when command has no autocomplete handler', async () => {
      // Arrange
      const mockCommand = {
        execute: vi.fn(),
        // No autocomplete handler
      };
      const client = createMockClient({
        commands: new Map([['search', mockCommand]]),
      });
      const interaction = createMockInteraction('autocomplete', {
        commandName: 'search',
      });
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await execute(interaction as any, client as any, services as any, databases as any);

      // Assert - no error should be thrown
      expect(mockHandleInteractionError).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // Error Handling Tests
  // ============================================

  describe('error handling', () => {
    it('should call errorHandler when command throws', async () => {
      // Arrange
      const error = new Error('Command execution failed');
      mockWithRetry.mockRejectedValueOnce(error);

      const mockCommand = { execute: vi.fn() };
      const client = createMockClient({
        commands: new Map([['failing-command', mockCommand]]),
      });
      const interaction = createMockInteraction('chatInput', {
        commandName: 'failing-command',
      });
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await execute(interaction as any, client as any, services as any, databases as any);

      // Assert
      expect(mockHandleInteractionError).toHaveBeenCalledWith(
        interaction,
        error,
        client,
        services
      );
    });

    it('should call errorHandler when button throws', async () => {
      // Arrange
      const error = new Error('Button handler failed');
      const mockButtonHandler = {
        name: 'error_button_',
        execute: vi.fn().mockRejectedValue(error),
      };
      const client = createMockClient({
        buttons: [mockButtonHandler],
      });
      const interaction = createMockInteraction('button', {
        customId: 'error_button_123',
      });
      const services = createMockServices();
      const databases = createMockDatabases();

      // Act
      await execute(interaction as any, client as any, services as any, databases as any);

      // Assert
      expect(mockHandleInteractionError).toHaveBeenCalledWith(
        interaction,
        error,
        client,
        services
      );
    });
  });
});
