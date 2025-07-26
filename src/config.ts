import dotenv from "dotenv";

dotenv.config();

const config = {
  discord: {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.CLIENT_ID,
    guildId: process.env.DEV_GUILD_ID, // For guild-specific commands
  },
  gachaDatabase: {
    host: process.env.DB_GACHA_HOST,
    port: Number(process.env.DB_GACHA_PORT),
    user: process.env.DB_GACHA_USER,
    password: process.env.DB_GACHA_PASSWORD,
    name: process.env.DB_GACHA_NAME,
  },
  ticketDatabase: {
    host: process.env.DB_TICKET_HOST,
    port: Number(process.env.DB_TICKET_PORT),
    user: process.env.DB_TICKET_USER,
    password: process.env.DB_TICKET_PASSWORD,
    name: process.env.DB_TICKET_NAME,
  },
  mimiDLCDatabase: {
    host: process.env.DB_MIMIDLC_HOST,
    port: Number(process.env.DB_MIMIDLC_PORT),
    user: process.env.DB_MIMIDLC_USER,
    password: process.env.DB_MIMIDLC_PASSWORD,
    name: process.env.DB_MIMIDLC_NAME,
  },
  odogDatabase: {
    host: process.env.ODOG_DB_HOST,
    port: Number(process.env.ODOG_DB_PORT),
    user: process.env.ODOG_DB_USER,
    password: process.env.ODOG_DB_PASSWORD,
    name: process.env.ODOG_DB_DATABASE,
  },
  antiSpam: {
    // Single-channel spam settings
    spamThreshold: 5,
    timeWindow: 5 * 1000, // 5 seconds
    // Multi-channel spam settings
    multiChannelSpamThreshold: 4, // 4 messages in 4 different channels within 10 seconds
    multiChannelTimeWindow: 10 * 1000, // 10 seconds
    // General settings
    timeoutDuration: 24 * 60 * 60 * 1000, // 24 hours
    adminChannelId: process.env.ANTISPAM_ADMIN_CHANNEL_ID || "",
    ignoredRoles: process.env.ANTISPAM_IGNORED_ROLES?.split(",") || [],
    ignoredUsers: process.env.ANTISPAM_IGNORED_USERS?.split(",") || [],
    // Memory cleanup settings
    memoryCleanupInterval: 60 * 60 * 1000, // 1 hour
    inactiveUserThreshold: 2 * 60 * 60 * 1000, // 2 hours
  },
  // We will add feature-specific configs here later
  // e.g., odog, stock channels
};

export default config;
