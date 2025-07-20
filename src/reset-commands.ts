import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v10";
import config from "./config";
import logger from "./utils/logger";

const rest = new REST({ version: "10" }).setToken(config.discord.token!);

(async () => {
  try {
    logger.info("Started clearing application (/) commands.");

    logger.info("Clearing global commands...");
    await rest.put(Routes.applicationCommands(config.discord.clientId!), {
      body: [],
    });
    logger.info("Successfully cleared global application (/) commands.");

    // For guild-specific commands
    if (config.discord.guildId) {
      logger.info(`Clearing commands for guild: ${config.discord.guildId}...`);
      await rest.put(
        Routes.applicationGuildCommands(
          config.discord.clientId!,
          config.discord.guildId
        ),
        { body: [] }
      );
      logger.info("Successfully cleared guild application (/) commands.");
    } else {
      logger.info(
        "No GUILD_ID found in config, skipping guild command clearing."
      );
    }
  } catch (error) {
    logger.error(error);
  }
})();
