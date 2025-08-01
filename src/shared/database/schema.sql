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
    id SERIAL PRIMARY KEY,
    "guildTicketId" INTEGER NOT NULL,
    "guildId" VARCHAR(255) NOT NULL,
    "channelId" VARCHAR(255) NOT NULL UNIQUE,
    "ownerId" VARCHAR(255) NOT NULL,
    "claimedById" VARCHAR(255) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    "closeReason" TEXT NULL,
    "closedById" VARCHAR(255) NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP WITH TIME ZONE NULL,
    "transcriptUrl" TEXT NULL,
    "logMessageId" VARCHAR(255) NULL,

    UNIQUE ("guildId", "guildTicketId"),

    CONSTRAINT fk_guild
        FOREIGN KEY("guildId")
        REFERENCES guild_settings("guildId")
        ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(255) PRIMARY KEY
);


-- Price Alerts Table
CREATE TABLE IF NOT EXISTS price_alerts (
    id INTEGER NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    asset_symbol VARCHAR(10) NOT NULL,
    condition VARCHAR(10) NOT NULL, -- 'above' or 'below'
    target_price NUMERIC(18, 8) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_notified_at TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (user_id, id)
);


-- Table for guild-specific ticket counters
CREATE TABLE IF NOT EXISTS guild_ticket_counters (
  "guildId" VARCHAR(255) PRIMARY KEY,
  "lastTicketId" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT fk_guild_counter
    FOREIGN KEY("guildId")
    REFERENCES guild_settings("guildId")
    ON DELETE CASCADE
);
