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
  // We will add feature-specific configs here later
  // e.g., odog, stock channels
};

export default config;
