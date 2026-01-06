/**
 * HelpService 單元測試
 *
 * 測試範圍：
 * - initialize(): 初始化應用程式指令快取
 * - getCommandsByCategory(): 取得分類後的指令
 * - getAccessibleCategories(): 取得使用者可存取的分類
 * - getAccessibleCommandsInCategory(): 取得特定分類中可存取的指令
 * - getCommandDoc(): 取得指令文件內容
 * - getCommandDocPath(): 取得指令文件路徑
 * - getCommandMention(): 取得指令 mention 格式
 *
 * Mock 策略：
 * - Discord Client: mock commandCategories, application
 * - fs/promises: mock readFile
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Collection } from 'discord.js';

// ============================================
// Mock 設定 - 使用 vi.hoisted 確保持久化
// ============================================

const { mockReadFile } = vi.hoisted(() => ({
  mockReadFile: vi.fn(),
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: mockReadFile,
}));

// ============================================
// 現在可以安全地 import
// ============================================

import { HelpService } from '../../../src/services/HelpService.js';
import type { Command } from '../../../src/interfaces/Command.js';

// ============================================
// 測試輔助函數
// ============================================

function createMockCommand(overrides: Partial<Command> = {}): Command {
  return {
    data: {
      name: 'test-command',
      description: 'A test command',
      default_member_permissions: null,
      ...overrides.data,
    },
    execute: vi.fn(),
    filePath: '/home/project/src/commands/public/test-command/index.ts',
    ...overrides,
  } as unknown as Command;
}

function createMockClient(options: {
  categories?: Map<string, Map<string, Command>>;
  appCommands?: Array<{ name: string; id: string }>;
} = {}) {
  const commandCategories = new Collection<string, Collection<string, Command>>();

  if (options.categories) {
    for (const [categoryName, commands] of options.categories) {
      const commandCollection = new Collection<string, Command>();
      for (const [cmdName, cmd] of commands) {
        commandCollection.set(cmdName, cmd);
      }
      commandCategories.set(categoryName, commandCollection);
    }
  }

  const appCommands = new Collection<string, { name: string; id: string }>();
  if (options.appCommands) {
    for (const cmd of options.appCommands) {
      appCommands.set(cmd.id, cmd);
    }
  }

  return {
    commandCategories,
    application: {
      commands: {
        fetch: vi.fn().mockResolvedValue(appCommands),
      },
    },
  };
}

function createMockMember(permissions: bigint | null = null) {
  if (permissions === null) {
    return null;
  }

  return {
    permissions: {
      has: vi.fn().mockImplementation((perm: bigint) => {
        return (permissions & perm) === perm;
      }),
    },
  };
}

describe('HelpService', () => {
  let helpService: HelpService;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================
  // initialize() 測試
  // ============================================

  describe('initialize()', () => {
    it('should fetch and cache application commands', async () => {
      // Arrange
      const mockClient = createMockClient({
        appCommands: [
          { name: 'ping', id: '123456789' },
          { name: 'help', id: '987654321' },
        ],
      });
      helpService = new HelpService(mockClient as any);

      // Act
      await helpService.initialize();

      // Assert
      expect(mockClient.application.commands.fetch).toHaveBeenCalled();
    });

    it('should handle client without application', async () => {
      // Arrange
      const mockClient = {
        commandCategories: new Collection(),
        application: null,
      };
      helpService = new HelpService(mockClient as any);

      // Act & Assert - 不應該拋出錯誤
      await expect(helpService.initialize()).resolves.toBeUndefined();
    });
  });

  // ============================================
  // getCommandsByCategory() 測試
  // ============================================

  describe('getCommandsByCategory()', () => {
    it('should return commands grouped by category', () => {
      // Arrange
      const publicCmd = createMockCommand({ data: { name: 'public-cmd' } });
      const adminCmd = createMockCommand({ data: { name: 'admin-cmd' } });

      const categories = new Map([
        ['public', new Map([['public-cmd', publicCmd]])],
        ['admin', new Map([['admin-cmd', adminCmd]])],
      ]);

      const mockClient = createMockClient({ categories });
      helpService = new HelpService(mockClient as any);

      // Act
      const result = helpService.getCommandsByCategory();

      // Assert
      expect(result.size).toBe(2);
      expect(result.get('public')).toHaveLength(1);
      expect(result.get('admin')).toHaveLength(1);
      expect(result.get('public')?.[0].data.name).toBe('public-cmd');
    });

    it('should return empty map when no categories', () => {
      // Arrange
      const mockClient = createMockClient();
      helpService = new HelpService(mockClient as any);

      // Act
      const result = helpService.getCommandsByCategory();

      // Assert
      expect(result.size).toBe(0);
    });
  });

  // ============================================
  // getAccessibleCategories() 測試
  // ============================================

  describe('getAccessibleCategories()', () => {
    it('should return categories with accessible commands', () => {
      // Arrange
      const publicCmd = createMockCommand({
        data: { name: 'public-cmd', default_member_permissions: null },
      });
      const adminCmd = createMockCommand({
        data: { name: 'admin-cmd', default_member_permissions: '8' }, // Administrator
      });

      const categories = new Map([
        ['public', new Map([['public-cmd', publicCmd]])],
        ['admin', new Map([['admin-cmd', adminCmd]])],
      ]);

      const mockClient = createMockClient({ categories });
      helpService = new HelpService(mockClient as any);

      const member = createMockMember(BigInt(0)); // 沒有權限

      // Act
      const result = helpService.getAccessibleCategories(member as any);

      // Assert
      expect(result).toContain('public'); // 公開指令應該可見
    });

    it('should return all categories for admin user', () => {
      // Arrange
      const publicCmd = createMockCommand({
        data: { name: 'public-cmd', default_member_permissions: null },
      });
      const adminCmd = createMockCommand({
        data: { name: 'admin-cmd', default_member_permissions: '8' },
      });

      const categories = new Map([
        ['public', new Map([['public-cmd', publicCmd]])],
        ['admin', new Map([['admin-cmd', adminCmd]])],
      ]);

      const mockClient = createMockClient({ categories });
      helpService = new HelpService(mockClient as any);

      const member = createMockMember(BigInt(8)); // Administrator

      // Act
      const result = helpService.getAccessibleCategories(member as any);

      // Assert
      expect(result).toContain('public');
      expect(result).toContain('admin');
    });

    it('should handle null member (DM context)', () => {
      // Arrange
      const publicCmd = createMockCommand({
        data: { name: 'public-cmd', default_member_permissions: null },
      });

      const categories = new Map([
        ['public', new Map([['public-cmd', publicCmd]])],
      ]);

      const mockClient = createMockClient({ categories });
      helpService = new HelpService(mockClient as any);

      // Act
      const result = helpService.getAccessibleCategories(null);

      // Assert
      expect(result).toContain('public');
    });
  });

  // ============================================
  // getAccessibleCommandsInCategory() 測試
  // ============================================

  describe('getAccessibleCommandsInCategory()', () => {
    it('should return accessible commands in category', () => {
      // Arrange
      const cmd1 = createMockCommand({
        data: { name: 'cmd1', default_member_permissions: null },
      });
      const cmd2 = createMockCommand({
        data: { name: 'cmd2', default_member_permissions: '8' },
      });

      const categories = new Map([
        ['public', new Map([['cmd1', cmd1], ['cmd2', cmd2]])],
      ]);

      const mockClient = createMockClient({ categories });
      helpService = new HelpService(mockClient as any);

      const member = createMockMember(BigInt(0)); // 沒有管理員權限

      // Act
      const result = helpService.getAccessibleCommandsInCategory('public', member as any);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].data.name).toBe('cmd1');
    });

    it('should return empty array for non-existent category', () => {
      // Arrange
      const mockClient = createMockClient();
      helpService = new HelpService(mockClient as any);

      // Act
      const result = helpService.getAccessibleCommandsInCategory('nonexistent', null);

      // Assert
      expect(result).toEqual([]);
    });
  });

  // ============================================
  // getCommandDoc() 測試
  // ============================================

  describe('getCommandDoc()', () => {
    it('should return documentation content', async () => {
      // Arrange
      const docContent = '# Command Help\n\nThis is the help text.';
      mockReadFile.mockResolvedValue(docContent);

      const command = createMockCommand({
        data: { name: 'ping' },
        filePath: '/home/project/src/commands/public/ping/index.ts',
      });

      const mockClient = createMockClient();
      helpService = new HelpService(mockClient as any);

      // Act
      const result = await helpService.getCommandDoc(command, 'zh-TW');

      // Assert
      expect(result).toBe(docContent);
      expect(mockReadFile).toHaveBeenCalled();
    });

    it('should return fallback message when doc not found', async () => {
      // Arrange
      mockReadFile.mockRejectedValue(new Error('ENOENT'));

      const command = createMockCommand({
        data: { name: 'undocumented' },
        filePath: '/home/project/src/commands/public/undocumented/index.ts',
      });

      const mockClient = createMockClient();
      helpService = new HelpService(mockClient as any);

      // Act
      const result = await helpService.getCommandDoc(command, 'en-US');

      // Assert
      expect(result).toContain("Documentation for 'undocumented'");
      expect(result).toContain('not available');
    });

    it('should return error when filePath missing', async () => {
      // Arrange
      const command = createMockCommand({
        data: { name: 'no-path' },
        filePath: undefined,
      });

      const mockClient = createMockClient();
      helpService = new HelpService(mockClient as any);

      // Act
      const result = await helpService.getCommandDoc(command, 'zh-TW');

      // Assert
      expect(result).toContain('Documentation not found');
    });
  });

  // ============================================
  // getCommandDocPath() 測試
  // ============================================

  describe('getCommandDocPath()', () => {
    it('should return correct path for command', () => {
      // Arrange
      const command = createMockCommand({
        data: { name: 'ping' },
        filePath: '/home/project/src/commands/public/ping/index.ts',
      });

      const mockClient = createMockClient();
      helpService = new HelpService(mockClient as any);

      // Act
      const result = helpService.getCommandDocPath(command, 'zh-TW');

      // Assert
      expect(result).toContain('help_docs');
      expect(result).toContain('zh-TW');
      expect(result).toContain('public');
      expect(result).toContain('ping.md');
    });

    it('should return empty string when filePath missing', () => {
      // Arrange
      const command = createMockCommand({
        filePath: undefined,
      });

      const mockClient = createMockClient();
      helpService = new HelpService(mockClient as any);

      // Act
      const result = helpService.getCommandDocPath(command, 'en-US');

      // Assert
      expect(result).toBe('');
    });
  });

  // ============================================
  // getCommandMention() 測試
  // ============================================

  describe('getCommandMention()', () => {
    it('should return mention format when command cached', async () => {
      // Arrange
      const mockClient = createMockClient({
        appCommands: [{ name: 'ping', id: '123456789' }],
      });
      helpService = new HelpService(mockClient as any);
      await helpService.initialize();

      // Act
      const result = helpService.getCommandMention('ping');

      // Assert
      expect(result).toBe('</ping:123456789>');
    });

    it('should return fallback format when command not cached', () => {
      // Arrange
      const mockClient = createMockClient();
      helpService = new HelpService(mockClient as any);

      // Act
      const result = helpService.getCommandMention('unknown');

      // Assert
      expect(result).toBe('/unknown');
    });
  });

  // ============================================
  // hasPermission (private) 測試 - 透過公開方法間接測試
  // ============================================

  describe('permission checking', () => {
    it('should allow public commands for everyone', () => {
      // Arrange
      const publicCmd = createMockCommand({
        data: { name: 'public', default_member_permissions: null },
      });

      const categories = new Map([
        ['public', new Map([['public', publicCmd]])],
      ]);

      const mockClient = createMockClient({ categories });
      helpService = new HelpService(mockClient as any);

      // Act
      const result = helpService.getAccessibleCommandsInCategory('public', null);

      // Assert
      expect(result).toHaveLength(1);
    });

    it('should deny permission-required commands for null member', () => {
      // Arrange
      const adminCmd = createMockCommand({
        data: { name: 'admin', default_member_permissions: '8' },
      });

      const categories = new Map([
        ['admin', new Map([['admin', adminCmd]])],
      ]);

      const mockClient = createMockClient({ categories });
      helpService = new HelpService(mockClient as any);

      // Act
      const result = helpService.getAccessibleCommandsInCategory('admin', null);

      // Assert
      expect(result).toHaveLength(0);
    });
  });
});
