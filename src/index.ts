import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { Client, Collection, GatewayIntentBits } from "discord.js";
import logger from "./utils/logger.js";
import { SettingsManager } from "./services/SettingsManager.js";
import { TicketManager } from "./services/TicketManager.js";
import { migrateToLatest, gachaDB, ticketDB } from "./shared/database/index.js";
import config from "./config.js";

const pool = new Pool({
  host: process.env.DB_GACHA_HOST,
  user: process.env.DB_GACHA_USER,
  password: process.env.DB_GACHA_PASSWORD,
  database: process.env.DB_GACHA_NAME,
  port: process.env.DB_GACHA_PORT
    ? parseInt(process.env.DB_GACHA_PORT, 10)
    : 5432,
});

async function main() {
  // 1. Ensure transcript directory exists
  const transcriptPath = process.env.TRANSCRIPT_PATH;
  if (transcriptPath) {
    try {
      if (!fs.existsSync(transcriptPath)) {
        fs.mkdirSync(transcriptPath, { recursive: true });
        logger.info(`Created transcript directory at: ${transcriptPath}`);
      }
    } catch (error: any) {
      if (error.code === "EACCES") {
        logger.error(
          `Permission denied to create transcript directory at: ${transcriptPath}`
        );
        logger.error(
          "Please ensure the bot has the correct permissions to write to this directory, or change the path in your .env file."
        );
        process.exit(1);
      } else {
        throw error;
      }
    }
  } else {
    logger.warn(
      "TRANSCRIPT_PATH is not set. Transcripts will not be saved to disk."
    );
  }

  // 2. Ensure databases exist and run migrations
  try {
    await migrateToLatest(
      gachaDB,
      "gacha",
      path.join(__dirname, "shared/database/migrations/gacha")
    );
    await migrateToLatest(
      ticketDB,
      "ticket",
      path.join(__dirname, "shared/database/migrations/ticket")
    );
  } catch (error) {
    logger.error("Database migration failed during startup:", error);
    process.exit(1);
  }

  // 3. Initialize Discord client and services
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
  });

  const settingsManager = new SettingsManager(ticketDB);
  const ticketManager = new TicketManager(ticketDB, settingsManager, client);

  client.commands = new Collection();
  client.buttons = new Collection();
  client.modals = new Collection();
  client.selectMenus = new Collection();

  // Load Commands
  const commandFoldersPath = path.join(__dirname, "commands");
  const commandItems = fs.readdirSync(commandFoldersPath);
  for (const item of commandItems) {
    const itemPath = path.join(commandFoldersPath, item);
    const stat = fs.statSync(itemPath);

    if (stat.isDirectory()) {
      const commandsPath = itemPath;
      const commandFiles = fs
        .readdirSync(commandsPath)
        .filter((file) => file.endsWith(".js") || file.endsWith(".ts"));
      for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const loadedModule = require(filePath);
        const command = loadedModule.command || loadedModule.default;
        if (command && "data" in command && "execute" in command) {
          client.commands.set(command.data.name, command);
        } else {
          logger.warn(
            `The command at ${filePath} is missing a required "data" or "execute" property.`
          );
        }
      }
    } else if (
      stat.isFile() &&
      (item.endsWith(".js") || item.endsWith(".ts"))
    ) {
      const filePath = itemPath;
      const loadedModule = require(filePath);
      const command = loadedModule.command || loadedModule.default;
      if (command && "data" in command && "execute" in command) {
        client.commands.set(command.data.name, command);
      } else {
        logger.warn(
          `The command at ${filePath} is missing a required "data" or "execute" property.`
        );
      }
    }
  }

  // Load Interactions (Buttons, Modals, Select Menus)
  const interactionFoldersPath = path.join(__dirname, "interactions");
  const interactionFolders = fs.readdirSync(interactionFoldersPath);
  for (const folder of interactionFolders) {
    const interactionsPath = path.join(interactionFoldersPath, folder);
    const interactionFiles = fs
      .readdirSync(interactionsPath)
      .filter((file) => file.endsWith(".js") || file.endsWith(".ts"));
    for (const file of interactionFiles) {
      const filePath = path.join(interactionsPath, file);
      const interaction = require(filePath).default;
      if (interaction && interaction.name && interaction.execute) {
        if (folder === "buttons")
          client.buttons.set(interaction.name, interaction);
        if (folder === "modals")
          client.modals.set(interaction.name, interaction);
        if (folder === "selectMenus")
          client.selectMenus.set(interaction.name, interaction);
      } else {
        logger.warn(
          `The interaction at ${filePath} is missing a required "name" or "execute" property.`
        );
      }
    }
  }

  // Load Events
  const eventsPath = path.join(__dirname, "events");
  const eventFiles = fs
    .readdirSync(eventsPath)
    .filter((file) => file.endsWith(".js") || file.endsWith(".ts"));
  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
      client.once(event.name, (...args) =>
        event.execute(
          ...args,
          client,
          settingsManager,
          ticketManager,
          gachaDB,
          ticketDB
        )
      );
    } else {
      client.on(event.name, (...args) =>
        event.execute(
          ...args,
          client,
          settingsManager,
          ticketManager,
          gachaDB,
          ticketDB
        )
      );
    }
  }

  // 4. Login to Discord
  client.login(process.env.DISCORD_TOKEN);
}

main().catch((error) => {
  logger.error("Unhandled error during bot startup:", error);
  process.exit(1);
});
