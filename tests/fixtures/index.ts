/**
 * 測試 Fixture 匯出
 *
 * 使用方式：
 * ```typescript
 * import {
 *   FIXTURE_OPEN_TICKET,
 *   FIXTURE_COMPLETE_SETTINGS,
 * } from '@tests/fixtures';
 * ```
 */

// Ticket Fixtures
export {
  FIXTURE_OPEN_TICKET,
  FIXTURE_CLAIMED_TICKET,
  FIXTURE_CLOSED_TICKET,
  FIXTURE_UNRESOLVED_TICKET,
  FIXTURE_FOLLOWUP_TICKET,
  FIXTURE_ABUSE_TICKET,
  FIXTURE_BILLING_TICKET,
  FIXTURE_GENERAL_TICKET,
  FIXTURE_REPORT_TICKET,
  FIXTURE_FEEDBACK_TICKET,
  FIXTURE_USER_TICKET_HISTORY,
  FIXTURE_EMPTY_TICKET_HISTORY,
  createTicketFixture,
  createClosedTicketFixture,
  createTicketFixtures,
  ticketFixtures,
} from './tickets.js';

// Guild Settings Fixtures
export {
  FIXTURE_COMPLETE_SETTINGS,
  FIXTURE_MINIMAL_SETTINGS,
  FIXTURE_INCOMPLETE_SETTINGS,
  FIXTURE_PANEL_ONLY_SETTINGS,
  FIXTURE_STORY_FORUM_SETTINGS,
  FIXTURE_SECOND_GUILD_SETTINGS,
  FIXTURE_THIRD_GUILD_SETTINGS,
  createSettingsFixture,
  createMinimalSettingsFixture,
  createEmptySettingsFixture,
  isSettingsComplete,
  isPanelSettingsComplete,
  guildSettingsFixtures,
} from './guild-settings.js';
