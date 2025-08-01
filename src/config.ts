import dotenv from "dotenv";

dotenv.config();

const mimiDLCDatabaseConfig = {
  host: process.env.MIMIDLC_DB_HOST,
  port: Number(process.env.MIMIDLC_DB_PORT),
  user: process.env.MIMIDLC_DB_USER,
  password: process.env.MIMIDLC_DB_PASSWORD,
  name: process.env.MIMIDLC_DB_NAME,
};

const gachaDatabaseConfig = {
  host: process.env.GACHA_DB_HOST,
  port: Number(process.env.GACHA_DB_PORT),
  user: process.env.GACHA_DB_USER,
  password: process.env.GACHA_DB_PASSWORD,
  name: process.env.GACHA_DB_NAME,
};

const config = {
  discord: {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.CLIENT_ID,
    guildId: process.env.DEV_GUILD_ID, // For guild-specific commands
  },
  gachaDatabase: gachaDatabaseConfig,
  ticketDatabase: mimiDLCDatabaseConfig,
  mimiDLCDatabase: mimiDLCDatabaseConfig,
  odogDatabase: gachaDatabaseConfig,
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
