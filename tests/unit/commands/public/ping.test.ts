/**
 * Ping Command Unit Tests
 *
 * Tests for the /ping command which displays bot latency
 * and provides an interactive button to refresh.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Locale } from 'discord.js';

// ============================================
// Import command for data tests
// ============================================

import { command as pingCommand } from '../../../../src/commands/public/ping/index.js';

// ============================================
// Tests
// ============================================

describe('Ping Command', () => {
  describe('Command Data', () => {
    it('should have correct command name', () => {
      expect(pingCommand.data.name).toBe('ping');
    });

    it('should have description', () => {
      expect(pingCommand.data.description).toBe('Replies with Pong!');
    });

    it('should have localized names', () => {
      const nameLocalizations = pingCommand.data.toJSON().name_localizations;
      expect(nameLocalizations).toBeDefined();
      expect(nameLocalizations?.['zh-TW']).toBe('延遲');
    });

    it('should have localized descriptions', () => {
      const descLocalizations = pingCommand.data.toJSON().description_localizations;
      expect(descLocalizations).toBeDefined();
      expect(descLocalizations?.['zh-TW']).toBe('回應「Pong!」。');
    });

    it('should have detailed help path', () => {
      expect(pingCommand.detailedHelpPath).toBe('src/commands/help_docs/public/ping.md');
    });

    it('should have execute function', () => {
      expect(typeof pingCommand.execute).toBe('function');
    });

    it('should not be guild only by default', () => {
      expect(pingCommand.guildOnly).toBeUndefined();
    });
  });
});
