import { ColumnType } from "kysely";

export interface DB {
  guild_settings: {
    guildId: string;
    panelChannelId: string | null;
    ticketCategoryId: string | null;
    logChannelId: string | null;
    staffRoleId: string | null;
    archiveCategoryId: string | null;
    panelTitle: string | null;
    panelDescription: string | null;
    panelAuthorIconUrl: string | null;
    panelThumbnailUrl: string | null;
    panelFooterIconUrl: string | null;
  };
  tickets: {
    id: ColumnType<number, never, never>;
    guildId: string;
    channelId: string;
    ownerId: string;
    claimedById: string | null;
    status: "OPEN" | "CLOSED";
    closeReason: string | null;
    closedById: string | null;
    createdAt: ColumnType<Date, string, string>;
    closedAt: ColumnType<Date, string, string> | null;
    transcriptUrl: string | null;
    logMessageId: string | null;
  };
  ticket_types: {
    id: ColumnType<number, never, never>;
    guild_id: string;
    type_id: string;
    label: string;
    style: string;
    emoji: string | null;
  };
  panels: {
    id: ColumnType<number, never, never>;
    guild_id: string;
    channel_id: string;
    message_id: string;
    title: string;
    content: string;
    button_label: string;
    button_color: string;
    category_id: string;
  };
  ai_prompts: {
    id: ColumnType<number, never, never>;
    user_id: string;
    name: string;
    prompt: string;
    created_at: ColumnType<Date, string, string>;
  };
  ai_conversations: {
    id: ColumnType<number, never, never>;
    guild_id: string;
    user_id: string;
    created_at: ColumnType<Date, string, string>;
    updated_at: ColumnType<Date, string, string>;
    channel_id: string | null;
    message_id: string | null;
  };
}

export type Ticket = DB["tickets"];

export interface MimiDLCDB {
  price_alerts: {
    id: number;
    user_id: string;
    asset_symbol: string;
    condition: "above" | "below";
    target_price: number;
    created_at: ColumnType<Date, string, string>;
    last_notified_at: ColumnType<Date, string, string> | null;
    repeatable: ColumnType<boolean, boolean, boolean>;
    locale: string;
  };
  anti_spam_logs: {
    guild_id: string;
    log_channel_id: string;
    created_at: ColumnType<Date, string, string>;
    updated_at: ColumnType<Date, string, string>;
  };
}
