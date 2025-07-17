import { Pool } from 'pg';
import logger from '../../../utils/logger';

export async function up(db: Pool): Promise<void> {
  try {
    await db.query(`
      -- Table for Auto-Reactions
      DO $$
      BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'auto_reacts') THEN
              CREATE TABLE auto_reacts (
                guild_id TEXT NOT NULL,
                channel_id TEXT NOT NULL,
                emoji TEXT NOT NULL,
                PRIMARY KEY (guild_id, channel_id)
              );
          END IF;
      END$$;

      -- Table for Keyword Replies
      DO $$
      BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'keywords') THEN
              CREATE TABLE keywords (
                id SERIAL PRIMARY KEY,
                guild_id TEXT NOT NULL,
                keyword TEXT NOT NULL,
                reply TEXT NOT NULL,
                match_type TEXT NOT NULL, -- 'exact' or 'contains'
                UNIQUE (guild_id, keyword)
              );
          END IF;
      END$$;

      -- Table for To-Do List
      DO $$
      BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'todos') THEN
              CREATE TABLE todos (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                item TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
              );
          END IF;
      END$$;

      -- 資料表 1: guild_settings (儲存每個伺服器的專屬設定)
      -- 這是多伺服器支援的核心
      CREATE TABLE IF NOT EXISTS guild_settings (
          "guildId" VARCHAR(255) PRIMARY KEY, -- Discord 伺服器 ID，作為主鍵
          "panelChannelId" VARCHAR(255) NULL,   -- 客服面板頻道的 ID
          "ticketCategoryId" VARCHAR(255) NULL, -- 客服單創建分類的 ID
          "logChannelId" VARCHAR(255) NULL,     -- 日誌頻道的 ID
          "staffRoleId" VARCHAR(255) NULL,      -- 客服團隊身分組的 ID
          "archiveCategoryId" VARCHAR(255) NULL -- 封存分類的 ID
      );

      -- 資料表 2: tickets (儲存每一張客服單的詳細資訊)
      CREATE TABLE IF NOT EXISTS tickets (
          id SERIAL PRIMARY KEY,                        -- 自動遞增的客服單流水號
          "guildId" VARCHAR(255) NOT NULL,              -- 所屬伺服器的 ID
          "channelId" VARCHAR(255) NOT NULL UNIQUE,     -- 對應頻道的 ID，應為唯一
          "ownerId" VARCHAR(255) NOT NULL,              -- 創建者的使用者 ID
          "claimedById" VARCHAR(255) NULL,              -- 接手客服的使用者 ID
          status VARCHAR(20) NOT NULL DEFAULT 'OPEN', -- 客服單狀態 ('OPEN', 'CLOSED')
          "closeReason" TEXT NULL,                      -- 關閉原因
          "closedById" VARCHAR(255) NULL,               -- 關閉者的使用者 ID
          "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- 創建時間
          "closedAt" TIMESTAMP WITH TIME ZONE NULL,     -- 關閉時間
          "feedbackRating" SMALLINT NULL CHECK ("feedbackRating" >= 1 AND "feedbackRating" <= 5), -- 1-5 星評價
          "feedbackComment" TEXT NULL,                  -- 使用者文字反饋

          -- 建立一個外鍵約束，以便於數據完整性管理 (可選，但推薦)
          CONSTRAINT fk_guild
              FOREIGN KEY("guildId")
              REFERENCES guild_settings("guildId")
              ON DELETE CASCADE -- 如果伺服器設定被刪除，其所有客服單也一併刪除
      );

      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY
      );
    `);
    logger.info('Migration 000_initial_schema completed successfully.');
  } catch (error) {
    logger.error('Error running migration 000_initial_schema:', error);
    throw error;
  }
}
