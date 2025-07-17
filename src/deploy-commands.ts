import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v10";
import config from "./config";
import fs from "node:fs";
import path from "node:path";

const commands = [];
const commandsPath = path.join(__dirname, "commands");

// Recursive function to get all command files
function getCommandFiles(dir: string): string[] {
  const commandFiles: string[] = [];
  const files = fs.readdirSync(dir, { withFileTypes: true });

  for (const file of files) {
    const filePath = path.join(dir, file.name);
    if (file.isDirectory()) {
      commandFiles.push(...getCommandFiles(filePath));
    } else if (file.name.endsWith(".ts") || file.name.endsWith(".js")) {
      commandFiles.push(filePath);
    }
  }

  return commandFiles;
}

const commandFiles = getCommandFiles(commandsPath);

for (const file of commandFiles) {
  const command = require(file).default || require(file).command;

  if (command && command.data) {
    commands.push(command.data.toJSON());
  } else {
    console.log(
      `[WARNING] The command at ${file} is missing a required "data" or "command" property.`
    );
  }
}

const rest = new REST({ version: "10" }).setToken(config.discord.token!);

(async () => {
  try {
    console.log(
      `Started refreshing ${commands.length} application (/) commands.`
    );

    const data = (await rest.put(
      Routes.applicationCommands(config.discord.clientId!),
      { body: commands }
    )) as any[];

    console.log(
      `Successfully reloaded ${data.length} application (/) commands.`
    );
  } catch (error) {
    console.error(error);
  }
})();
