import { ColumnType } from "kysely";

export interface UserTopGuild {
  guild_id: string;
  usage_count: number;
}

export interface UserTopCommand {
  command_name: string;
  usage_count: number;
}

export interface UserTransaction {
  sender_id: string;
  receiver_id: string;
  amount: number;
  created_at: Date;
}

export interface SpendingBreakdown {
  transaction_type: string;
  total_amount: number;
}

export interface PortfolioItem {
  asset_name: string;
  quantity: number;
  total_value: number;
}

export interface TopSender {
  sender_id: string;
  count: number;
  total_amount: number;
}

export interface TopReceiver {
  receiver_id: string;
  count: number;
  total_amount: number;
}

export interface CommandUsagePattern {
  command_name: string;
  usage_count: number;
  avg_execution_time: number;
  execution_time_stddev: number;
  min_execution_time: number;
  max_execution_time: number;
  avg_interval_seconds: number;
  interval_stddev_seconds: number;
  last_used_at: Date;
  first_used_at: Date;
}

export interface UserInfoData {
  top_guilds: UserTopGuild[];
  top_commands: UserTopCommand[];
  recent_transactions: UserTransaction[];
  total_cards: number;
  total_spent: number;
  total_received: number;
  spending_breakdown: SpendingBreakdown[];
  income_breakdown: SpendingBreakdown[];
  portfolio: PortfolioItem[];
  top_senders: TopSender[];
  top_receivers: TopReceiver[];
  oil_balance: number;
  oil_ticket_balance: number;
  total_transactions_count: number;
}

export interface GachaDB {
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
  ai_conversation_messages: {
    id: ColumnType<number, never, never>;
    conversation_id: number;
    role: "user" | "assistant" | "system";
    content: string;
    created_at: ColumnType<Date, string, string>;
  };
  asset_price_history: {
    id: ColumnType<number, never, never>;
    asset_id: number;
    price: number;
    timestamp: ColumnType<Date, string, string>;
  };
  virtual_assets: {
    asset_id: ColumnType<number, never, never>;
    asset_symbol: string;
    asset_name: string;
    current_price: number;
  };
  market_transactions: {
    transaction_id: ColumnType<number, never, never>;
    asset_id: number;
    quantity: number;
    timestamp: ColumnType<Date, string, string>;
  };
  gacha_pools: {
    gacha_id: string;
    gacha_name: string;
    gacha_name_alias: string;
  };
  gacha_master_cards: {
    card_id: number;
    pool_type: string;
    rarity: number;
  };
  gacha_draw_history: {
    id: ColumnType<number, never, never>;
    user_id: string;
    card_id: number;
    created_at: ColumnType<Date, string, string>;
  };
  gacha_users: {
    user_id: string;
    nickname: string;
    oil_balance: number;
    oil_ticket_balance: number;
  };
  user_transaction_history: {
    id: ColumnType<number, never, never>;
    sender_id: string;
    receiver_id: string;
    net_amount: number;
    gross_amount: number;
    created_at: ColumnType<Date, string, string>;
  };
  balance_history: {
    id: ColumnType<number, never, never>;
    user_id: string;
    change_amount: number;
    transaction_type: string;
  };
  player_portfolios: {
    id: ColumnType<number, never, never>;
    user_id: string;
    asset_id: number;
    quantity: number;
  };
  command_usage_stats: {
    id: ColumnType<number, never, never>;
    user_id: string;
    guild_id: string | null;
    channel_id: string | null;
    command_name: string;
    used_at: ColumnType<Date, Date | string | undefined, Date | string>;
    command_type: string | null;
    success: boolean | null;
    error_message: string | null;
  };
  gacha_user_collections: {
    id: ColumnType<number, never, never>;
    user_id: string;
    quantity: number;
  };
}

export interface MimiDLCDB {
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
    forum_autotags: ColumnType<string, string, string> | null;
    story_forum_channels: string[] | null;
  };
  tickets: {
    id: ColumnType<number, never, never>;
    guildId: string;
    guildTicketId: number;
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
  guild_ticket_counters: {
    guildId: string;
    lastTicketId: number;
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
  anti_spam_settings: {
    guildid: string;
    messagethreshold: number;
    timeoutduration: number;
    time_window: number;
    multichannelthreshold: number | null;
    multichanneltimewindow: number | null;
    ignored_roles: string[] | null;
  };
  anti_spam_logs: {
    guild_id: string;
    log_channel_id: string;
    created_at: ColumnType<Date, string, string>;
    updated_at: ColumnType<Date, string, string>;
  };
  auto_reacts: {
    guild_id: string;
    channel_id: string;
    emoji: string;
  };
  keywords: {
    id: ColumnType<number, never, never>;
    guild_id: string;
    keyword: string;
    reply: string;
    match_type: "exact" | "contains";
  };
  todos: {
    id: ColumnType<number, never, never>;
    user_id: string;
    item: string;
    created_at: ColumnType<Date, string | undefined, string>;
  };
  forum_post_solutions: {
    thread_id: string;
    message_id: string;
    author_id: string;
    tags: string[] | null;
  };
  story_forum_threads: {
    thread_id: string;
    guild_id: string;
    author_id: string;
    status: "pending" | "validated";
    created_at: ColumnType<Date, string | undefined, string>;
  };
  story_forum_subscriptions: {
    id: ColumnType<number, never, never>;
    thread_id: string;
    user_id: string;
    subscription_type: "release" | "test" | "author_all";
    subscribed_at: ColumnType<Date, string | undefined, string>;
  };
  story_forum_subscription_entries: {
    thread_id: string;
    message_id: string | null;
    enabled: boolean;
    created_at: ColumnType<Date, string | undefined, string>;
    last_release_update: string | null;
    last_test_update: string | null;
  };
  story_forum_permissions: {
    id: ColumnType<number, never, never>;
    thread_id: string;
    user_id: string;
    granted_at: ColumnType<Date, string | undefined, string>;
    granted_by: string;
  };
  story_forum_author_preferences: {
    user_id: string;
    ask_on_post: boolean;
    updated_at: ColumnType<Date, string | undefined, string>;
  };
}
