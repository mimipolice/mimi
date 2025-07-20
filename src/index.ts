import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { Client, Collection, GatewayIntentBits } from "discord.js";
import logger from "./utils/logger";
import { SettingsManager } from "./services/SettingsManager";
import { TicketManager } from "./services/TicketManager";
import { PriceAlerter } from "./services/PriceAlerter";
import { migrateToLatest, gachaDB, ticketDB } from "./shared/database/index";
import { loadCaches } from "./shared/cache";

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

  // 3. Load Caches
  await loadCaches();

  // 4. Initialize Discord client and services
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
  const priceAlerter = new PriceAlerter(client, pool);

  client.commands = new Collection();
  client.commandCategories = new Collection();
  client.buttons = new Collection();
  client.modals = new Collection();
  client.selectMenus = new Collection();

  // Load Commands
  const commandFoldersPath = path.join(__dirname, "commands");

  const loadCommandsRecursively = (dir: string, category: string) => {
    const items = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        // If the command is in a subdirectory, like /utility/help/index.ts,
        // we continue with the same category.
        loadCommandsRecursively(fullPath, category);
      } else if (
        item.isFile() &&
        (item.name.endsWith(".js") || item.name.endsWith(".ts"))
      ) {
        const loadedModule = require(fullPath);
        const command = loadedModule.command || loadedModule.default;

        if (command && "data" in command && "execute" in command) {
          client.commands.set(command.data.name, command);

          if (!client.commandCategories.has(category)) {
            client.commandCategories.set(category, new Collection());
          }
          client.commandCategories
            .get(category)!
            .set(command.data.name, command);
          // logger.info(`Loaded command: ${command.data.name} in category: ${category}`);
        } else {
          logger.warn(
            `The command at ${fullPath} is missing a required "data" or "execute" property.`
          );
        }
      }
    }
  };

  const commandCategoryFolders = fs
    .readdirSync(commandFoldersPath, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  for (const category of commandCategoryFolders) {
    const categoryPath = path.join(commandFoldersPath, category);
    loadCommandsRecursively(categoryPath, category);
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

  // 5. Login to Discord
  client.login(process.env.DISCORD_TOKEN);

  // 6. Start background services
  client.once("ready", () => {
    if (!client.user) {
      logger.error("Client user is not available.");
      return;
    }
    logger.info(`Logged in as ${client.user.tag}!`);
    priceAlerter.start();
  });
}

main().catch((error) => {
  logger.error("Unhandled error during bot startup:", error);
  process.exit(1);
});
