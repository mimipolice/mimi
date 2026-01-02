import { env } from "./config/env";

const mimiDLCDatabaseConfig = {
  host: env.MIMIDLC_DB_HOST,
  port: env.MIMIDLC_DB_PORT,
  user: env.MIMIDLC_DB_USER,
  password: env.MIMIDLC_DB_PASSWORD,
  name: env.MIMIDLC_DB_NAME,
};

const gachaDatabaseConfig = {
  host: env.GACHA_DB_HOST,
  port: env.GACHA_DB_PORT,
  user: env.GACHA_DB_USER,
  password: env.GACHA_DB_PASSWORD,
  name: env.GACHA_DB_NAME,
};

const config = {
  discord: {
    token: env.DISCORD_TOKEN,
    clientId: env.CLIENT_ID,
    guildId: env.DEV_GUILD_ID,
  },
  gachaDatabase: gachaDatabaseConfig,
  ticketDatabase: mimiDLCDatabaseConfig,
  mimiDLCDatabase: mimiDLCDatabaseConfig,
  odogDatabase: gachaDatabaseConfig,
  antiSpam: {
    // Single-channel spam settings
    spamThreshold: 7,
    timeWindow: 8 * 1000, // 8 seconds
    // Multi-channel spam settings
    multiChannelSpamThreshold: 6, // 6 messages in different channels within 12 seconds
    multiChannelTimeWindow: 12 * 1000, // 12 seconds
    // General settings
    timeoutDuration: 24 * 60 * 60 * 1000, // 24 hours
    adminChannelId: process.env.ANTISPAM_ADMIN_CHANNEL_ID || "",
    ignoredRoles: process.env.ANTISPAM_IGNORED_ROLES?.split(",") || [],
    ignoredUsers: process.env.ANTISPAM_IGNORED_USERS?.split(",") || [],
    // Memory cleanup settings
    memoryCleanupInterval: 60 * 60 * 1000, // 1 hour
    inactiveUserThreshold: 2 * 60 * 60 * 1000, // 2 hours
  },
  resources: {
    images: {
      close:
        "https://cdn.discordapp.com/attachments/1336020673730187334/1395531660908433418/close.png?ex=68967923&is=689527a3&hm=6dbfd3b01df5fe9d8a94076d9957a657485390d019f646ceff7bbe9db6f6a7c8&",
      thumbnail:
        "https://cdn.discordapp.com/attachments/1336020673730187334/1395531136079237141/1388098388058181723.webp?ex=689678a6&is=68952726&hm=85a1ae75b464eed605d8359bd3be3897dde8568362bc58a11e84a73baca91945&",
      sandClock:
        "https://cdn.discordapp.com/attachments/1336020673730187334/1395754284453335071/sand-clock.png?ex=689749a8&is=6895f828&hm=f252575c8f88f13a435a331d84b8893abf16a43748c4f4106661377e992a075c&",
    },
    links: {
      supportServer: "https://discord.gg/kDua5dDt4v",
    },
  },
  // We will add feature-specific configs here later
  // e.g., odog, stock channels
};

export default config;
