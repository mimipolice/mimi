/**
 * Ticket 測試 Fixture
 *
 * 提供預先定義的 Ticket 資料，用於測試不同狀態的客服單。
 *
 * 使用方式：
 * ```typescript
 * import { FIXTURE_OPEN_TICKET, createTicketFixture } from '@tests/fixtures/tickets';
 *
 * it('should handle open ticket', async () => {
 *   const ticket = FIXTURE_OPEN_TICKET;
 *   // 或建立自訂 ticket
 *   const customTicket = createTicketFixture({ ownerId: 'custom-user' });
 * });
 * ```
 */

import {
  TicketStatus,
  TicketCategory,
  TicketResolution,
  type Ticket,
} from '../../src/types/ticket.js';

// ============================================
// 基本 Ticket Fixture
// ============================================

/**
 * 開啟中的 Ticket（未被 Claim）
 */
export const FIXTURE_OPEN_TICKET: Ticket = {
  id: 1,
  guildTicketId: 42,
  guildId: '987654321098765432',
  channelId: 'channel-open-ticket',
  ownerId: '123456789012345678',
  claimedById: null,
  status: TicketStatus.OPEN,
  closeReason: null,
  closedById: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  closedAt: null,
  feedbackRating: null,
  feedbackComment: null,
  category: null,
  rating: null,
  resolution: null,
};

/**
 * 已被 Claim 的 Ticket
 */
export const FIXTURE_CLAIMED_TICKET: Ticket = {
  ...FIXTURE_OPEN_TICKET,
  id: 2,
  guildTicketId: 43,
  channelId: 'channel-claimed-ticket',
  claimedById: '111111111111111111',
};

/**
 * 已關閉的 Ticket（完整資料）
 */
export const FIXTURE_CLOSED_TICKET: Ticket = {
  ...FIXTURE_OPEN_TICKET,
  id: 3,
  guildTicketId: 44,
  channelId: 'channel-closed-ticket',
  claimedById: '111111111111111111',
  status: TicketStatus.CLOSED,
  closeReason: '問題已解決，感謝您的回報。',
  closedById: '111111111111111111',
  closedAt: '2024-01-02T12:00:00.000Z',
  feedbackRating: 5,
  feedbackComment: '服務很棒！',
  category: TicketCategory.TECHNICAL,
  rating: 5,
  resolution: TicketResolution.RESOLVED,
};

/**
 * 已關閉但未解決的 Ticket
 */
export const FIXTURE_UNRESOLVED_TICKET: Ticket = {
  ...FIXTURE_OPEN_TICKET,
  id: 4,
  guildTicketId: 45,
  channelId: 'channel-unresolved-ticket',
  status: TicketStatus.CLOSED,
  closeReason: '無法重現問題。',
  closedById: '111111111111111111',
  closedAt: '2024-01-03T08:00:00.000Z',
  category: TicketCategory.TECHNICAL,
  rating: 2,
  resolution: TicketResolution.UNRESOLVED,
};

/**
 * 需要後續追蹤的 Ticket
 */
export const FIXTURE_FOLLOWUP_TICKET: Ticket = {
  ...FIXTURE_OPEN_TICKET,
  id: 5,
  guildTicketId: 46,
  channelId: 'channel-followup-ticket',
  claimedById: '111111111111111111',
  status: TicketStatus.CLOSED,
  closeReason: '需要等待下一版更新。',
  closedById: '111111111111111111',
  closedAt: '2024-01-04T16:00:00.000Z',
  category: TicketCategory.TECHNICAL,
  rating: 3,
  resolution: TicketResolution.FOLLOW_UP,
};

/**
 * 濫用舉報類型的 Ticket
 */
export const FIXTURE_ABUSE_TICKET: Ticket = {
  ...FIXTURE_OPEN_TICKET,
  id: 6,
  guildTicketId: 47,
  channelId: 'channel-abuse-ticket',
  claimedById: '111111111111111111',
  status: TicketStatus.CLOSED,
  closeReason: '已處理濫用舉報。',
  closedById: '111111111111111111',
  closedAt: '2024-01-05T10:00:00.000Z',
  category: TicketCategory.ABUSE,
  rating: null,
  resolution: TicketResolution.ABUSE,
};

