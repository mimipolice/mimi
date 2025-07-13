import {
  SlashCommandBuilder,
  CommandInteraction,
  EmbedBuilder,
  Collection,
} from "discord.js";

// A simple interface for the structure of a command
interface Command {
  data: SlashCommandBuilder;
  execute: (interaction: CommandInteraction) => Promise<void>;
}

export default {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription(
      "Lists all available commands or info about a specific command."
    )
    .addStringOption((option) =>
      option
        .setName("command")
        .setDescription("The command to get help for.")
        .setRequired(false)
    ),

  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;

    const commands = (interaction.client as any).commands as Collection<
      string,
      Command
    >;
    const commandName = interaction.options.getString("command");

    if (!commandName) {
      // General help embed
      const helpEmbed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle("Here are all my commands:")
        .setDescription(
          commands
            .map((cmd) => `\`/${cmd.data.name}\`: ${cmd.data.description}`)
            .join("\n")
        );

      await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
    } else {
      // Specific command help
      const command = commands.get(commandName.toLowerCase());

      if (!command) {
        await interaction.reply({
          content: "That's not a valid command!",
          ephemeral: true,
        });
        return;
      }

      const commandEmbed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(`Help for \`/${command.data.name}\``)
        .setDescription(command.data.description);

      if (command.data.options.length > 0) {
        let optionsString = "";
        for (const option of command.data.options as any[]) {
          if (option.type === 1) {
            // SUB_COMMAND
            optionsString += `\`${option.name}\`: ${option.description}\n`;
          }
        }
        if (optionsString) {
          commandEmbed.addFields({ name: "Subcommands", value: optionsString });
        }
      }

      await interaction.reply({ embeds: [commandEmbed], ephemeral: true });
    }
  },
};
