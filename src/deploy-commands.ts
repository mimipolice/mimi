import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v10";
import config from "./config";
import fs from "node:fs";
import path from "node:path";

const commands = [];
// The path should be to the compiled JS files in the 'dist' directory
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".ts") || file.endsWith(".js"));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath).default;

  if (command && command.data) {
    commands.push(command.data.toJSON());
  } else {
    console.log(
      `[WARNING] The command at ${filePath} is missing a required "data" property.`
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
