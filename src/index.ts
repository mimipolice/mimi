import fs from "node:fs";
import path from "node:path";
import {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  Interaction,
  Message,
} from "discord.js";
import config from "./config";
import "./shared/database";
import {
  loadCaches,
  autoReactCache,
  keywordCache,
  Keyword,
} from "./shared/cache";

// Extend Client class to include a commands property
class CustomClient extends Client {
  commands = new Collection<string, any>();
}

const client = new CustomClient({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Load commands
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".ts") || file.endsWith(".js"));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath).default;
  if ("data" in command && "execute" in command) {
    client.commands.set(command.data.name, command);
  } else {
    console.log(
      `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
    );
  }
}

// Event listener for interactions
client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  if (!interaction.isChatInputCommand() && !interaction.isAutocomplete())
    return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  if (interaction.isAutocomplete()) {
    try {
      await command.autocomplete(interaction);
    } catch (error) {
      console.error(error);
    }
  } else if (interaction.isChatInputCommand()) {
    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: "There was an error while executing this command!",
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: "There was an error while executing this command!",
          ephemeral: true,
        });
      }
    }
  }
});

// Event listener for messages
client.on(Events.MessageCreate, async (message: Message) => {
  if (message.author.bot || !message.guildId) return;

  // Auto-reaction logic
  if (autoReactCache.has(message.channel.id)) {
    const emoji = autoReactCache.get(message.channel.id);
    if (emoji) {
      try {
        await message.react(emoji);
      } catch (error) {
        console.error(`Failed to react with emoji: ${emoji}`, error);
      }
    }
  }

  // Keyword reply logic
  const keywords = keywordCache.get(message.guildId);
  if (keywords) {
    for (const kw of keywords) {
      const match =
        kw.match_type === "exact"
          ? message.content === kw.keyword
          : message.content.includes(kw.keyword);

      if (match) {
        try {
          if (message.channel.isTextBased() && !message.channel.isDMBased()) {
            await message.reply(kw.reply);
          }
        } catch (error) {
          console.error(
            `Failed to send keyword reply for "${kw.keyword}"`,
            error
          );
        }
        // Stop after first match
        break;
      }
    }
  }
});

client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user?.tag}!`);
  await loadCaches();
});

client.login(config.discord.token);