// ============================================
// 不同分類的 Ticket Fixture
// ============================================

/**
 * 帳務問題 Ticket
 */
export const FIXTURE_BILLING_TICKET: Ticket = {
  ...FIXTURE_CLOSED_TICKET,
  id: 7,
  guildTicketId: 48,
  channelId: 'channel-billing-ticket',
  closeReason: '帳務問題已處理。',
  category: TicketCategory.BILLING,
};

/**
 * 一般問題 Ticket
 */
export const FIXTURE_GENERAL_TICKET: Ticket = {
  ...FIXTURE_CLOSED_TICKET,
  id: 8,
  guildTicketId: 49,
  channelId: 'channel-general-ticket',
  closeReason: '問題已回答。',
  category: TicketCategory.GENERAL,
};

/**
 * 檢舉類型 Ticket
 */
export const FIXTURE_REPORT_TICKET: Ticket = {
  ...FIXTURE_CLOSED_TICKET,
  id: 9,
  guildTicketId: 50,
  channelId: 'channel-report-ticket',
  closeReason: '已處理檢舉。',
  category: TicketCategory.REPORT,
};

/**
 * 意見回饋 Ticket
 */
export const FIXTURE_FEEDBACK_TICKET: Ticket = {
  ...FIXTURE_CLOSED_TICKET,
  id: 10,
  guildTicketId: 51,
  channelId: 'channel-feedback-ticket',
  closeReason: '感謝您的回饋！',
  category: TicketCategory.FEEDBACK,
};

// ============================================
// Ticket 工廠函數
// ============================================

/**
 * 建立自訂 Ticket Fixture
 *
 * @param overrides - 要覆蓋的欄位
 * @returns 新的 Ticket 物件
 */
export function createTicketFixture(overrides: Partial<Ticket> = {}): Ticket {
  const randomId = Math.floor(Math.random() * 100000);

  return {
    ...FIXTURE_OPEN_TICKET,
    id: randomId,
    guildTicketId: randomId % 1000,
    channelId: `channel-${randomId}`,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * 建立已關閉的 Ticket Fixture
 *
 * @param overrides - 要覆蓋的欄位
 * @returns 新的已關閉 Ticket 物件
 */
export function createClosedTicketFixture(
  overrides: Partial<Ticket> = {}
): Ticket {
  return createTicketFixture({
    status: TicketStatus.CLOSED,
    closeReason: 'Test close reason',
    closedById: '111111111111111111',
    closedAt: new Date().toISOString(),
    ...overrides,
  });
}

/**
 * 建立多個 Ticket Fixture（用於批次測試）
 *
 * @param count - 要建立的數量
 * @param baseOverrides - 套用到所有 Ticket 的共用覆蓋欄位
 * @returns Ticket 陣列
 */
export function createTicketFixtures(
  count: number,
  baseOverrides: Partial<Ticket> = {}
): Ticket[] {
  return Array.from({ length: count }, (_, index) =>
    createTicketFixture({
      ...baseOverrides,
      guildTicketId: index + 1,
    })
  );
}

// ============================================
// Ticket 陣列 Fixture（用於列表測試）
// ============================================

/**
 * 使用者的 Ticket 歷史記錄
 */
export const FIXTURE_USER_TICKET_HISTORY: Ticket[] = [
  FIXTURE_CLOSED_TICKET,
  FIXTURE_UNRESOLVED_TICKET,
  FIXTURE_FOLLOWUP_TICKET,
  FIXTURE_ABUSE_TICKET,
  FIXTURE_BILLING_TICKET,
];

/**
 * 空的 Ticket 歷史記錄
 */
export const FIXTURE_EMPTY_TICKET_HISTORY: Ticket[] = [];

// ============================================
// 匯出
// ============================================

export const ticketFixtures = {
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
};
