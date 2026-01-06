/**
 * localization.ts 單元測試
 *
 * 測試範圍：
 * - getLocalizations(): 取得所有語言的本地化設定
 *
 * Mock 策略：
 * - LocalizationManager: mock getAvailableLanguages, getLocale
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { getLocalizations } from '../../../src/utils/localization.js';

// ============================================
// Test Helpers
// ============================================

function createMockLocalizationManager(overrides: Partial<{
  availableLanguages: string[];
  locales: Record<string, any>;
}> = {}) {
  const availableLanguages = overrides.availableLanguages ?? ['en-US', 'zh-TW'];
  const locales = overrides.locales ?? {
    'en-US': { name: 'English Name', description: 'English Description' },
    'zh-TW': { name: '中文名稱', description: '中文描述' },
  };

  return {
    getAvailableLanguages: vi.fn().mockReturnValue(availableLanguages),
    getLocale: vi.fn().mockImplementation((commandName: string, lang: string) => {
      return locales[lang] ?? null;
    }),
  };
}

describe('localization utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // getLocalizations() 測試
  // ============================================

  describe('getLocalizations()', () => {
    it('should return localizations for all available languages', () => {
      // Arrange
      const mockManager = createMockLocalizationManager();

      // Act
      const result = getLocalizations(mockManager as any, 'testCommand');

      // Assert
      expect(result).toHaveProperty('en-US');
      expect(result).toHaveProperty('zh-TW');
      expect(mockManager.getAvailableLanguages).toHaveBeenCalled();
    });

    it('should call getLocale for each available language', () => {
      // Arrange
      const mockManager = createMockLocalizationManager({
        availableLanguages: ['en-US', 'zh-TW', 'ja'],
      });

      // Act
      getLocalizations(mockManager as any, 'myCommand');

      // Assert
      expect(mockManager.getLocale).toHaveBeenCalledWith('myCommand', 'en-US');
      expect(mockManager.getLocale).toHaveBeenCalledWith('myCommand', 'zh-TW');
      expect(mockManager.getLocale).toHaveBeenCalledWith('myCommand', 'ja');
      expect(mockManager.getLocale).toHaveBeenCalledTimes(3);
    });

    it('should skip languages without locale data', () => {
      // Arrange
      const mockManager = createMockLocalizationManager({
        availableLanguages: ['en-US', 'zh-TW', 'de'],
        locales: {
          'en-US': { name: 'English' },
          'zh-TW': { name: '中文' },
          // 'de' is not in locales, so getLocale returns null
        },
      });

      // Act
      const result = getLocalizations(mockManager as any, 'command');

      // Assert
      expect(result).toHaveProperty('en-US');
      expect(result).toHaveProperty('zh-TW');
      expect(result).not.toHaveProperty('de');
    });

    it('should return empty object when no languages available', () => {
      // Arrange
      const mockManager = createMockLocalizationManager({
        availableLanguages: [],
      });

      // Act
      const result = getLocalizations(mockManager as any, 'command');

      // Assert
      expect(result).toEqual({});
    });

    it('should return correct locale structure', () => {
      // Arrange
      const mockManager = createMockLocalizationManager({
        locales: {
          'en-US': {
            name: 'Help Command',
            description: 'Shows help information',
            options: { topic: 'Topic to get help for' },
          },
        },
      });

      // Act
      const result = getLocalizations(mockManager as any, 'help');

      // Assert
      expect(result['en-US']).toEqual({
        name: 'Help Command',
        description: 'Shows help information',
        options: { topic: 'Topic to get help for' },
      });
    });

    it('should handle undefined locale values gracefully', () => {
      // Arrange
      const mockManager = {
        getAvailableLanguages: vi.fn().mockReturnValue(['en-US']),
        getLocale: vi.fn().mockReturnValue(undefined),
      };

      // Act
      const result = getLocalizations(mockManager as any, 'command');

      // Assert - undefined is falsy, so it should be skipped
      expect(result).toEqual({});
    });
  });

  // ============================================
  // Pure Logic Tests
  // ============================================

  describe('locale record structure', () => {
    it('should build Record<string, any> correctly', () => {
      const localizations: Record<string, any> = {};
      localizations['en-US'] = { name: 'test' };
      localizations['zh-TW'] = { name: '測試' };

      expect(Object.keys(localizations)).toEqual(['en-US', 'zh-TW']);
    });

    it('should support nested locale objects', () => {
      const locale = {
        name: 'Command',
        description: 'Description',
        options: {
          option1: { name: 'Option 1' },
          option2: { name: 'Option 2' },
        },
      };

      expect(locale.options.option1.name).toBe('Option 1');
    });
  });
});
