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

// --- Load all localizations at once ---
const allLocalizations: { [lang: string]: any } = {};
const localesPath = path.join(__dirname, "locales");
if (fs.existsSync(localesPath)) {
  const localeFiles = fs
    .readdirSync(localesPath)
    .filter((f) => f.endsWith(".json"));
  for (const file of localeFiles) {
    const lang = file.replace(".json", "");
    try {
      allLocalizations[lang] = require(path.join(localesPath, file));
    } catch (e) {
      logger.error(`Error parsing localization file ${file}`, e);
    }
  }
}
// --- End Loading Localizations ---

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
  const commandName = command.data.name;
  const nameLocalizations: { [key: string]: string } = {};
  const descriptionLocalizations: { [key: string]: string } = {};

  for (const lang in allLocalizations) {
    const commandLoc = allLocalizations[lang]?.commands?.[commandName];
    if (commandLoc) {
      if (commandLoc.name) {
        nameLocalizations[lang] = commandLoc.name;
      }
      if (commandLoc.description) {
        descriptionLocalizations[lang] = commandLoc.description;
      }
    }
  }

  // Only apply if there are any localizations
  if (Object.keys(nameLocalizations).length > 0) {
    command.data.setNameLocalizations(nameLocalizations);
  }
  if (
    "setDescriptionLocalizations" in command.data &&
    Object.keys(descriptionLocalizations).length > 0
  ) {
    command.data.setDescriptionLocalizations(descriptionLocalizations);
  }

  // --- Recursive function to apply localizations to options ---
  function applyNestedLocalizations(
    options: any[],
    lang: string,
    commandLoc: any
  ) {
    if (!options || !commandLoc) return;

    for (const option of options) {
      const optionName = option.name;
      const subcommandsLoc = commandLoc.subcommands?.[optionName];
      const optionsLoc = commandLoc.options?.[optionName];
      const targetLoc = subcommandsLoc || optionsLoc;

      if (targetLoc) {
        // Apply name and description localizations for the option itself
        const optNameLocalizations: { [key: string]: string } = {};
        const optDescLocalizations: { [key: string]: string } = {};

        for (const innerLang in allLocalizations) {
          const innerCommandLoc =
            allLocalizations[innerLang]?.commands?.[commandName];
          if (innerCommandLoc) {
            const innerTargetLoc =
              innerCommandLoc.subcommands?.[optionName] ||
              innerCommandLoc.options?.[optionName];
            if (innerTargetLoc) {
              if (innerTargetLoc.name)
                optNameLocalizations[innerLang] = innerTargetLoc.name;
              if (innerTargetLoc.description)
                optDescLocalizations[innerLang] = innerTargetLoc.description;
            }
          }
        }

        if (Object.keys(optNameLocalizations).length > 0) {
          option.setNameLocalizations(optNameLocalizations);
        }
        if (Object.keys(optDescLocalizations).length > 0) {
          option.setDescriptionLocalizations(optDescLocalizations);
        }

        // Recursively apply to sub-options
        if (option.options && (targetLoc.options || targetLoc.subcommands)) {
          applyNestedLocalizations(option.options, lang, targetLoc);
        }
      }
    }
  }

  if (command.data.options) {
    // We can use any language as the base structure, as they should be consistent
    const baseLang = Object.keys(allLocalizations)[0];
    if (baseLang) {
      const baseCommandLoc =
        allLocalizations[baseLang]?.commands?.[commandName];
      if (baseCommandLoc) {
        applyNestedLocalizations(
          command.data.options,
          baseLang,
          baseCommandLoc
        );
      }
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
