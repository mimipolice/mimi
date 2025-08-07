import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v10";
import config from "./config";
import fs from "node:fs";
import path from "node:path";
import logger from "./utils/logger";
const guildCommands = [];
const globalCommands = [];
const commandsPath = path.join(__dirname, "commands");
const devOnlyFolders = ["user", "message"];

// Recursive function to get all command files
function getCommandFiles(dir: string): string[] {
  const commandFiles: string[] = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      commandFiles.push(...getCommandFiles(fullPath));
    } else if (item.name === "index.ts" || item.name === "index.js") {
      commandFiles.push(fullPath);
    }
  }

  return commandFiles;
}

const commandFiles = getCommandFiles(commandsPath);

for (const file of commandFiles) {
  const command = require(file).default || require(file).command;

  if (!command?.data?.name) {
    logger.info(
      `[WARNING] The command at ${file} is missing a required "data" or "name" property.`
    );
    continue;
  }

  // --- Localizations ---
  const commandDir = path.dirname(file);
  const localesDir = path.join(commandDir, "locales");

  if (fs.existsSync(localesDir)) {
    const allTranslations: { [key: string]: any } = {};
    const localeFiles = fs
      .readdirSync(localesDir)
      .filter((f) => f.endsWith(".json"));

    for (const localeFile of localeFiles) {
      const locale = localeFile.replace(".json", "");
      try {
        allTranslations[locale] = require(path.join(localesDir, localeFile));
      } catch (e) {
        logger.error(`Error parsing ${localeFile}`, e);
      }
    }

    const nameLocalizations: { [key: string]: string } = {};
    const descriptionLocalizations: { [key: string]: string } = {};

    for (const locale in allTranslations) {
      if (allTranslations[locale].name) {
        nameLocalizations[locale] = allTranslations[locale].name;
      }
      if (allTranslations[locale].description) {
        descriptionLocalizations[locale] = allTranslations[locale].description;
      }
    }

    command.data.setNameLocalizations(nameLocalizations);
    if (
      "setDescriptionLocalizations" in command.data &&
      Object.keys(descriptionLocalizations).length > 0
    ) {
      command.data.setDescriptionLocalizations(descriptionLocalizations);
    }

    // --- Recursive function to apply localizations to options ---
    function applyNestedLocalizations(options: any[], translations: any) {
      if (!options || !translations) return;

      for (const option of options) {
        const optionName = option.name;
        const optionTranslations = translations[optionName];

        if (optionTranslations) {
          // Apply description localizations
          const descriptionLocalizations: { [key: string]: string } = {};
          for (const locale in allTranslations) {
            const localeTranslations = allTranslations[locale];
            // Traverse the nested structure
            const nestedTrans =
              localeTranslations.subcommands?.[optionName] ||
              localeTranslations.options?.[optionName];
            if (nestedTrans?.description) {
              descriptionLocalizations[locale] = nestedTrans.description;
            }
          }
          if (Object.keys(descriptionLocalizations).length > 0) {
            option.setDescriptionLocalizations(descriptionLocalizations);
          }

          // Recursively apply to sub-options
          if (
            option.options &&
            (optionTranslations.options || optionTranslations.subcommands)
          ) {
            applyNestedLocalizations(
              option.options,
              optionTranslations.options || optionTranslations.subcommands
            );
          }
        }
      }
    }

    if (command.data.options) {
      const baseTranslations =
        allTranslations["en-US"] || allTranslations["zh-TW"] || {};
      applyNestedLocalizations(
        command.data.options,
        baseTranslations.subcommands || baseTranslations.options
      );
    }
  }
  // --- End Localizations ---

  const commandFolder = path.relative(commandsPath, file).split(path.sep)[0];

  try {
    if (command.guildOnly || devOnlyFolders.includes(commandFolder)) {
      guildCommands.push(command.data.toJSON());
    } else {
      command.data.setIntegrationTypes([0, 1]); // 0 = Guild Install, 1 = User Install
      command.data.setContexts([0, 1, 2]); // 0 = Guild, 1 = Bot DM, 2 = Private Channel
      globalCommands.push(command.data.toJSON());
    }
  } catch (error: any) {
    logger.error(
      `Error processing command "${command.data.name}" from file: ${file}`
    );
    logger.error(
      `This is likely due to a missing description in the command or one of its options.`
    );
    throw error; // Re-throw the error to stop the deployment
  }
}

// Log all command names to be registered
logger.info(
  "Attempting to register the following global commands:",
  globalCommands.map((c) => c.name)
);
logger.info(
  "Attempting to register the following guild commands:",
  guildCommands.map((c) => c.name)
);

const rest = new REST({ version: "10" }).setToken(config.discord.token!);

(async () => {
  try {
    // Deploy Global Commands
    if (globalCommands.length > 0) {
      logger.info(
        `Started refreshing ${globalCommands.length} application (/) commands.`
      );
      const data = (await rest.put(
        Routes.applicationCommands(config.discord.clientId!),
        { body: globalCommands }
      )) as any[];
      logger.info(
        `Successfully reloaded ${data.length} global application (/) commands.`
      );
    }

    // Deploy Guild-specific Commands
    if (guildCommands.length > 0 && config.discord.guildId) {
      logger.info(
        `Started refreshing ${guildCommands.length} guild application (/) commands.`
      );
      const data = (await rest.put(
        Routes.applicationGuildCommands(
          config.discord.clientId!,
          config.discord.guildId
        ),
        { body: guildCommands }
      )) as any[];
      logger.info(
        `Successfully reloaded ${data.length} guild application (/) commands.`
      );
    }
  } catch (error) {
    logger.error(error);
  }
})();
