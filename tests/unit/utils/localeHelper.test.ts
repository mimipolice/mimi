/**
 * localeHelper.ts 單元測試
 *
 * 測試範圍：
 * - getInteractionLocale(): 從 Discord 互動取得本地化語言代碼
 *
 * Mock 策略：
 * - Discord.js Locale: mock enum values
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Locale } from 'discord.js';

import { getInteractionLocale } from '../../../src/utils/localeHelper.js';

// ============================================
// Test Helpers
// ============================================

function createMockInteraction(locale: Locale) {
  return {
    locale,
  };
}

describe('localeHelper utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // getInteractionLocale() 測試
  // ============================================

  describe('getInteractionLocale()', () => {
    describe('supported locales', () => {
      it('should return zh-TW for ChineseTW locale', () => {
        // Arrange
        const interaction = createMockInteraction(Locale.ChineseTW);

        // Act
        const result = getInteractionLocale(interaction as any);

        // Assert
        expect(result).toBe('zh-TW');
      });

      it('should return en-US for EnglishUS locale', () => {
        // Arrange
        const interaction = createMockInteraction(Locale.EnglishUS);

        // Act
        const result = getInteractionLocale(interaction as any);

        // Assert
        expect(result).toBe('en-US');
      });

      it('should return en-US for EnglishGB locale', () => {
        // Arrange
        const interaction = createMockInteraction(Locale.EnglishGB);

        // Act
        const result = getInteractionLocale(interaction as any);

        // Assert
        expect(result).toBe('en-US');
      });
    });

    describe('fallback behavior', () => {
      it('should return en-US for unsupported locales (German)', () => {
        // Arrange
        const interaction = createMockInteraction(Locale.German);

        // Act
        const result = getInteractionLocale(interaction as any);

        // Assert
        expect(result).toBe('en-US');
      });

      it('should return en-US for unsupported locales (Japanese)', () => {
        // Arrange
        const interaction = createMockInteraction(Locale.Japanese);

        // Act
        const result = getInteractionLocale(interaction as any);

        // Assert
        expect(result).toBe('en-US');
      });

      it('should return en-US for unsupported locales (French)', () => {
        // Arrange
        const interaction = createMockInteraction(Locale.French);

        // Act
        const result = getInteractionLocale(interaction as any);

        // Assert
        expect(result).toBe('en-US');
      });

      it('should return en-US for unsupported locales (Spanish)', () => {
        // Arrange
        const interaction = createMockInteraction(Locale.SpanishES);

        // Act
        const result = getInteractionLocale(interaction as any);

        // Assert
        expect(result).toBe('en-US');
      });
    });

    describe('all Discord locales', () => {
      it('should handle ChineseSimplified', () => {
        const interaction = createMockInteraction(Locale.ChineseCN);
        const result = getInteractionLocale(interaction as any);
        expect(result).toBe('en-US'); // Falls back to en-US
      });

      it('should handle Korean', () => {
        const interaction = createMockInteraction(Locale.Korean);
        const result = getInteractionLocale(interaction as any);
        expect(result).toBe('en-US');
      });
    });
  });

  // ============================================
  // Pure Logic Tests
  // ============================================

  describe('locale mapping logic', () => {
    it('should map Discord Locale enum to string correctly', () => {
      expect(Locale.ChineseTW).toBe('zh-TW');
      expect(Locale.EnglishUS).toBe('en-US');
      expect(Locale.EnglishGB).toBe('en-GB');
    });

    it('should verify supported locale format', () => {
      const supportedLocales = ['en-US', 'zh-TW'];

      expect(supportedLocales).toContain('en-US');
      expect(supportedLocales).toContain('zh-TW');
    });
  });

  // ============================================
  // Interface Tests
  // ============================================

  describe('interaction interface', () => {
    it('should only require locale property', () => {
      const minimalInteraction = { locale: Locale.EnglishUS };

      const result = getInteractionLocale(minimalInteraction as any);
      expect(result).toBe('en-US');
    });
  });
});
