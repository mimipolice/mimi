import dotenv from "dotenv";

dotenv.config();

const config = {
  discord: {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.CLIENT_ID,
  },
  gachaDatabase: {
    host: process.env.GACHA_DB_HOST,
    port: Number(process.env.GACHA_DB_PORT),
    user: process.env.GACHA_DB_USER,
    password: process.env.GACHA_DB_PASSWORD,
    name: process.env.GACHA_DB_NAME,
  },
  ticketDatabase: {
    host: process.env.TICKET_DB_HOST,
    port: Number(process.env.TICKET_DB_PORT),
    user: process.env.TICKET_DB_USER,
    password: process.env.TICKET_DB_PASSWORD,
    name: process.env.TICKET_DB_NAME,
  },
  // We will add feature-specific configs here later
  // e.g., odog, stock channels
};

export default config;
