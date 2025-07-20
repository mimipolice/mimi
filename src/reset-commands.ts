import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v10";
import config from "./config";
import logger from "./utils/logger";

const rest = new REST({ version: "10" }).setToken(config.discord.token!);

(async () => {
  try {
    console.log("Started clearing application (/) commands.");

    console.log("Clearing global commands...");
    await rest.put(Routes.applicationCommands(config.discord.clientId!), {
      body: [],
    });
    console.log("Successfully cleared global application (/) commands.");

    // For guild-specific commands
    if (config.discord.guildId) {
      console.log(`Clearing commands for guild: ${config.discord.guildId}...`);
      await rest.put(
        Routes.applicationGuildCommands(
          config.discord.clientId!,
          config.discord.guildId
        ),
        { body: [] }
      );
      console.log("Successfully cleared guild application (/) commands.");
    } else {
      console.log(
        "No GUILD_ID found in config, skipping guild command clearing."
      );
    }
  } catch (error) {
    logger.error(error);
  }
})();
