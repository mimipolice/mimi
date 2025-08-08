import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import {
  ActivityType,
  Client,
  Collection,
  GatewayIntentBits,
} from "discord.js";
import logger from "./utils/logger";
import { errorHandler } from "./utils/errorHandler";
import { SettingsManager } from "./services/SettingsManager";
import { TicketManager } from "./services/TicketManager";
import { PriceAlerter } from "./services/PriceAlerter";
import { LocalizationManager } from "./services/LocalizationManager";
import { HelpService } from "./services/HelpService";
import { gachaDB, mimiDLCDb } from "./shared/database/index";
import { Databases, Services } from "./interfaces/Command";
import { loadCaches } from "./shared/cache";
import appealButton from "./features/anti-spam/appealButton";
import { DiscordService } from "./services/DiscordService";
import { ForumService } from "./services/ForumService";
import { MessageForwardingService } from "./services/MessageForwardingService";
import { CacheService } from "./services/CacheService";
import { CacheInvalidationService } from "./services/CacheInvalidationService";

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
        fs.mkdirSync(transcriptPath, { recursive: true });
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
    // await migrateToLatest(
    //   gachaDB,
    //   "gacha",
    //   path.join(__dirname, "shared/database/migrations/gacha")
    // );
    // await migrateToLatest(
    //   mimiDLCDb,
    //   "ticket",
    //   path.join(__dirname, "shared/database/migrations/ticket")
    // );
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
      GatewayIntentBits.GuildScheduledEvents,
      GatewayIntentBits.GuildMessageReactions,
    ],
  });

  const settingsManager = new SettingsManager(mimiDLCDb);
  const discordService = new DiscordService(client);
  const ticketManager = new TicketManager(
    mimiDLCDb,
    settingsManager,
    discordService
  );
  const localizationManager = new LocalizationManager();
  const priceAlerter = new PriceAlerter(client, localizationManager);
  const helpService = new HelpService(client);
  const forumService = new ForumService();
  const messageForwardingService = new MessageForwardingService(client);
  const cacheService = new CacheService();

  const services: Services = {
    settingsManager,
    ticketManager,
    localizationManager,
    helpService,
    forumService,
    messageForwardingService,
    cacheService,
  };
  const databases: Databases = {
    gachaDb: gachaDB,
    ticketDb: mimiDLCDb,
  };

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
        (item.name === "index.js" || item.name === "index.ts")
      ) {
        const loadedModule = require(fullPath);
        const command = loadedModule.command || loadedModule.default;

        if (command && "data" in command && "execute" in command) {
          command.filePath = fullPath; // Add this line
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
  const interactionFolderNames = fs.readdirSync(interactionFoldersPath);

  for (const folderName of interactionFolderNames) {
    const fullFolderPath = path.join(interactionFoldersPath, folderName);
    try {
      // Ensure it's a directory before trying to read it
      if (fs.statSync(fullFolderPath).isDirectory()) {
        const interactionFiles = fs
          .readdirSync(fullFolderPath)
          .filter((file) => file.endsWith(".js") || file.endsWith(".ts"));

        for (const file of interactionFiles) {
          const filePath = path.join(fullFolderPath, file);
          const interaction = require(filePath).default;

          if (interaction && interaction.name && interaction.execute) {
            if (folderName === "buttons") {
              client.buttons.set(interaction.name, interaction);
            } else if (folderName === "modals") {
              client.modals.set(interaction.name, interaction);
            } else if (folderName === "selectMenus") {
              client.selectMenus.set(interaction.name, interaction);
            }
          } else {
            logger.warn(
              `The interaction at ${filePath} is missing a required "name" or "execute" property.`
            );
          }
        }
      }
    } catch (error) {
      logger.warn(
        `Could not load interactions from ${fullFolderPath}. It might not be a directory.`,
        error
      );
    }
  }

  // Manually register feature-specific interactions
  if (typeof appealButton.name === "string") {
    client.buttons.set(appealButton.name, appealButton);
  }

  // Register error and warning handlers
  client.on("error", (error) => {
    errorHandler.handleClientError(client, error);
  });

  client.on("warn", (warning) => {
    errorHandler.handleClientWarning(client, warning);
  });

  // Load Events
  const eventsPath = path.join(__dirname, "events");
  const eventFiles = fs
    .readdirSync(eventsPath)
    .filter(
      (file: string) =>
        (file.endsWith(".js") || file.endsWith(".ts")) &&
        !fs.statSync(path.join(eventsPath, file)).isDirectory()
    );
  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
      client.once(event.name, (...args) =>
        event.execute(...args, client, services, databases)
      );
    } else {
      client.on(event.name, (...args) =>
        event.execute(...args, client, services, databases)
      );
    }
  }

  // 5. Login to Discord
  client.login(process.env.DISCORD_TOKEN);

  // 6. Start background services
  client.once("ready", async () => {
    if (!client.user) {
      logger.error("Client user is not available.");
      return;
    }
    logger.info(`Logged in as ${client.user.tag}!`);
    client.user.setActivity("米米><", { type: ActivityType.Custom });
    await services.helpService.initialize();
    // Start the cache invalidation listener
    const cacheInvalidator = new CacheInvalidationService(priceAlerter);
    cacheInvalidator.startListening();
  });
}

main().catch((error) => {
  logger.error("Unhandled error during bot startup:", error);
  process.exit(1);
});
