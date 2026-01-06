/**
 * Guild Settings 測試 Fixture
 *
 * 提供預先定義的伺服器設定資料，用於測試不同配置情況。
 *
 * 使用方式：
 * ```typescript
 * import { FIXTURE_COMPLETE_SETTINGS, createSettingsFixture } from '@tests/fixtures/guild-settings';
 *
 * it('should handle complete settings', async () => {
 *   const settings = FIXTURE_COMPLETE_SETTINGS;
 *   // 或建立自訂設定
 *   const customSettings = createSettingsFixture({ staffRoleId: 'custom-role' });
 * });
 * ```
 */

import type { GuildSettings } from '../../src/services/SettingsManager.js';

// ============================================
// 完整設定 Fixture
// ============================================

/**
 * 完整配置的伺服器設定
 * 所有欄位都已設定
 */
export const FIXTURE_COMPLETE_SETTINGS: GuildSettings = {
  guildId: '987654321098765432',
  panelChannelId: 'channel-panel',
  ticketCategoryId: 'category-tickets',
  logChannelId: 'channel-logs',
  staffRoleId: 'role-staff',
  archiveCategoryId: 'category-archive',
  panelTitle: '客服中心',
  panelDescription: '如果您有任何問題，請點擊下方按鈕開啟客服單。',
  panelAuthorIconUrl: 'https://example.com/author-icon.png',
  panelThumbnailUrl: 'https://example.com/thumbnail.png',
  panelFooterIconUrl: 'https://example.com/footer-icon.png',
  forum_autotags: null,
  story_forum_channels: null,
};

// ============================================
// 最小設定 Fixture
// ============================================

/**
 * 最小可用配置
 * 只有必要的欄位設定
 */
export const FIXTURE_MINIMAL_SETTINGS: GuildSettings = {
  guildId: '987654321098765432',
  panelChannelId: null,
  ticketCategoryId: 'category-tickets',
  logChannelId: null,
  staffRoleId: 'role-staff',
  archiveCategoryId: null,
  panelTitle: null,
  panelDescription: null,
  panelAuthorIconUrl: null,
  panelThumbnailUrl: null,
  panelFooterIconUrl: null,
  forum_autotags: null,
  story_forum_channels: null,
};

// ============================================
// 不完整設定 Fixture
// ============================================

/**
 * 未完成設定（缺少必要欄位）
 * 用於測試設定不完整時的錯誤處理
 */
export const FIXTURE_INCOMPLETE_SETTINGS: GuildSettings = {
  guildId: '987654321098765432',
  panelChannelId: null,
  ticketCategoryId: null, // 缺少 Ticket 分類
  logChannelId: null,
  staffRoleId: null, // 缺少 Staff 角色
  archiveCategoryId: null,
  panelTitle: null,
  panelDescription: null,
  panelAuthorIconUrl: null,
  panelThumbnailUrl: null,
  panelFooterIconUrl: null,
  forum_autotags: null,
  story_forum_channels: null,
};

// ============================================
// 僅面板設定 Fixture
// ============================================

/**
 * 只有面板相關設定
 * 用於測試面板功能
 */
export const FIXTURE_PANEL_ONLY_SETTINGS: GuildSettings = {
  guildId: '987654321098765432',
  panelChannelId: 'channel-panel',
  ticketCategoryId: 'category-tickets',
  logChannelId: null,
  staffRoleId: 'role-staff',
  archiveCategoryId: null,
  panelTitle: '支援中心',
  panelDescription: '歡迎使用我們的支援系統！',
  panelAuthorIconUrl: 'https://example.com/icon.png',
  panelThumbnailUrl: null,
  panelFooterIconUrl: null,
  forum_autotags: null,
  story_forum_channels: null,
};

// ============================================
// 故事論壇設定 Fixture
// ============================================

/**
 * 包含故事論壇設定
 */
export const FIXTURE_STORY_FORUM_SETTINGS: GuildSettings = {
  guildId: '987654321098765432',
  panelChannelId: null,
  ticketCategoryId: null,
  logChannelId: null,
  staffRoleId: null,
  archiveCategoryId: null,
  panelTitle: null,
  panelDescription: null,
  panelAuthorIconUrl: null,
  panelThumbnailUrl: null,
  panelFooterIconUrl: null,
  forum_autotags: 'tag1,tag2,tag3',
  story_forum_channels: ['channel-forum-1', 'channel-forum-2'],
};

// ============================================
// 不同 Guild 的設定
// ============================================

/**
 * 第二個 Guild 的設定
 */
export const FIXTURE_SECOND_GUILD_SETTINGS: GuildSettings = {
  ...FIXTURE_COMPLETE_SETTINGS,
  guildId: '111111111111111111',
  panelTitle: '客戶服務',
  panelDescription: '請選擇您需要的服務類型。',
};

/**
 * 第三個 Guild 的設定
 */
export const FIXTURE_THIRD_GUILD_SETTINGS: GuildSettings = {
  ...FIXTURE_MINIMAL_SETTINGS,
  guildId: '222222222222222222',
};

// ============================================
// 設定工廠函數
// ============================================

/**
 * 建立自訂 GuildSettings Fixture
 *
 * @param overrides - 要覆蓋的欄位
 * @returns 新的 GuildSettings 物件
 */
export function createSettingsFixture(
  overrides: Partial<GuildSettings> = {}
): GuildSettings {
  return {
    ...FIXTURE_COMPLETE_SETTINGS,
    ...overrides,
  };
}

/**
 * 建立最小設定 Fixture
 *
 * @param guildId - Guild ID
 * @param overrides - 額外覆蓋的欄位
 * @returns 新的最小 GuildSettings 物件
 */
export function createMinimalSettingsFixture(
  guildId: string,
  overrides: Partial<GuildSettings> = {}
): GuildSettings {
  return {
    ...FIXTURE_MINIMAL_SETTINGS,
    guildId,
    ...overrides,
  };
}

/**
 * 建立空設定 Fixture（所有欄位為 null）
 *
 * @param guildId - Guild ID
 * @returns 空的 GuildSettings 物件
 */
export function createEmptySettingsFixture(guildId: string): GuildSettings {
  return {
    guildId,
    panelChannelId: null,
    ticketCategoryId: null,
    logChannelId: null,
    staffRoleId: null,
    archiveCategoryId: null,
    panelTitle: null,
    panelDescription: null,
    panelAuthorIconUrl: null,
    panelThumbnailUrl: null,
    panelFooterIconUrl: null,
    forum_autotags: null,
    story_forum_channels: null,
  };
}

// ============================================
// 設定驗證輔助函數
// ============================================

/**
 * 檢查設定是否完整（可用於開啟 Ticket）
 *
 * @param settings - 要檢查的設定
 * @returns 設定是否完整
 */
export function isSettingsComplete(settings: GuildSettings | null): boolean {
  if (!settings) return false;
  return !!(settings.ticketCategoryId && settings.staffRoleId);
}

/**
 * 檢查面板設定是否完整
 *
 * @param settings - 要檢查的設定
 * @returns 面板設定是否完整
 */
export function isPanelSettingsComplete(
  settings: GuildSettings | null
): boolean {
  if (!settings) return false;
  return !!(
    settings.panelChannelId &&
    settings.ticketCategoryId &&
    settings.panelTitle &&
    settings.panelDescription
  );
}

// ============================================
// 匯出
// ============================================

export const guildSettingsFixtures = {
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
};
