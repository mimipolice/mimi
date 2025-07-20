import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v10";
import config from "./config";
import fs from "node:fs";
import path from "node:path";
import logger from "./utils/logger";
const commands = [];
const commandsPath = path.join(__dirname, "commands");

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

  commands.push(command.data.toJSON());
}

// Log all command names to be registered
logger.info(
  "Attempting to register the following commands:",
  commands.map((c) => c.name)
);

const rest = new REST({ version: "10" }).setToken(config.discord.token!);

(async () => {
  try {
    logger.info(
      `Started refreshing ${commands.length} application (/) commands.`
    );

    const data = (await rest.put(
      Routes.applicationCommands(config.discord.clientId!),
      { body: commands }
    )) as any[];

    logger.info(
      `Successfully reloaded ${data.length} application (/) commands.`
    );
  } catch (error) {
    logger.error(error);
  }
})();
