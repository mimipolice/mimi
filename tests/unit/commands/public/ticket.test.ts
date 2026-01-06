/**
 * Create-Ticket Command Unit Tests
 *
 * Tests for the /create-ticket command which creates support tickets.
 */

import { describe, it, expect } from 'vitest';
import { Locale } from 'discord.js';

// ============================================
// Import command for data tests
// ============================================

import { command as ticketCommand } from '../../../../src/commands/public/ticket/index.js';

// ============================================
// Tests
// ============================================

describe('Create-Ticket Command', () => {
  describe('Command Data', () => {
    it('should have correct command name', () => {
      expect(ticketCommand.data.name).toBe('create-ticket');
    });

    it('should have description', () => {
      expect(ticketCommand.data.description).toBe('Create a support ticket');
    });

    it('should have Chinese localization for description', () => {
      const descLocalizations = ticketCommand.data.toJSON().description_localizations;
      expect(descLocalizations?.['zh-TW']).toBe('創建客服單');
    });

    it('should have execute function', () => {
      expect(typeof ticketCommand.execute).toBe('function');
    });

    it('should not have any options (simple command)', () => {
      const json = ticketCommand.data.toJSON();
      // toJSON() returns empty array when no options, not undefined
      expect(json.options ?? []).toHaveLength(0);
    });
  });
});
